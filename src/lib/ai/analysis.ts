import { getAIProvider, extractJson } from './provider';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from './prompts';
import { DDIAnalysisSchema, DDIAnalysis } from './schemas';

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

export class AIValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIValidationError';
  }
}

export async function runDDIAnalysis(
  drug1Id: string,
  drug2Id: string,
  bundle: any,
  options?: { forceRefresh?: boolean }
): Promise<{ analysis: DDIAnalysis; fromCache: boolean; model: string }> {
  // We are currently not utilizing a database cache to strictly mock the backend.
  // fromCache will always be false.
  
  const provider = getAIProvider();
  let raw: string;
  try {
    raw = await provider.complete(ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt(bundle));
  } catch (error) {
    throw new AIUnavailableError(`Failed to fetch from AI provider: ${error}`);
  }

  let analysis: DDIAnalysis;
  try {
    analysis = DDIAnalysisSchema.parse(JSON.parse(extractJson(raw)));
  } catch (error) {
    throw new AIValidationError(`AI returned invalid schema: ${error}`);
  }

  return { analysis, fromCache: false, model: provider.modelId };
}
