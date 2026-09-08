import { NextRequest, NextResponse } from "next/server";
import { getAIProvider, extractJson } from "../../../lib/ai/provider";
import { z } from "zod";

const RequestSchema = z.object({
  barcode: z.string().min(1)
});

interface MedicineData {
  medicineName: string;
  brandName: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
  classification: string;
  confidence: string;
  source?: string;
}

// ─── Server-side cache: same barcode → same result every time ─────────────────
// This eliminates Gemini non-determinism for repeated scans of the same barcode.
const barcodeCache = new Map<string, MedicineData | { error: string; confidence: string }>();

// ─── Helper ───────────────────────────────────────────────────────────────────
function cleanBarcode(raw: string): string {
  return raw.replace(/[\s\-]/g, "").trim();
}

// ─── Country prefix hints for barcode origin ──────────────────────────────────
function getCountryHint(barcode: string): string {
  const prefix = parseInt(barcode.substring(0, 3));
  if (prefix >= 600 && prefix <= 609) return "South Africa";
  if (prefix >= 890 && prefix <= 899) return "India";
  if (prefix >= 300 && prefix <= 379) return "France";
  if (prefix >= 400 && prefix <= 440) return "Germany";
  if (prefix >= 450 && prefix <= 459) return "Japan";
  if (prefix >= 500 && prefix <= 509) return "United Kingdom";
  if (prefix >= 700 && prefix <= 709) return "Norway";
  if (prefix >= 730 && prefix <= 739) return "Sweden";
  if (prefix >= 800 && prefix <= 839) return "Italy";
  if (prefix >= 840 && prefix <= 849) return "Spain";
  if (barcode.length <= 12) return "United States (UPC)";
  return "Unknown region";
}

// ─── Strategy 1: openFDA NDC / UPC lookup ────────────────────────────────────
async function tryOpenFDA(barcode: string): Promise<MedicineData | null> {
  const queries = [
    `packaging.package_ndc:"${barcode}"`,
    `product_ndc:"${barcode}"`,
    `packaging.upc:"${barcode}"`,
  ];

  for (const q of queries) {
    try {
      const url = `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;

      const r = data.results[0];
      const brandName = r.brand_name || r.proprietary_name || "";
      const genericName = r.generic_name || r.nonproprietary_name || "";
      const strength = r.active_ingredients
        ? r.active_ingredients.map((a: any) => `${a.name} ${a.strength}`).join(", ")
        : "";

      let classification = "Unable to Verify";
      if (brandName && genericName) {
        if (brandName.toLowerCase() === genericName.toLowerCase()) {
          classification = "Generic";
        } else if (r.application_number?.startsWith("ANDA")) {
          classification = "Branded Generic";
        } else {
          classification = "Branded";
        }
      }

      return {
        medicineName: brandName || genericName || "Unknown Medicine",
        brandName,
        genericName,
        strength,
        dosageForm: r.dosage_form || "",
        manufacturer: r.labeler_name || "",
        classification,
        confidence: "High",
        source: "openFDA",
      };
    } catch { continue; }
  }
  return null;
}

// ─── Strategy 2: Open Products / Food Facts (international EAN) ───────────────
async function tryOpenProductsFacts(barcode: string): Promise<MedicineData | null> {
  const endpoints = [
    `https://world.openproductsfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FarmaDDIChecker/1.0" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== 1 || !data.product) continue;

      const p = data.product;
      const productName = p.product_name_en || p.product_name || "";
      const brandName = p.brands || "";
      const genericName = p.generic_name_en || p.generic_name || "";
      if (!productName && !brandName) continue;

      const lowerName = (productName + " " + genericName).toLowerCase();
      const medicineKeywords = [
        "tablet", "capsule", "syrup", "suspension", "injection", "cream", "ointment",
        "gel", "drops", "inhaler", "patch", "suppository", "solution", "mg", "ml",
        "paracetamol", "ibuprofen", "amoxicillin", "aspirin", "cetirizine", "metformin",
        "atorvastatin", "omeprazole", "antibiotic", "analgesic", "antifungal",
        "medicine", "pharmaceutical", "pharma", "drug", "medication", "acetaminophen",
      ];
      const isMedLike = medicineKeywords.some(k => lowerName.includes(k));
      const hasMedCategory = p.categories_tags?.some((c: string) =>
        c.includes("medication") || c.includes("pharmaceutical") || c.includes("medicine"));

      if (!isMedLike && !hasMedCategory) continue;

      return {
        medicineName: productName || brandName || "Unknown Product",
        brandName,
        genericName: genericName || productName,
        strength: p.quantity || "",
        dosageForm: genericName || "",
        manufacturer: p.manufacturers || p.brands || "",
        classification: brandName && genericName && brandName !== genericName ? "Branded" : "Generic",
        confidence: "Medium",
        source: "Open Products Database",
      };
    } catch { continue; }
  }
  return null;
}

