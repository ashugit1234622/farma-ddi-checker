import { NextRequest, NextResponse } from "next/server";
import { getAIProvider, extractJson } from "../../../lib/ai/provider";
import { z } from "zod";

const RequestSchema = z.object({ barcode: z.string().min(1) });

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

// ─── Server-side cache ────────────────────────────────────────────────────────
const barcodeCache = new Map<string, MedicineData | { error: string; confidence: string }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MED_KEYWORDS = [
  "tablet", "capsule", "syrup", "suspension", "injection", "cream", "ointment",
  "gel", "drops", "inhaler", "patch", "suppository", "solution", "mg ", "mg,",
  "ml ", "paracetamol", "acetaminophen", "ibuprofen", "amoxicillin", "aspirin",
  "cetirizine", "metformin", "atorvastatin", "omeprazole", "chlorpheniramine",
  "diclofenac", "azithromycin", "ciprofloxacin", "metronidazole", "salbutamol",
  "prednisolone", "dexamethasone", "amlodipine", "losartan", "enalapril",
  "antibiotic", "analgesic", "antifungal", "antihistamine", "antacid",
  "medicine", "pharmaceutical", "pharma", "drug", "medication", "antiseptic",
];

function isMedicineProduct(name: string, categories: string[] = []): boolean {
  const lower = name.toLowerCase();
  if (MED_KEYWORDS.some(k => lower.includes(k))) return true;
  return categories.some(c =>
    ["medication", "pharmaceutical", "medicine", "drug", "health", "pharma"].some(k => c.includes(k))
  );
}

function buildMedicineData(
  medicineName: string, brandName: string, genericName: string,
  strength: string, dosageForm: string, manufacturer: string,
  classification: string, confidence: string, source: string
): MedicineData {
  return { medicineName, brandName, genericName, strength, dosageForm, manufacturer, classification, confidence, source };
}

function buildFallbackSummary(m: MedicineData): string {
  return [
    m.medicineName,
    m.strength ? `(${m.strength})` : "",
    m.dosageForm ? `— ${m.dosageForm}` : "",
    m.manufacturer ? `by ${m.manufacturer}.` : ".",
    m.genericName && m.genericName !== m.medicineName ? `Active ingredient: ${m.genericName}.` : "",
    m.source ? `Verified via ${m.source}.` : "",
  ].filter(Boolean).join(" ").trim();
}

// ─── QR / Barcode Scanner — extract all candidate identifiers ─────────────────
// QR codes may encode: plain numbers, URLs, GS1 Digital Links, or JSON.
// We extract every numeric candidate so each can be tried against all databases.
function extractCandidates(raw: string): { candidates: string[]; isUrl: boolean; productNameHint?: string } {
  const set = new Set<string>();
  const trimmed = raw.trim();
  let productNameHint: string | undefined;

  // Plain numeric barcode
  if (/^\d{6,14}$/.test(trimmed)) {
    set.add(trimmed);
    return { candidates: Array.from(set), isUrl: false };
  }

  const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://");

  if (isUrl) {
    try {
      const url = new URL(trimmed);

      // All numeric path segments 6-14 digits
      url.pathname.split("/").filter(Boolean).forEach(part => {
        const nums = part.replace(/[^\d]/g, "");
        if (nums.length >= 6 && nums.length <= 14) set.add(nums);
        // NDC with dashes e.g. 12345-678-90 → 1234567890
        const ndcNoDash = part.replace(/[^0-9\-]/g, "").replace(/-/g, "");
        if (ndcNoDash.length >= 6 && ndcNoDash.length <= 14) set.add(ndcNoDash);
      });

      // Query params: ?barcode=X, ?gtin=X, ?ndc=X, ?id=X, ?code=X
      url.searchParams.forEach((value, key) => {
        const numVal = value.replace(/[^\d]/g, "");
        if (numVal.length >= 6 && numVal.length <= 14) set.add(numVal);
        // Some sites put the product name in ?name= or ?product=
        if (["name", "product", "drug", "medicine"].includes(key.toLowerCase()) && value.length > 2) {
          productNameHint = value;
        }
      });

      // GS1 Digital Link GTIN: /01/GTIN14/
      const gs1 = url.pathname.match(/\/01\/(\d{8,14})/);
      if (gs1) set.add(gs1[1]);

      // Long numeric sequence anywhere in path
      const anyNum = url.pathname.match(/(\d{8,14})/g) || [];
      anyNum.forEach(n => set.add(n));

    } catch { /* invalid URL */ }
  }

  // Any numeric run 6-14 digits from the raw string
  const allNums = trimmed.match(/\d{6,14}/g) || [];
  allNums.forEach(n => set.add(n));

  return { candidates: Array.from(set), isUrl, productNameHint };
}

