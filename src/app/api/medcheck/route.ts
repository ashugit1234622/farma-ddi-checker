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

// ─── Server-side cache (persistent within one server process) ─────────────────
// Prevents redundant API calls for the same barcode within a session.
const barcodeCache = new Map<string, MedicineData | { error: string; confidence: string }>();

function cleanBarcode(raw: string): string {
  return raw.replace(/[\s\-]/g, "").trim();
}

// ─── Strategy 1: openFDA (US NDC / UPC) ──────────────────────────────────────
async function tryOpenFDA(barcode: string): Promise<MedicineData | null> {
  const queries = [
    `packaging.package_ndc:"${barcode}"`,
    `product_ndc:"${barcode}"`,
    `packaging.upc:"${barcode}"`,
  ];

  for (const q of queries) {
    try {
      const url = `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
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

// ─── Strategy 2: Open Products Facts (international EAN-13/EAN-8) ─────────────
// This is the primary source for non-US barcodes (South African, Indian, EU, etc.)
// The database is crowd-sourced and deterministic — same barcode always returns same data.
async function tryOpenProductsFacts(barcode: string): Promise<MedicineData | null> {
  const endpoints = [
    `https://world.openproductsfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FarmaDDIChecker/1.0 (medicine-safety-tool)" },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== 1 || !data.product) continue;

      const p = data.product;
      const productName = p.product_name_en || p.product_name || "";
      const brandName = p.brands || "";
      const genericName = p.generic_name_en || p.generic_name || "";

      if (!productName && !brandName) continue;

      // Only include if it looks like a medicine/pharmaceutical product
      const lowerName = `${productName} ${genericName}`.toLowerCase();
      const medicineKeywords = [
        "tablet", "capsule", "syrup", "suspension", "injection", "cream", "ointment",
        "gel", "drops", "inhaler", "patch", "suppository", "solution", "mg", "ml",
        "paracetamol", "acetaminophen", "ibuprofen", "amoxicillin", "aspirin",
        "cetirizine", "metformin", "atorvastatin", "omeprazole", "chlorpheniramine",
        "antibiotic", "analgesic", "antifungal", "medicine", "pharmaceutical",
        "pharma", "drug", "medication", "lotion", "ointment", "antiseptic",
      ];
      const hasMedKeyword = medicineKeywords.some(k => lowerName.includes(k));
      const hasMedCategory = p.categories_tags?.some((c: string) =>
        ["medication", "pharmaceutical", "medicine", "drug", "health"].some(k => c.includes(k)));

      if (!hasMedKeyword && !hasMedCategory) continue;

      const manufacturer = p.manufacturers || p.brands || "";

      return {
        medicineName: productName || brandName || "Unknown Product",
        brandName,
        genericName: genericName || productName,
        strength: p.quantity || "",
        dosageForm: genericName || "",
        manufacturer,
        classification: brandName && genericName && brandName.toLowerCase() !== genericName.toLowerCase()
          ? "Branded"
          : "Generic",
        confidence: "High",
        source: "Open Products Database",
      };
    } catch { continue; }
  }
  return null;
}

// ─── Strategy 3: RxNorm lookup by partial barcode → product name match ─────────
// Tries to match the barcode against RxNorm's NDC index as a last database resort.
async function tryRxNorm(barcode: string): Promise<MedicineData | null> {
  try {
    // RxNorm NDC lookup
    const url = `https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id=${barcode}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();

    const props = data.ndcPropertyList?.ndcProperty?.[0];
    if (!props) return null;

    const medicineName = props.propertyConceptName || "";
    if (!medicineName) return null;

    // Get more details from RxNorm concept
    const rxcui = props.rxcui;
    let genericName = medicineName;
    let strength = "";
    let dosageForm = "";

    if (rxcui) {
      try {
        const propRes = await fetch(
          `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (propRes.ok) {
          const propData = await propRes.json();
          const rxProps = propData.properties;
          genericName = rxProps?.synonym || rxProps?.name || medicineName;
          dosageForm = rxProps?.tty || "";
        }
      } catch { /* ignore */ }
    }

    return {
      medicineName,
      brandName: "",
      genericName,
      strength,
      dosageForm,
      manufacturer: "",
      classification: "Generic",
      confidence: "High",
      source: "RxNorm",
    };
  } catch {
    return null;
  }
}

