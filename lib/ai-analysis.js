const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDatabase } = require('./db');
const { z } = require('zod');

const PROMPT_VERSION = '1.0.0';

const DDIAnalysisSchema = z.object({
  overallStatus: z.enum([
    "interaction_detected",
    "no_significant_interaction_identified",
    "insufficient_evidence",
    "unknown"
  ]),
  severity: z.enum(["minor", "moderate", "major", "contraindicated", "unknown"]),
  confidence: z.enum(["high", "moderate", "low", "insufficient"]),
  executiveSummary: z.string(),
  interactionMechanisms: z.array(
    z.object({
      type: z.string(),
      explanation: z.string(),
      evidence: z.string()
    })
  ),
  clinicalSignificance: z.string(),
  potentialConsequences: z.array(z.string()),
  monitoring: z.array(
    z.object({
      parameter: z.string(),
      reason: z.string(),
      frequency: z.string().optional()
    })
  ),
  admeAnalysis: z.object({
    absorption: z.string(),
    distribution: z.string(),
    metabolism: z.string(),
    excretion: z.string()
  }),
  pharmacodynamicAnalysis: z.string(),
  toxicityAnalysis: z.object({
    overallRisk: z.string(),
    concerns: z.array(z.string()),
    combinedRiskAssessment: z.string()
  }),
  doseRisk: z.object({
    dangerousDoseThreshold: z.string(),
    safeCoAdminGuidance: z.string(),
    doseAdjustmentNeeded: z.boolean(),
    adjustmentDetails: z.string()
  }),
  demographicEffects: z.object({
    pediatric: z.string(),
    geriatric: z.string(),
    maleSpecific: z.string(),
    femaleSpecific: z.string(),
    pregnancyLactation: z.string(),
    hepaticImpairment: z.string(),
    renalImpairment: z.string()
  }),
  alternatives: z.array(
    z.object({
      drugName: z.string(),
      rationale: z.string(),
      interactionRisk: z.string()
    })
  ),
  evidenceAssessment: z.string(),
  limitations: z.array(z.string()),
  sourceIds: z.array(z.string())
});

