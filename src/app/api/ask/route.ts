import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildEvidenceBundle, DrugNotFoundError } from "../../../lib/ddi/evidenceBundle";
import { getAIProvider, extractJson } from "../../../lib/ai/provider";
import { ASK_SYSTEM_PROMPT } from "../../../lib/ai/prompts";
import { ConstrainedAnswerSchema } from "../../../lib/ai/schemas";
import { findSharedCypSignal } from "../../../lib/ddi/ruleEngine";

const RequestSchema = z.object({
  drug1Id: z.string().min(1),
  drug2Id: z.string().min(1),
  question: z.string().min(1).max(500),
});

const FALLBACK_ANSWER =
  "The available evidence in this analysis does not establish an answer to that question.";

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

  const { drug1Id, drug2Id, question } = parsed.data;

  let bundle;
  try {
    bundle = await buildEvidenceBundle(drug1Id, drug2Id);
  } catch (err) {
    if (err instanceof DrugNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not load drug data." }, { status: 503 });
  }

  try {
    const provider = getAIProvider();
    const cypSignals = findSharedCypSignal(bundle.drug1, bundle.drug2);
    const userPrompt = JSON.stringify(
      { question, evidenceBundle: bundle, cypSignals },
      null,
      2
    );

    const raw = await provider.complete(ASK_SYSTEM_PROMPT, userPrompt);
    const parsedAnswer = ConstrainedAnswerSchema.safeParse(JSON.parse(extractJson(raw)));

    if (!parsedAnswer.success) {
      return NextResponse.json({ answerable: false, answer: FALLBACK_ANSWER, sourceIds: [] });
    }

    return NextResponse.json(parsedAnswer.data);
  } catch (err) {
    return NextResponse.json(
      { answerable: false, answer: "The AI service is currently unavailable. Please try again.", sourceIds: [] },
      { status: 200 }
    );
  }
}
