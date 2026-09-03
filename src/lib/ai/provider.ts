import OpenAI from "openai";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string): Promise<string>;
  readonly modelId: string;
}

/**
 * Groq implementation using the OpenAI-compatible SDK.
 * The API key is read from the server-side env var only.
 */
export class GroqProvider implements AIProvider {
  private client: OpenAI;
  readonly modelId: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not set. Add it to your .env or Render environment variables."
      );
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.modelId = process.env.AI_MODEL || "llama-3.1-70b-versatile";
  }

  async complete(system: string, user: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const text = response.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error("AI provider returned no text content.");
    }
    return text;
  }
}

let cachedProvider: AIProvider | null = null;

/** Swap this factory to point at a different provider without touching callers. */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new GroqProvider();
  }
  return cachedProvider;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