// ─── AI Summary Generator (Gemini used ONLY for text, not identification) ──────
// Gemini is intentionally NOT used to identify barcodes — it has no reliable
// barcode registry and produces inconsistent/hallucinated results.
// It is ONLY used here to generate a natural-language summary of data already
// confirmed by a deterministic database.
async function generateAISummary(medicine: MedicineData): Promise<string> {
  const systemPrompt = `You are the MedCheck AI assistant for Farma DDI Checker.
Write a 1-2 sentence summary of the verified medicine data. Max 65 words.
ONLY describe what is in the provided data. Do NOT add dosing advice, warnings, or side effects.
Mention the data source at the end.
Return ONLY JSON: {"summary": "..."}`;

  const userPrompt = `Summarize this verified medicine record:\n${JSON.stringify(medicine, null, 2)}`;

  try {
    const provider = getAIProvider();
    const raw = await provider.complete(systemPrompt, userPrompt);
    const parsed = JSON.parse(extractJson(raw));
    return parsed.summary || buildFallbackSummary(medicine);
  } catch {
    return buildFallbackSummary(medicine);
  }
}

function buildFallbackSummary(m: MedicineData): string {
  const parts = [
    m.medicineName,
    m.strength ? `(${m.strength})` : "",
    m.dosageForm ? `— ${m.dosageForm}` : "",
    m.manufacturer ? `by ${m.manufacturer}.` : ".",
    m.genericName && m.genericName !== m.medicineName
      ? `Active ingredient: ${m.genericName}.`
      : "",
    m.source ? `Identified via ${m.source}.` : "",
  ];
  return parts.filter(Boolean).join(" ").trim();
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

  // ── Cache check ──────────────────────────────────────────────────────────────
  if (barcodeCache.has(barcode)) {
    const cached = barcodeCache.get(barcode)!;
    console.log(`[MedCheck] Cache hit for ${barcode}`);
    if ("error" in cached) {
      return NextResponse.json(cached, { status: 404 });
    }
    const summary = await generateAISummary(cached as MedicineData);
    return NextResponse.json({ ...(cached as MedicineData), summary });
  }

  // ── Strategy 1 + 2 concurrently, Strategy 3 sequentially if needed ──────────
  const [fdaResult, offResult] = await Promise.allSettled([
    tryOpenFDA(barcode),
    tryOpenProductsFacts(barcode),
  ]);

  let medicine: MedicineData | null =
    (fdaResult.status === "fulfilled" ? fdaResult.value : null) ||
    (offResult.status === "fulfilled" ? offResult.value : null);

  // Strategy 3: RxNorm (US-focused, but deterministic)
  if (!medicine) {
    medicine = await tryRxNorm(barcode);
  }

  // ── All deterministic databases failed ───────────────────────────────────────
  // NOTE: We intentionally do NOT fall back to Gemini AI for identification.
  // Gemini has no reliable barcode lookup table and produces different, often
  // hallucinated drug names on each call — making results inconsistent.
  if (!medicine) {
    const errorResponse = {
      error: `Barcode "${barcode}" was not found in openFDA, Open Products Database, or RxNorm. This may be a regional product not yet indexed. Try scanning in better lighting or check if the barcode is printed clearly.`,
      confidence: "Unable to Verify",
    };
    barcodeCache.set(barcode, errorResponse);
    return NextResponse.json(errorResponse, { status: 404 });
  }

  // ── Cache and return ─────────────────────────────────────────────────────────
  barcodeCache.set(barcode, medicine);
  const summary = await generateAISummary(medicine);
  return NextResponse.json({ ...medicine, summary });
}
