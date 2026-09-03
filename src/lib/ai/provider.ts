import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string): Promise<string>;
  readonly modelId: string;
}

/**
 * Real Gemini implementation. The API key is read from the server-side
 * env var only — it must never be sent to or read from the browser.
 */
export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  readonly modelId: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to your .env.local (see .env.example)."
      );
    }
    this.ai = new GoogleGenAI({ apiKey });
    // Use gemini-2.5-flash as the lightweight, low-cost model default
    this.modelId = process.env.AI_MODEL || "gemini-2.5-flash";
  }

  async complete(system: string, user: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.modelId,
      contents: user,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        temperature: 0,
      }
    });

    if (!response.text) {
      throw new Error("AI provider returned no text content.");
    }
    return response.text;
  }
}

let cachedProvider: AIProvider | null = null;

/** Swap this factory to point at a different provider without touching callers. */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = new GeminiProvider();
  }
  return cachedProvider;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
