import { DDIAnalysis, QAResponse } from './schemas';

export interface DDIAnalysisInput {
  drug1: Record<string, unknown>;
  drug2: Record<string, unknown>;
  interactionRecords: Record<string, unknown>[];
  drug1Enzymes: Record<string, unknown>[];
  drug2Enzymes: Record<string, unknown>[];
  drug1Transporters: Record<string, unknown>[];
  drug2Transporters: Record<string, unknown>[];
  alternatives: Record<string, unknown>[];
  sources: Record<string, unknown>[];
}

export interface QAInput {
  question: string;
  evidenceBundle: DDIAnalysisInput;
  previousAnalysis: DDIAnalysis;
}

export interface AIProvider {
  name: string;
  analyzeDrugInteraction(input: DDIAnalysisInput): Promise<DDIAnalysis>;
  answerQuestion(input: QAInput): Promise<QAResponse>;
}
