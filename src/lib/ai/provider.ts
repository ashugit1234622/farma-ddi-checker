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
    // Use llama-3.1-8b-instant as the supported and available free-tier model
    this.modelId = process.env.AI_MODEL || "llama-3.1-8b-instant";
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
  private envVarName: string;

  constructor(envVarName: string = "GEMINI_API_KEY") {
    this.envVarName = envVarName;
    const apiKey = process.env[envVarName];
    if (!apiKey) {
      throw new Error(`${envVarName} is not set.`);
    }
    this.ai = new GoogleGenAI({ apiKey });
    // Use gemini-2.5-flash (with the retry system handling any 503 spikes)
    this.modelId = `gemini-2.5-flash (${envVarName})`;
  }

  async complete(system: string, user: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
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
    const allErrors: string[] = [];
    
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
          
          // Only retry on rate limits or server overloads (429 or 503)
          if (retries > 0 && (errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand") || errMsg.includes("RESOURCE_EXHAUSTED"))) {
            console.log(`[AI] Waiting 2 seconds before retrying ${provider.modelId}...`);
            await this.delay(2000);
            retries--;
          } else {
            // Unrecoverable error or out of retries, record it and move to next provider
            allErrors.push(`[${provider.modelId}]: ${errMsg}`);
            break;
          }
        }
      }
    }
    
    throw new Error(`All AI providers failed.\nErrors:\n${allErrors.join('\n')}`);
  }
}

let cachedProvider: AIProvider | null = null;

/** 
 * Returns a FallbackProvider that tries providers sequentially.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    const availableProviders: AIProvider[] = [];
    
    // Groq is commented out as requested
    /*
    try {
      availableProviders.push(new GroqProvider());
    } catch (e) {
      console.warn("GroqProvider skipped:", e instanceof Error ? e.message : String(e));
    }
    */
    
    // Primary Gemini
    try {
      availableProviders.push(new GeminiProvider("GEMINI_API_KEY"));
    } catch (e) {
      console.warn("Primary GeminiProvider skipped:", e instanceof Error ? e.message : String(e));
    }

    // Secondary Gemini
    try {
      availableProviders.push(new GeminiProvider("GEMINI_API_KEY_SECONDARY"));
    } catch (e) {
      console.warn("Secondary GeminiProvider skipped:", e instanceof Error ? e.message : String(e));
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
