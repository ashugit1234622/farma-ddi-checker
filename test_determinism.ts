import { getAIProvider } from './src/lib/ai/provider';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from './src/lib/ai/prompts';
import { buildEvidenceBundle } from './src/lib/ddi/evidenceBundle';

async function test() {
  const bundle = await buildEvidenceBundle('dopamine', 'oxytocin');
  const provider = getAIProvider();
  
  console.log("Running analysis 1...");
  const raw1 = await provider.complete(ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt(bundle));
  const s1 = JSON.parse(raw1.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim()).severity;
  
  console.log("Running analysis 2...");
  const raw2 = await provider.complete(ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt(bundle));
  const s2 = JSON.parse(raw2.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim()).severity;
  
  console.log(`Result 1: ${s1}`);
  console.log(`Result 2: ${s2}`);
  console.log(`Match? ${s1 === s2}`);
}

test().catch(console.error);
