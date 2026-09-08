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

// ─── Helper: clean barcode (strip spaces/dashes) ─────────────────────────────
function cleanBarcode(raw: string): string {
  return raw.replace(/[\s\-]/g, "").trim();
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

// ─── Strategy 2: Open Food Facts / Open Products Facts (international EAN) ───
async function tryOpenFoodFacts(barcode: string): Promise<MedicineData | null> {
  // Try both Open Food Facts and Open Beauty Facts (sometimes has OTC meds)
  const endpoints = [
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openproductsfacts.org/api/v2/product/${barcode}.json`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FarmaDDIChecker/1.0 (medicine safety app)" },
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

      // Filter: skip clearly non-medicine products (food without medicine keywords)
      const lowerName = (productName + genericName).toLowerCase();
      const medicineKeywords = [
        "tablet", "capsule", "syrup", "suspension", "injection", "cream", "ointment",
        "gel", "drops", "inhaler", "patch", "suppository", "solution", "mg", "ml",
        "paracetamol", "ibuprofen", "amoxicillin", "aspirin", "cetirizine", "metformin",
        "atorvastatin", "omeprazole", "antibiotic", "analgesic", "antifungal",
        "medicine", "pharmaceutical", "pharma", "drug", "medication"
      ];
      const isMedLike = medicineKeywords.some(k => lowerName.includes(k));
      if (!isMedLike && !p.categories_tags?.some((c: string) =>
        c.includes("medication") || c.includes("pharmaceutical") || c.includes("medicine"))) {
        continue;
      }

      const manufacturer = p.manufacturers || p.brands || "";
      const quantity = p.quantity || "";

      return {
        medicineName: productName || brandName || "Unknown Product",
        brandName,
        genericName: genericName || productName,
        strength: quantity,
        dosageForm: genericName || "",
        manufacturer,
        classification: brandName && genericName && brandName !== genericName ? "Branded" : "Generic",
        confidence: "Medium",
        source: "Open Products Database",
      };
    } catch { continue; }
  }
  return null;
}

// ─── Strategy 3: Gemini AI Knowledge Lookup ───────────────────────────────────
// Gemini has broad pharmaceutical training data and can identify medicines
// by barcode/NDC even outside FDA — used as a fallback with "Low" confidence label
async function tryGeminiKnowledge(barcode: string): Promise<MedicineData | null> {
  const systemPrompt = `You are a pharmaceutical identification expert with access to global drug databases and training knowledge.
A barcode has been scanned from a medicine packaging. Your task is to identify the medicine.

STRICT RULES:
1. Use your training knowledge about global EAN barcodes, UPC codes, NDC codes, and country-specific medicine registries.
2. Common barcodes to be aware of: South African (6009 prefix), Indian, European, etc.
3. If you can identify the medicine with reasonable certainty from the barcode, provide structured data.
4. If you have NO knowledge of this specific barcode, return {"identified": false}.
5. NEVER hallucinate or guess randomly. Only return data if you are reasonably confident.
6. Return ONLY valid JSON, no markdown.

JSON format when identified:
{
  "identified": true,
  "medicineName": "Full product name",
  "brandName": "Brand/trade name",
  "genericName": "INN/generic/active ingredient name",
  "strength": "e.g. 500mg, 250mg/5ml",
  "dosageForm": "e.g. Tablet, Capsule, Syrup",
  "manufacturer": "Manufacturer or labeler name",
  "classification": "Generic|Branded|Branded Generic|Unable to Verify",
  "confidence": "Medium|Low",
  "notes": "Brief note about the source of identification"
}`;

  const userPrompt = `Identify the medicine with this barcode: ${barcode}
Country prefix hint: ${barcode.startsWith("600") ? "South Africa (600-609 prefix)" : barcode.startsWith("890") ? "India (890 prefix)" : "Unknown region"}`;

  try {
    const provider = getAIProvider();
    const raw = await provider.complete(systemPrompt, userPrompt);
    const parsed = JSON.parse(extractJson(raw));

    if (!parsed.identified || !parsed.medicineName) return null;

    return {
      medicineName: parsed.medicineName || "Unknown Medicine",
      brandName: parsed.brandName || "",
      genericName: parsed.genericName || "",
      strength: parsed.strength || "",
      dosageForm: parsed.dosageForm || "",
      manufacturer: parsed.manufacturer || "",
      classification: parsed.classification || "Unable to Verify",
      confidence: parsed.confidence || "Low",
      source: `AI Knowledge (${parsed.notes || "training data"})`,
    };
  } catch {
    return null;
  }
}

// ─── Strategy 4: RxNorm lookup by name (if we got a name from above) ─────────
async function enrichWithRxNorm(name: string): Promise<{ rxcui?: string; tty?: string } | null> {
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const rxcui = data.idGroup?.rxnormId?.[0];
    return rxcui ? { rxcui } : null;
  } catch {
    return null;
  }
}

// ─── AI Summary Generator ─────────────────────────────────────────────────────
async function generateAISummary(medicine: MedicineData): Promise<string> {
  const systemPrompt = `You are the MedCheck AI assistant for Farma DDI Checker.
Summarize verified medicine data concisely.
Rules:
- Do NOT invent side effects, indications, or warnings not present in the data.
- Mention the data source briefly.
- Keep it under 65 words.
- Return ONLY JSON: {"summary": "..."}`;

  const userPrompt = `Summarize this medicine data:
${JSON.stringify(medicine, null, 2)}`;

  try {
    const provider = getAIProvider();
    const raw = await provider.complete(systemPrompt, userPrompt);
    const parsed = JSON.parse(extractJson(raw));
    return parsed.summary || "";
  } catch {
    return `${medicine.medicineName} identified via ${medicine.source || "database lookup"}. ${medicine.strength ? `Strength: ${medicine.strength}.` : ""} ${medicine.manufacturer ? `Made by ${medicine.manufacturer}.` : ""}`.trim();
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
  console.log(`[MedCheck] Looking up barcode: ${barcode}`);

  // Run Strategy 1 and 2 concurrently for speed
  const [fdaResult, offResult] = await Promise.allSettled([
    tryOpenFDA(barcode),
    tryOpenFoodFacts(barcode),
  ]);

  let medicine: MedicineData | null =
    (fdaResult.status === "fulfilled" ? fdaResult.value : null) ||
    (offResult.status === "fulfilled" ? offResult.value : null);

  // Strategy 3: Gemini AI knowledge lookup (only if databases failed)
  if (!medicine) {
    console.log(`[MedCheck] Databases returned nothing, trying AI knowledge lookup...`);
    medicine = await tryGeminiKnowledge(barcode);
  }

  // All strategies failed
  if (!medicine) {
    return NextResponse.json(
      {
        error: `This barcode (${barcode}) could not be matched in any of our databases (openFDA, international product databases, or AI knowledge base). The product may be region-specific, unlisted, or the barcode may be unreadable. Please try again with a clearer image.`,
        confidence: "Unable to Verify",
      },
      { status: 404 }
    );
  }

  // Generate AI summary
  const summary = await generateAISummary(medicine);

  return NextResponse.json({ ...medicine, summary });
}