// ─── DB 1: openFDA NDC / UPC (US) ────────────────────────────────────────────
async function tryOpenFDA(barcode: string): Promise<MedicineData | null> {
  if (!/^\d/.test(barcode)) return null;
  const queries = [
    `packaging.package_ndc:"${barcode}"`,
    `product_ndc:"${barcode}"`,
    `packaging.upc:"${barcode}"`,
  ];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(q)}&limit=1`,
        { signal: AbortSignal.timeout(7000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;
      const r = data.results[0];
      const brand = r.brand_name || r.proprietary_name || "";
      const generic = r.generic_name || r.nonproprietary_name || "";
      const strength = r.active_ingredients
        ? r.active_ingredients.map((a: any) => `${a.name} ${a.strength}`).join(", ")
        : "";
      let cls = "Unable to Verify";
      if (brand && generic) {
        if (brand.toLowerCase() === generic.toLowerCase()) cls = "Generic";
        else if (r.application_number?.startsWith("ANDA")) cls = "Branded Generic";
        else cls = "Branded";
      }
      return buildMedicineData(brand || generic || "Unknown", brand, generic, strength,
        r.dosage_form || "", r.labeler_name || "", cls, "High", "openFDA (US)");
    } catch { continue; }
  }
  return null;
}

// ─── DB 2: DailyMed (NIH) — comprehensive US drug database ───────────────────
async function tryDailyMed(barcode: string): Promise<MedicineData | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  try {
    const res = await fetch(
      `https://dailymed.nlm.nih.gov/dailymed/services/v2/ndc/${barcode}.json`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const spl = data.data?.[0];
    if (!spl) return null;

    const title = spl.title || "";
    const setId = spl.setid || "";
    if (!title) return null;

    // DailyMed title looks like: "PARACETAMOL 500mg Tablet"
    // Extract brand from title (usually first word) and generic follows
    const parts = title.split(/\s+/);
    const brandName = parts[0] || title;

    return buildMedicineData(title, brandName, title, "", "", "",
      "Unable to Verify", "High", "DailyMed (NIH)");
  } catch {
    return null;
  }
}

// ─── DB 3: Open Products / Food / Beauty Facts (Global — EAN-13 / EAN-8) ──────
async function tryOpenProductsFacts(barcode: string): Promise<MedicineData | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  const endpoints = [
    `https://world.openproductsfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
    `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FarmaDDIChecker/1.0 (medicine-safety)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.status !== 1 || !data.product) continue;
      const p = data.product;
      const name = p.product_name_en || p.product_name || "";
      const brand = p.brands || "";
      const generic = p.generic_name_en || p.generic_name || "";
      if (!name && !brand) continue;
      // Accept any product found — the barcode was on a medicine box so trust the scan
      const cls = brand && generic && brand.toLowerCase() !== generic.toLowerCase() ? "Branded" : "Generic";
      return buildMedicineData(name || brand, brand, generic || name,
        p.quantity || "", generic || "", p.manufacturers || brand, cls, "High", "Open Products Database");
    } catch { continue; }
  }
  return null;
}

