import { NextRequest, NextResponse } from "next/server";
import { getAIProvider, extractJson } from "../../../lib/ai/provider";
import { z } from "zod";

const RequestSchema = z.object({
  barcode: z.string().min(1)
});

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

  const { barcode } = parsed.data;

  // 1. Fetch from openFDA
  // Searching by UPC, packaging NDC, or product NDC
  const fdaUrl = `https://api.fda.gov/drug/ndc.json?search=packaging.package_ndc:"${barcode}"+packaging.upc:"${barcode}"+product_ndc:"${barcode}"&limit=1`;
  
  try {
    const fdaRes = await fetch(fdaUrl);
    if (!fdaRes.ok) {
      if (fdaRes.status === 404) {
         return NextResponse.json({
           error: "No reliable medicine record was found for this barcode in the openFDA database.",
           confidence: "Unable to Verify"
         }, { status: 404 });
      }
      throw new Error(`FDA API responded with status ${fdaRes.status}`);
    }

    const fdaData = await fdaRes.json();
    if (!fdaData.results || fdaData.results.length === 0) {
      return NextResponse.json({
         error: "No reliable medicine record was found for this barcode.",
         confidence: "Unable to Verify"
      }, { status: 404 });
    }

    const result = fdaData.results[0];

    // 2. Format Structured Data
    const brandName = result.brand_name || result.proprietary_name || "";
    const genericName = result.generic_name || result.nonproprietary_name || "";
    
    let classification = "Unable to Verify";
    if (brandName && genericName) {
      if (brandName.toLowerCase() === genericName.toLowerCase()) {
        classification = "Generic";
      } else {
        // Simple heuristic: if labeler is known generic or it's just different, we call it Branded Generic or Branded
        // openFDA has 'application_number' which sometimes starts with ANDA (Abbreviated New Drug App) = Generic.
        if (result.application_number && result.application_number.startsWith("ANDA")) {
          classification = "Branded Generic";
        } else {
          classification = "Branded";
        }
      }
    }

    const strength = result.active_ingredients
      ? result.active_ingredients.map((a: any) => `${a.name} ${a.strength}`).join(", ")
      : "";

    const medicineName = brandName || genericName || "Unknown Medicine";
    const manufacturer = result.labeler_name || "";
    const dosageForm = result.dosage_form || "";

    const structuredData = {
      medicineName,
      brandName,
      genericName,
      strength,
      dosageForm,
      manufacturer,
      classification,
      confidence: "High", // Exact barcode match in FDA DB is high confidence
    };

    // 3. AI Summarization
    const systemPrompt = `You are the MedCheck AI assistant for Farma DDI Checker.
Your task is to summarize the verified medicine data provided in JSON format.
Rules:
- NEVER invent or hallucinate any medical information, uses, indications, or side effects.
- Explain the classification (e.g., why it's a generic or branded generic) briefly based ONLY on the provided data.
- Keep the summary strictly under 60 words.
- Return ONLY a JSON object with a single "summary" string field.`;

    const userPrompt = `Summarize this verified medicine data:
${JSON.stringify(structuredData, null, 2)}`;

    let aiSummary = "";
    try {
      const provider = getAIProvider();
      const rawAiResponse = await provider.complete(systemPrompt, userPrompt);
      const parsedAi = JSON.parse(extractJson(rawAiResponse));
      aiSummary = parsedAi.summary || "";
    } catch (aiErr) {
      console.error("AI Summary generation failed:", aiErr);
      aiSummary = "Data verified via openFDA database. AI summary currently unavailable.";
    }

    return NextResponse.json({
      ...structuredData,
      summary: aiSummary
    });

  } catch (err) {
    console.error("MedCheck API Error:", err);
    return NextResponse.json({ error: "An internal error occurred while verifying the medicine." }, { status: 500 });
  }
}
