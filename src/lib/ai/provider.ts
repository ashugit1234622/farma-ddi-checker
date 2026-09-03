import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export interface AIProvider {
  /** Sends a system + user prompt pair, expects back a raw JSON string. */
  complete(system: string, user: string): Promise<string>;
  readonly modelId: string;
}

/**
 * Groq implementation using the OpenAI-compatible SDK.
 */
export class GroqProvider implements AIProvider {
  private client: OpenAI;
  readonly modelId: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set.");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    // Use llama3-70b-8192 as 3.1 is decommissioned and 3.3 may not be available on all tiers
    this.modelId = process.env.AI_MODEL || "llama3-70b-8192";
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
      throw new Error("Groq returned no text content.");
    }
    return text;
  }
}

/**
 * Gemini implementation.
 */
export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;
  readonly modelId: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    this.ai = new GoogleGenAI({ apiKey });
    // Use gemini-2.5-flash (with the retry system handling any 503 spikes)
    this.modelId = "gemini-2.5-flash";
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
      throw new Error("Gemini returned no text content.");
    }
    return response.text;
  }
}

/**
 * Fallback provider that tries multiple providers in sequence with retries.
 */
export class FallbackProvider implements AIProvider {
  private providers: AIProvider[];
  
  constructor(providers: AIProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackProvider requires at least one provider.");
    }
    this.providers = providers;
  }

  // Uses the modelId of the primary (first) provider for reporting purposes
  get modelId() {
    return `Fallback Chain (Primary: ${this.providers[0].modelId})`;
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async complete(system: string, user: string): Promise<string> {
    let lastError: any;
    
    for (const provider of this.providers) {
      let retries = 2; // Try up to 3 times per provider
      while (retries >= 0) {
        try {
          console.log(`[AI] Attempting generation with ${provider.modelId}...`);
          const result = await provider.complete(system, user);
          console.log(`[AI] Success with ${provider.modelId}`);
          return result;
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[AI] Provider ${provider.modelId} failed:`, errMsg);
          lastError = err;
          
          // Only retry on rate limits or server overloads (429 or 503)
          if (retries > 0 && (errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand"))) {
            console.log(`[AI] Waiting 2 seconds before retrying ${provider.modelId}...`);
            await this.delay(2000);
            retries--;
          } else {
            // Unrecoverable error or out of retries, move to next provider
            break;
          }
        }
      }
    }
    
    throw new Error(`All AI providers failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
}

let cachedProvider: AIProvider | null = null;

/** 
 * Returns a FallbackProvider that tries Groq first, then Gemini if Groq fails or rate limits.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    const availableProviders: AIProvider[] = [];
    
    // Try to instantiate Groq
    try {
      availableProviders.push(new GroqProvider());
    } catch (e) {
      console.warn("GroqProvider skipped:", e instanceof Error ? e.message : String(e));
    }
    
    // Try to instantiate Gemini
    try {
      availableProviders.push(new GeminiProvider());
    } catch (e) {
      console.warn("GeminiProvider skipped:", e instanceof Error ? e.message : String(e));
    }
    
    if (availableProviders.length === 0) {
      throw new Error("No AI providers could be initialized. Please check your API keys (.env).");
    }
    
    cachedProvider = new FallbackProvider(availableProviders);
  }
  return cachedProvider;
}

/** Strips accidental markdown code fences some models add despite instructions. */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}