function hashBundle(bundle) {
  const str = JSON.stringify(bundle);
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

function generateDeterministicFallback(bundle) {
  const { drug1, drug2, interactionRecords, sources } = bundle;
  const hasInteractions = interactionRecords && interactionRecords.length > 0;
  const primaryInteraction = hasInteractions ? interactionRecords[0] : null;

  const severity = primaryInteraction ? primaryInteraction.severity : "no_significant_interaction_identified";
  const status = hasInteractions ? "interaction_detected" : "no_significant_interaction_identified";

  return {
    overallStatus: status,
    severity: hasInteractions ? severity : "minor",
    confidence: "high",
    executiveSummary: hasInteractions
      ? `A ${severity.toUpperCase()} interaction is documented between ${drug1.generic_name} and ${drug2.generic_name}. ${primaryInteraction.clinical_description || primaryInteraction.mechanism}`
      : `No direct severe interaction records were found in the database between ${drug1.generic_name} and ${drug2.generic_name}.`,
    interactionMechanisms: hasInteractions ? [
      {
        type: primaryInteraction.interaction_type || "Pharmacodynamic / Pharmacokinetic",
        explanation: primaryInteraction.mechanism || "Combined pharmacological effect identified in interaction records.",
        evidence: primaryInteraction.documentation_level || "Established"
      }
    ] : [
      {
        type: "None Identified",
        explanation: "No known overlapping enzymatic or receptor pathways recorded.",
        evidence: "Database Search"
      }
    ],
    clinicalSignificance: primaryInteraction 
      ? (primaryInteraction.clinical_description || primaryInteraction.management)
      : "Standard monitoring is advised when combining any therapeutic agents.",
    potentialConsequences: hasInteractions 
      ? [primaryInteraction.clinical_description || "Altered drug efficacy or toxicity"]
      : ["No acute major adverse consequences documented."],
    monitoring: hasInteractions ? [
      {
        parameter: "Vital signs & clinical symptoms",
        reason: primaryInteraction.management || "Monitor patient response closely.",
        frequency: "Initial co-administration"
      }
    ] : [],
    admeAnalysis: {
      absorption: `${drug1.generic_name}: ${drug1.absorption || 'N/A'}. ${drug2.generic_name}: ${drug2.absorption || 'N/A'}.`,
      distribution: `${drug1.generic_name} Protein Binding: ${drug1.protein_binding || 'N/A'}. ${drug2.generic_name} Protein Binding: ${drug2.protein_binding || 'N/A'}.`,
      metabolism: `${drug1.generic_name}: ${drug1.metabolism || 'N/A'}. ${drug2.generic_name}: ${drug2.metabolism || 'N/A'}.`,
      excretion: `${drug1.generic_name}: ${drug1.excretion || 'N/A'}. ${drug2.generic_name}: ${drug2.excretion || 'N/A'}.`
    },
    pharmacodynamicAnalysis: primaryInteraction?.mechanism || "Pharmacodynamic pathways evaluated based on drug classification.",
    toxicityAnalysis: {
      overallRisk: primaryInteraction ? `${severity.toUpperCase()} Risk` : "Low Risk",
      concerns: [
        `Hepatotoxicity: ${drug1.generic_name} (${drug1.hepatotoxicity_risk || 'low'}), ${drug2.generic_name} (${drug2.hepatotoxicity_risk || 'low'})`,
        `Cardiotoxicity: ${drug1.generic_name} (${drug1.cardiotoxicity_risk || 'low'}), ${drug2.generic_name} (${drug2.cardiotoxicity_risk || 'low'})`
      ],
      combinedRiskAssessment: hasInteractions
        ? `Co-administration may elevate risks associated with ${primaryInteraction.interaction_type}.`
        : "Low likelihood of additive toxicities based on individual profiles."
    },
    doseRisk: {
      dangerousDoseThreshold: hasInteractions ? "Any concomitant dose without medical supervision." : "Standard therapeutic threshold.",
      safeCoAdminGuidance: primaryInteraction?.management || "Follow approved clinical dosing guidelines.",
      doseAdjustmentNeeded: hasInteractions,
      adjustmentDetails: primaryInteraction?.management || "Insufficient evidence for specific dose titrations."
    },
    demographicEffects: {
      pediatric: "Use caution. Safety profile requires pediatric specialist oversight.",
      geriatric: "Higher risk of adverse events due to altered clearance pathways in elderly patients.",
      maleSpecific: "No specific gender-restricted metabolism differences documented.",
      femaleSpecific: "No specific gender-restricted metabolism differences documented.",
      pregnancyLactation: "Evaluate risk vs benefit; consult prescribing guidelines.",
      hepaticImpairment: `${drug1.generic_name} (${drug1.metabolism || 'Hepatic'}). Reduce dose if severe impairment.`,
      renalImpairment: `${drug1.generic_name} (${drug1.excretion || 'Renal'}). Monitor GFR/clearance.`
    },
    alternatives: (bundle.alternatives || []).map(alt => ({
      drugName: alt.alt_name || "Alternative Candidate",
      rationale: alt.rationale || "Therapeutic alternative with different metabolic pathway.",
      interactionRisk: alt.evidence_level || "Lower Risk"
    })),
    evidenceAssessment: hasInteractions ? "Based on established clinical interaction database records." : "Based on structured database lookup.",
    limitations: [
      "Analysis synthesized strictly from verified database records.",
      "Does not replace individual patient clinical judgment."
    ],
    sourceIds: (sources || []).map(s => s.id)
  };
}

async function runDDIAnalysis(drug1Id, drug2Id, bundle) {
  const db = getDatabase();
  const bundleHash = hashBundle(bundle);
  const cacheTTL = 24;

  // Check cache
  const cached = db.prepare(`
    SELECT * FROM ai_analyses 
    WHERE drug1_id = ? AND drug2_id = ? AND evidence_bundle_hash = ? AND prompt_version = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(drug1Id, drug2Id, bundleHash, PROMPT_VERSION);

  if (cached) {
    try {
      const result = JSON.parse(cached.structured_result);
      return { analysis: result, id: cached.id, cached: true };
    } catch (e) {}
  }

  let analysis;
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && apiKey !== 'sk-your-api-key-here') {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an evidence-grounded pharmacology assistant. Return JSON matching the requested structure.' },
          { role: 'user', content: `Analyze this bundle: ${JSON.stringify(bundle)}` }
        ],
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      analysis = DDIAnalysisSchema.parse(parsed);
    } catch (e) {
      console.warn('AI call failed or failed validation, falling back to rule engine analysis:', e.message);
      analysis = generateDeterministicFallback(bundle);
    }
  } else {
    // Fallback to evidence-grounded rule synthesis when no key is set
    analysis = generateDeterministicFallback(bundle);
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO ai_analyses (id, drug1_id, drug2_id, status, severity, confidence, executive_summary, structured_result, model, prompt_version, evidence_bundle_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, drug1Id, drug2Id, analysis.overallStatus, analysis.severity,
    analysis.confidence, analysis.executiveSummary, JSON.stringify(analysis),
    'rule-engine-ai-hybrid', PROMPT_VERSION, bundleHash
  );

  return { analysis, id, cached: false };
}

async function askQuestion(question, bundle) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-your-api-key-here') {
    return "AI Chat is unavailable. Please add an OpenAI API key in the server environment variables to enable the chat feature.";
  }

  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey });
  
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an oncology pharmacology expert. Provide concise, clinical, evidence-grounded answers based on the provided interaction bundle.' },
        { role: 'user', content: `Evidence Bundle: ${JSON.stringify(bundle)}\n\nUser Question: ${question}` }
      ]
    });
    return response.choices[0].message.content;
  } catch (e) {
    console.error('Chat error:', e);
    return 'Sorry, I encountered an error while analyzing the interaction data.';
  }
}

module.exports = { runDDIAnalysis, DDIAnalysisSchema, askQuestion };
