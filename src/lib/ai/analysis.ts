import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDatabase } from '../db';
import { AIProvider, DDIAnalysisInput } from './provider';
import { OpenAIProvider } from './openai-provider';
import { DDIAnalysis, DDIAnalysisSchema, QAResponse, QAResponseSchema } from './schemas';
import { PROMPT_VERSION } from './prompts';

let provider: AIProvider | null = null;

function getProvider(): AIProvider {
  if (provider) return provider;
  const name = process.env.AI_PROVIDER || 'openai';
  if (name === 'openai') {
    provider = new OpenAIProvider();
  } else {
    throw new Error(`Unknown AI provider: ${name}`);
  }
  return provider;
}

function hashBundle(bundle: DDIAnalysisInput): string {
  const str = JSON.stringify(bundle);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export async function runDDIAnalysis(
  drug1Id: string,
  drug2Id: string,
  bundle: DDIAnalysisInput
): Promise<{ analysis: DDIAnalysis; id: string; cached: boolean }> {
  const db = getDatabase();
  const bundleHash = hashBundle(bundle);

  // Check cache
  const cacheTTL = parseInt(process.env.CACHE_TTL_HOURS || '24', 10);
  const cached = db.prepare(`
    SELECT * FROM ai_analyses 
    WHERE drug1_id = ? AND drug2_id = ? AND evidence_bundle_hash = ? AND prompt_version = ?
    AND datetime(created_at, '+' || ? || ' hours') > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(drug1Id, drug2Id, bundleHash, PROMPT_VERSION, cacheTTL) as Record<string, string> | undefined;

  if (cached) {
    const result = DDIAnalysisSchema.parse(JSON.parse(cached.structured_result));
    return { analysis: result, id: cached.id, cached: true };
  }

  // Also check reverse order
  const cachedReverse = db.prepare(`
    SELECT * FROM ai_analyses 
    WHERE drug1_id = ? AND drug2_id = ? AND evidence_bundle_hash = ? AND prompt_version = ?
    AND datetime(created_at, '+' || ? || ' hours') > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(drug2Id, drug1Id, bundleHash, PROMPT_VERSION, cacheTTL) as Record<string, string> | undefined;

  if (cachedReverse) {
    const result = DDIAnalysisSchema.parse(JSON.parse(cachedReverse.structured_result));
    return { analysis: result, id: cachedReverse.id, cached: true };
  }

  // Run AI analysis
  const ai = getProvider();
  let analysis: DDIAnalysis;

  try {
    analysis = await ai.analyzeDrugInteraction(bundle);
  } catch (firstError) {
    // Retry once
    try {
      analysis = await ai.analyzeDrugInteraction(bundle);
    } catch {
      throw new Error(`AI analysis failed after retry: ${firstError}`);
    }
  }

  // Store result
  const id = uuidv4();
  db.prepare(`
    INSERT INTO ai_analyses (id, drug1_id, drug2_id, status, severity, confidence,
      executive_summary, structured_result, model, prompt_version, evidence_bundle_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, drug1Id, drug2Id, analysis.overallStatus, analysis.severity,
    analysis.confidence, analysis.executiveSummary, JSON.stringify(analysis),
    ai.name, PROMPT_VERSION, bundleHash
  );

  return { analysis, id, cached: false };
}

export async function askQuestion(
  analysisId: string,
  question: string,
  bundle: DDIAnalysisInput,
  previousAnalysis: DDIAnalysis
): Promise<QAResponse> {
  const ai = getProvider();
  let response: QAResponse;

  try {
    response = await ai.answerQuestion({ question, evidenceBundle: bundle, previousAnalysis });
  } catch {
    try {
      response = await ai.answerQuestion({ question, evidenceBundle: bundle, previousAnalysis });
    } catch (e) {
      throw new Error(`Q&A failed: ${e}`);
    }
  }

  // Store Q&A
  const db = getDatabase();
  db.prepare('INSERT INTO qa_history (id, analysis_id, question, answer) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), analysisId, question, JSON.stringify(response));

  return response;
}