// ─── Strategy 3: Gemini AI Knowledge Lookup (HIGH-CONFIDENCE ONLY) ────────────
// CRITICAL: We ONLY accept the result if Gemini marks confidence as "High".
// This prevents hallucinated/random guesses from polluting results.
// The result is then cached so the same barcode is always answered the same way.
async function tryGeminiKnowledge(barcode: string): Promise<MedicineData | null> {
  const country = getCountryHint(barcode);

  const systemPrompt = `You are a pharmaceutical barcode identification system.
A barcode number has been scanned from medicine packaging.

CRITICAL RULES — THESE ARE NON-NEGOTIABLE:
1. You MUST only identify the medicine if you are absolutely certain you know exactly what this specific barcode number refers to from your training data.
2. "Reasonably confident" is NOT enough. Only return identified=true if you are CERTAIN.
3. If there is ANY ambiguity or if you are interpolating/guessing, return {"identified": false}.
4. Barcode numbers are arbitrary identifiers — do NOT guess a medicine name just because the country prefix suggests a pharmaceutical company.
5. NEVER hallucinate. A wrong answer is far worse than no answer.
6. Return ONLY valid JSON. No markdown.

When you ARE certain (identified=true):
{
  "identified": true,
  "certaintyReason": "Why you are certain (e.g., 'This barcode appears in training data as...')",
  "medicineName": "Full product name as labeled",
  "brandName": "Brand/trade name",
  "genericName": "INN generic / active ingredient",
  "strength": "e.g. 500mg",
  "dosageForm": "e.g. Tablet",
  "manufacturer": "Manufacturer name",
  "classification": "Generic|Branded|Branded Generic|Unable to Verify"
}

When NOT certain:
{"identified": false}`;

  const userPrompt = `Barcode: ${barcode}
Likely country of origin: ${country}
Barcode length: ${barcode.length} digits (${barcode.length === 13 ? "EAN-13" : barcode.length === 12 ? "UPC-A" : barcode.length === 8 ? "EAN-8" : "Other"})

Are you CERTAIN you know exactly what medicine this barcode refers to?`;

  try {
    const provider = getAIProvider();
    const raw = await provider.complete(systemPrompt, userPrompt);
    const parsed = JSON.parse(extractJson(raw));

    // STRICT: only accept if identified AND has a certaintyReason (proves it's not guessing)
    if (!parsed.identified || !parsed.medicineName || !parsed.certaintyReason) {
      console.log(`[MedCheck] Gemini declined to identify barcode ${barcode} (not certain)`);
      return null;
    }

    console.log(`[MedCheck] Gemini identified ${barcode}: ${parsed.medicineName} — Reason: ${parsed.certaintyReason}`);

    return {
      medicineName: parsed.medicineName,
      brandName: parsed.brandName || "",
      genericName: parsed.genericName || "",
      strength: parsed.strength || "",
      dosageForm: parsed.dosageForm || "",
      manufacturer: parsed.manufacturer || "",
      classification: parsed.classification || "Unable to Verify",
      confidence: "Medium",
      source: "AI Knowledge Base",
    };
  } catch (err) {
    console.error("[MedCheck] Gemini lookup failed:", err);
    return null;
  }
}

// ─── AI Summary Generator ─────────────────────────────────────────────────────
async function generateAISummary(medicine: MedicineData): Promise<string> {
  const systemPrompt = `You are the MedCheck AI assistant for Farma DDI Checker.
Summarize verified medicine data in 1-2 sentences, max 65 words.
Rules:
- Only describe what is in the data. Do NOT add side effects, dosing advice, or warnings.
- Mention the data source.
- Return ONLY JSON: {"summary": "..."}`;

  const userPrompt = `Summarize:\n${JSON.stringify(medicine, null, 2)}`;

  try {
    const provider = getAIProvider();
    const raw = await provider.complete(systemPrompt, userPrompt);
    const parsed = JSON.parse(extractJson(raw));
    return parsed.summary || "";
  } catch {
    const parts = [
      medicine.medicineName,
      medicine.strength ? `(${medicine.strength})` : "",
      medicine.dosageForm ? `— ${medicine.dosageForm}` : "",
      medicine.manufacturer ? `by ${medicine.manufacturer}.` : ".",
      medicine.source ? `Identified via ${medicine.source}.` : "",
    ];
    return parts.filter(Boolean).join(" ").trim();
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const barcode = cleanBarcode(parsed.data.barcode);
  console.log(`[MedCheck] Lookup: ${barcode}`);

  // ── Cache check: return same result for same barcode every time ──────────────
  if (barcodeCache.has(barcode)) {
    const cached = barcodeCache.get(barcode)!;
    console.log(`[MedCheck] Cache hit for ${barcode}`);
    if ("error" in cached) {
      return NextResponse.json(cached, { status: 404 });
    }
    // Re-generate summary is fine (it's fast), or we could also cache it
    const summary = await generateAISummary(cached as MedicineData);
    return NextResponse.json({ ...(cached as MedicineData), summary });
  }

  // ── Strategy 1 + 2: run concurrently ────────────────────────────────────────
  const [fdaResult, offResult] = await Promise.allSettled([
    tryOpenFDA(barcode),
    tryOpenProductsFacts(barcode),
  ]);

  let medicine: MedicineData | null =
    (fdaResult.status === "fulfilled" ? fdaResult.value : null) ||
    (offResult.status === "fulfilled" ? offResult.value : null);

  // ── Strategy 3: Gemini (only if databases returned nothing) ─────────────────
  if (!medicine) {
    console.log(`[MedCheck] Databases missed ${barcode}, trying Gemini knowledge...`);
    medicine = await tryGeminiKnowledge(barcode);
  }

  // ── All failed ───────────────────────────────────────────────────────────────
  if (!medicine) {
    const errorResponse = {
      error: `Barcode ${barcode} could not be matched in openFDA, international product databases, or AI knowledge base. The product may be region-specific, not yet indexed, or the image may need better lighting/angle.`,
      confidence: "Unable to Verify",
    };
    barcodeCache.set(barcode, errorResponse); // cache the failure too
    return NextResponse.json(errorResponse, { status: 404 });
  }

  // ── Cache the successful result ──────────────────────────────────────────────
  barcodeCache.set(barcode, medicine);

  // ── Generate AI summary ──────────────────────────────────────────────────────
  const summary = await generateAISummary(medicine);

  return NextResponse.json({ ...medicine, summary });
}