// ─── DB 4: RxNorm NDC lookup (US) ────────────────────────────────────────────
async function tryRxNorm(barcode: string): Promise<MedicineData | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  try {
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/ndcproperties.json?id=${barcode}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const props = data.ndcPropertyList?.ndcProperty?.[0];
    if (!props?.propertyConceptName) return null;
    const name = props.propertyConceptName;
    return buildMedicineData(name, "", name, "", "", "", "Generic", "High", "RxNorm (US)");
  } catch {
    return null;
  }
}

// ─── DB 5: Barcode List (barcode-list.com — global crowdsourced barcode DB) ────
// This is the #1 hit on Google for many international barcodes.
// We scrape the HTML meta tags to extract the product name.
async function tryBarcodeList(barcode: string): Promise<MedicineData | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  try {
    const url = `https://barcode-list.com/barcode/EN/Search.htm?barcode=${barcode}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract from meta description: "Barcode:XXX - This code meet the following products: PRODUCT NAME"
    const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1]
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1];
    
    // Extract from title: "PRODUCT NAME - Barcode: XXX"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i)?.[1];
    
    let productName = "";
    
    // Parse meta description first (more reliable)
    if (metaDesc) {
      const prodMatch = metaDesc.match(/products?:\s*(.+?)(?:;|$)/i);
      if (prodMatch) productName = prodMatch[1].trim();
    }
    
    // Fallback to title
    if (!productName && titleMatch) {
      productName = titleMatch.replace(/\s*-\s*Barcode:.*$/i, "").trim();
    }
    
    if (!productName || productName.length < 3) return null;
    
    // Parse the product name to extract brand, generic, strength, dosage form
    // Common format: "AUSTELL PARACETAMOL 10 TAB" or "PANADO PARACETAMOL 500MG TABLETS"
    const tokens = productName.split(/\s+/);
    let brand = "";
    let generic = "";
    let strength = "";
    let dosageForm = "";
    
    const dosageForms = ["TAB", "TABS", "TABLET", "TABLETS", "CAP", "CAPS", "CAPSULE", "CAPSULES",
      "SYR", "SYRUP", "INJ", "INJECTION", "CREAM", "OINTMENT", "GEL", "DROPS",
      "SUSP", "SUSPENSION", "SOL", "SOLUTION", "INHALER", "PATCH"];
    const strengthPattern = /^\d+(\.\d+)?\s*(mg|ml|mcg|g|iu|%)/i;
    
    for (const token of tokens) {
      const upper = token.toUpperCase();
      if (dosageForms.includes(upper)) {
        dosageForm = upper.charAt(0) + upper.slice(1).toLowerCase();
        if (dosageForm === "Tab" || dosageForm === "Tabs") dosageForm = "Tablet";
        if (dosageForm === "Cap" || dosageForm === "Caps") dosageForm = "Capsule";
        if (dosageForm === "Syr") dosageForm = "Syrup";
        if (dosageForm === "Inj") dosageForm = "Injection";
        if (dosageForm === "Susp") dosageForm = "Suspension";
        if (dosageForm === "Sol") dosageForm = "Solution";
      } else if (strengthPattern.test(token) || /^\d+$/.test(token)) {
        strength = strength ? `${strength} ${token}` : token;
      } else if (MED_KEYWORDS.some(k => token.toLowerCase().includes(k))) {
        generic = generic ? `${generic} ${token}` : token;
      } else if (!brand || brand.length < token.length) {
        // First unknown token = brand, subsequent = extend brand
        if (!generic) brand = brand ? `${brand} ${token}` : token;
      }
    }
    
    // If we found a known drug name in the product, use it as generic
    if (!generic) generic = productName;
    if (!brand) brand = tokens[0] || productName;
    
    const classification = brand && generic && brand.toLowerCase() !== generic.toLowerCase()
      ? "Branded" : "Generic";
    
    return buildMedicineData(
      productName, brand, generic, strength, dosageForm,
      "", classification, "High", "Barcode List (barcode-list.com)"
    );
  } catch (err) {
    console.error("[MedCheck] barcode-list.com scrape failed:", err);
    return null;
  }
}

// ─── DB 6: openFDA label search by generic name (name-based lookup) ───────────
// Used when we have a product name from a QR URL fetch but no barcode hit.
async function tryOpenFDAByName(name: string): Promise<MedicineData | null> {
  if (!name || name.length < 3) return null;
  // Extract the likely active ingredient (first meaningful word)
  const sanitized = name.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const queries = [
    `brand_name:"${sanitized}"`,
    `generic_name:"${sanitized}"`,
  ];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(q)}&limit=1`,
        { signal: AbortSignal.timeout(7000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;
      const r = data.results[0];
      const brand = r.brand_name || r.proprietary_name || "";
      const generic = r.generic_name || r.nonproprietary_name || "";
      const strength = r.active_ingredients
        ? r.active_ingredients.map((a: any) => `${a.name} ${a.strength}`).join(", ")
        : "";
      let cls = "Unable to Verify";
      if (brand && generic) {
        if (brand.toLowerCase() === generic.toLowerCase()) cls = "Generic";
        else if (r.application_number?.startsWith("ANDA")) cls = "Branded Generic";
        else cls = "Branded";
      }
      return buildMedicineData(brand || generic || name, brand, generic, strength,
        r.dosage_form || "", r.labeler_name || "", cls, "Medium", "openFDA (name match)");
    } catch { continue; }
  }
  return null;
}

