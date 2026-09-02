import { z } from 'zod';

export const InteractionMechanismSchema = z.object({
  type: z.string(),
  explanation: z.string(),
  evidence: z.string(),
});

export const MonitoringItemSchema = z.object({
  parameter: z.string(),
  reason: z.string(),
  frequency: z.string().optional(),
});

export const AlternativeSchema = z.object({
  drugName: z.string(),
  rationale: z.string(),
  interactionRisk: z.string(),
});

export const ADMEAnalysisSchema = z.object({
  absorption: z.string(),
  distribution: z.string(),
  metabolism: z.string(),
  excretion: z.string(),
});

export const ADMEScoresSchema = z.object({
  drug1: z.object({
    absorption: z.number(),
    distribution: z.number(),
    metabolism: z.number(),
    excretion: z.number(),
  }),
  drug2: z.object({
    absorption: z.number(),
    distribution: z.number(),
    metabolism: z.number(),
    excretion: z.number(),
  }),
});

export const ToxicityAnalysisSchema = z.object({
  overallRisk: z.string(),
  concerns: z.array(z.string()),
  combinedRiskAssessment: z.string(),
});

export const ToxicityScoresSchema = z.object({
  drug1: z.object({
    hepatic: z.number(),
    renal: z.number(),
    cardiac: z.number(),
    neuro: z.number(),
    hemato: z.number(),
  }),
  drug2: z.object({
    hepatic: z.number(),
    renal: z.number(),
    cardiac: z.number(),
    neuro: z.number(),
    hemato: z.number(),
  }),
});

export const DoseRiskSchema = z.object({
  dangerousDoseThreshold: z.string(),
  safeCoAdminGuidance: z.string(),
  doseAdjustmentNeeded: z.boolean(),
  adjustmentDetails: z.string(),
});

export const DemographicEffectSchema = z.object({
  pediatric: z.string(),
  geriatric: z.string(),
  maleSpecific: z.string(),
  femaleSpecific: z.string(),
  pregnancyLactation: z.string(),
  hepaticImpairment: z.string(),
  renalImpairment: z.string(),
});

export const DDIAnalysisSchema = z.object({
  overallStatus: z.enum([
    'interaction_detected',
    'no_significant_interaction_identified',
    'insufficient_evidence',
    'unknown',
  ]),
  severity: z.enum(['minor', 'moderate', 'major', 'contraindicated', 'unknown']),
  confidence: z.enum(['high', 'moderate', 'low', 'insufficient']),
  executiveSummary: z.string(),
  interactionMechanisms: z.array(InteractionMechanismSchema),
  clinicalSignificance: z.string(),
  potentialConsequences: z.array(z.string()),
  monitoring: z.array(MonitoringItemSchema),
  admeAnalysis: ADMEAnalysisSchema,
  admeScores: ADMEScoresSchema,
  pharmacodynamicAnalysis: z.string(),
  toxicityAnalysis: ToxicityAnalysisSchema,
  toxicityScores: ToxicityScoresSchema,
  doseRisk: DoseRiskSchema,
  demographicEffects: DemographicEffectSchema,
  alternatives: z.array(AlternativeSchema),
  evidenceAssessment: z.string(),
  limitations: z.array(z.string()),
  sourceIds: z.array(z.string()),
});

export type DDIAnalysis = z.infer<typeof DDIAnalysisSchema>;
export type InteractionMechanism = z.infer<typeof InteractionMechanismSchema>;
export type MonitoringItem = z.infer<typeof MonitoringItemSchema>;
export type Alternative = z.infer<typeof AlternativeSchema>;

export const QAResponseSchema = z.object({
  answer: z.string(),
  confidence: z.enum(['high', 'moderate', 'low', 'insufficient']),
  basedOnEvidence: z.boolean(),
  relevantSections: z.array(z.string()),
});

export type QAResponse = z.infer<typeof QAResponseSchema>;

export const ConstrainedAnswerSchema = z.object({
  answerable: z.boolean(),
  answer: z.string(),
  sourceIds: z.array(z.string()),
});
