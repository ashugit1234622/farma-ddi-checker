import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAIProvider, extractJson } from "@/lib/ai/provider";
import { buildAasthaPrompt } from "@/lib/ai/prompts";
import { AasthaResponseSchema } from "@/lib/ai/schemas";

const AasthaRequestSchema = z.object({
  message: z.string().min(1),
  conversationHistory: z.array(z.object({
    role: z.string(),
    content: z.string()
  })),
  drugContext: z.object({
    drug1: z.string(),
    drug2: z.string()
  }).nullable().optional(),
  reportContext: z.record(z.string(), z.unknown()).nullable().optional()
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = AasthaRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", detail: parsed.error.issues },
      { status: 400 }
    );
  }

  const { message, conversationHistory, drugContext, reportContext } = parsed.data;

  try {
    const provider = getAIProvider();
    
    // Build the constrained prompt based on current context
    const prompt = buildAasthaPrompt(
      conversationHistory, 
      drugContext || null, 
      reportContext || null,
      message
    );

    // Call the provider. The prompt acts as both system instructions and context.
    const rawResponse = await provider.complete(
      "You are Aastha, an AI assistant for Farma DDI Checker. Output structured JSON only.", 
      prompt
    );

    // Parse and validate the response structure
    const parsedAiResponse = AasthaResponseSchema.parse(JSON.parse(extractJson(rawResponse)));

    return NextResponse.json({ data: parsedAiResponse });
  } catch (err) {
    console.error("[AASTHA API Error]:", err);
    return NextResponse.json(
      { error: "I couldn't generate a response right now. Please try again." },
      { status: 500 }
    );
  }
}