// ─── DB 6: RxNorm name search ─────────────────────────────────────────────────
async function tryRxNormByName(name: string): Promise<MedicineData | null> {
  if (!name || name.length < 3) return null;
  try {
    const sanitized = name.replace(/[^a-zA-Z0-9 ]/g, "").trim().split(" ")[0]; // first word = INN
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(sanitized)}&search=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rxcui = data.idGroup?.rxnormId?.[0];
    if (!rxcui) return null;

    const propRes = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!propRes.ok) return null;
    const propData = await propRes.json();
    const rxName = propData.properties?.name || sanitized;
    const synonym = propData.properties?.synonym || "";

    return buildMedicineData(synonym || rxName, synonym, rxName, "", "",
      "", "Generic", "Medium", "RxNorm (name search)");
  } catch {
    return null;
  }
}

// ─── QR URL Fetcher ───────────────────────────────────────────────────────────
// Fetches the page a QR URL points to and extracts product name/info.
// Returns both structured data if possible AND a raw product name for further lookup.
async function fetchQRUrl(url: string): Promise<{ medicine?: MedicineData; productName?: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
        "Accept": "text/html,application/json",
      },
      signal: AbortSignal.timeout(9000),
      redirect: "follow",
    });
    if (!res.ok) return {};

    const ct = res.headers.get("content-type") || "";
    const hostname = new URL(url).hostname;

    // JSON response
    if (ct.includes("application/json")) {
      const d = await res.json();
      const name = d.productName || d.name || d.brand || d.product_name || d.title || "";
      const generic = d.genericName || d.ingredient || d.activeIngredient || "";
      if (name) {
        return {
          medicine: buildMedicineData(name, d.brandName || name, generic,
            d.strength || "", d.dosageForm || d.form || "",
            d.manufacturer || d.company || "", "Unable to Verify", "Medium",
            `QR Page (${hostname})`),
          productName: name,
        };
      }
    }

    // HTML response
    if (ct.includes("text/html")) {
      const html = await res.text();

      // schema.org Product
      const scripts = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
      for (const scriptBlock of scripts) {
        try {
          const jsonStr = scriptBlock.replace(/<\/?script[^>]*>/gi, "");
          const schema = JSON.parse(jsonStr);
          const schemas = Array.isArray(schema) ? schema : [schema];
          const prod = schemas.find((s: any) => s?.["@type"] === "Product" || s?.["@type"] === "Drug");
          if (prod?.name) {
            const name = prod.name || "";
            const brand = prod.brand?.name || prod.manufacturer?.name || "";
            const desc = (prod.description || "").substring(0, 100);
            return {
              medicine: buildMedicineData(name, brand || name, desc, "", "",
                brand, "Unable to Verify", "Medium", `QR Page (${hostname})`),
              productName: name,
            };
          }
        } catch { continue; }
      }

      // og:title
      const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1];
      const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1];
      const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1];

      const rawTitle = (ogTitle || titleTag || "").replace(/ [|\-–] .*$/, "").trim();
      const GENERIC_TITLES = ["home", "welcome", "index", "404", "error", "brand", "verify", "check", "authentication"];
      if (rawTitle.length > 3 && !GENERIC_TITLES.some(g => rawTitle.toLowerCase() === g)) {
        return {
          medicine: buildMedicineData(rawTitle, "", metaDesc?.substring(0, 80) || "",
            "", "", hostname, "Unable to Verify", "Low", `QR Page (${hostname})`),
          productName: rawTitle,
        };
      }
    }
  } catch { /* timeout or network error */ }
  return {};
}

// ─── AI Summary (Gemini — used ONLY for summary text, NOT for identification) ──
async function generateAISummary(medicine: MedicineData): Promise<string> {
  try {
    const provider = getAIProvider();
    const raw = await provider.complete(
      `You are MedCheck AI for Farma DDI Checker. Write a 1-2 sentence factual summary of the
verified medicine record below. Max 65 words. Do NOT add dosing advice, warnings, or side effects
not in the data. End with the data source. Return ONLY JSON: {"summary": "..."}`,
      `Summarize:\n${JSON.stringify(medicine, null, 2)}`
    );
    const parsed = JSON.parse(extractJson(raw));
    return parsed.summary || buildFallbackSummary(medicine);
  } catch {
    return buildFallbackSummary(medicine);
  }
}

// ─── AI Search Grounding (Phase 5 Fallback) ───────────────────────────────────
// Uses Gemini with Google Search Grounding to search the live web for the barcode.
// This prevents hallucinations while finding obscure international/regional drugs.
async function tryAISearchGrounding(rawScan: string, productNameHint?: string): Promise<MedicineData | null> {
  const query = productNameHint 
    ? `Look up the medicine "${productNameHint}" (barcode/QR: ${rawScan}) on the web.` 
    : `Look up medicine barcode ${rawScan} on the web.`;

  const system = `You are a medical data extraction API.
You MUST search the web to find the medicine corresponding to the user's query.
If you CANNOT find credible evidence of the medicine on the web, you MUST return {"identified": false}.
Do NOT guess or hallucinate.

Return ONLY JSON:
{
  "identified": true,
  "medicineName": "Full product name",
  "brandName": "Brand name if any",
  "genericName": "Active ingredient",
  "strength": "e.g., 500mg",
  "dosageForm": "e.g., Tablet",
  "manufacturer": "Company name",
  "classification": "Generic|Branded|Unable to Verify",
  "source": "Web Search (include domain name)"
}`;

  try {
    const provider = getAIProvider();
    const raw = await provider.complete(system, query, true); // true = useSearch
    const parsed = JSON.parse(extractJson(raw));
    
    if (!parsed.identified || !parsed.medicineName) return null;
    
    return buildMedicineData(
      parsed.medicineName,
      parsed.brandName || "",
      parsed.genericName || "",
      parsed.strength || "",
      parsed.dosageForm || "",
      parsed.manufacturer || "",
      parsed.classification || "Unable to Verify",
      "Medium",
      parsed.source || "AI Web Search"
    );
  } catch (err) {
    console.error("[MedCheck] AI Search Grounding failed:", err);
    return null;
  }
}

// ─── Main Lookup Orchestrator ─────────────────────────────────────────────────
async function lookupMedicine(candidates: string[], isUrl: boolean, rawScan: string): Promise<MedicineData | null> {

  // Phase 1: QR URL fetch (if it's a URL-type QR code)
  let productNameFromQR: string | undefined;
  if (isUrl) {
    const { medicine, productName } = await fetchQRUrl(rawScan);
    productNameFromQR = productName;
    // If the URL fetch returned structured data (not just a name), use it directly
    if (medicine && medicine.confidence !== "Low") return medicine;
  }

  // Phase 2: Run all numeric barcode candidates through ALL databases concurrently
  for (const candidate of candidates) {
    console.log(`[MedCheck] Trying candidate: "${candidate}"`);
    const [fda, daily, off, rxn, bcl] = await Promise.allSettled([
      tryOpenFDA(candidate),
      tryDailyMed(candidate),
      tryOpenProductsFacts(candidate),
      tryRxNorm(candidate),
      tryBarcodeList(candidate),
    ]);

    const result =
      (fda.status === "fulfilled" ? fda.value : null) ||
      (daily.status === "fulfilled" ? daily.value : null) ||
      (off.status === "fulfilled" ? off.value : null) ||
      (rxn.status === "fulfilled" ? rxn.value : null) ||
      (bcl.status === "fulfilled" ? bcl.value : null);

    if (result) return result;
  }

  // Phase 3: Name-based search (if we got a product name from the QR page)
  if (productNameFromQR) {
    console.log(`[MedCheck] Trying name-based search for: "${productNameFromQR}"`);
    const [byFDA, byRx] = await Promise.allSettled([
      tryOpenFDAByName(productNameFromQR),
      tryRxNormByName(productNameFromQR),
    ]);
    const nameResult =
      (byFDA.status === "fulfilled" ? byFDA.value : null) ||
      (byRx.status === "fulfilled" ? byRx.value : null);
    if (nameResult) return nameResult;
  }

  // Phase 4: AI Web Search Grounding (Live Internet Search)
  // If databases don't have it, we search the live web.
  console.log(`[MedCheck] Databases failed, trying AI Web Search for: "${rawScan}"`);
  const aiSearchResult = await tryAISearchGrounding(rawScan, productNameFromQR);
  if (aiSearchResult) return aiSearchResult;

  // Phase 5: QR Page Data Fallback (Last Resort)
  if (productNameFromQR) {
    const { medicine: qrMed } = await fetchQRUrl(rawScan);
    if (qrMed) return qrMed;
  }

  return null;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const rawScan = parsed.data.barcode.trim();
  const cacheKey = rawScan.toLowerCase();
  console.log(`[MedCheck] Lookup: ${rawScan}`);

  // Cache hit
  if (barcodeCache.has(cacheKey)) {
    const cached = barcodeCache.get(cacheKey)!;
    if ("error" in cached) return NextResponse.json(cached, { status: 404 });
    const summary = await generateAISummary(cached as MedicineData);
    return NextResponse.json({ ...(cached as MedicineData), summary });
  }

  const { candidates, isUrl } = extractCandidates(rawScan);
  console.log(`[MedCheck] Candidates: [${candidates.join(", ")}] | isUrl: ${isUrl}`);

  const medicine = await lookupMedicine(candidates, isUrl, rawScan);

  if (!medicine) {
    const label = isUrl ? `QR code "${rawScan}"` : `Barcode "${rawScan}"`;
    const errorResponse = {
      error: `${label} was not found in openFDA, DailyMed, Open Products Database, or RxNorm. The product may not yet be indexed in any public pharmaceutical database.`,
      confidence: "Unable to Verify",
    };
    barcodeCache.set(cacheKey, errorResponse);
    return NextResponse.json(errorResponse, { status: 404 });
  }

  barcodeCache.set(cacheKey, medicine);
  const summary = await generateAISummary(medicine);
  return NextResponse.json({ ...medicine, summary });
}
