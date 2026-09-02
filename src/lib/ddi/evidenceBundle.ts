import fs from 'fs';
import path from 'path';
import { findSharedCypSignal } from './ruleEngine';

export class DrugNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrugNotFoundError';
  }
}

let drugsCache: any[] | null = null;

function loadDrugs(): any[] {
  if (drugsCache) return drugsCache;
  const filePath = path.join(process.cwd(), 'data', 'seed.json');
  drugsCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return drugsCache || [];
}

export async function buildEvidenceBundle(drug1Id: string, drug2Id: string) {
  const drugs = loadDrugs();

  const drug1 = drugs.find((d: any) => d._id === drug1Id);
  const drug2 = drugs.find((d: any) => d._id === drug2Id);

  if (!drug1) throw new DrugNotFoundError(`Drug not found: ${drug1Id}`);
  if (!drug2) throw new DrugNotFoundError(`Drug not found: ${drug2Id}`);

  // Deterministic CYP signal analysis
  const cypSignals = findSharedCypSignal(drug1, drug2);

  return {
    drug1,
    drug2,
    cypSignals,
    drug1Pharmacokinetics: drug1.pharmacokinetics,
    drug2Pharmacokinetics: drug2.pharmacokinetics,
    drug1ToxicityProfile: drug1.toxicityProfile,
    drug2ToxicityProfile: drug2.toxicityProfile,
    drug1CypEnzymes: drug1.cypEnzymes,
    drug2CypEnzymes: drug2.cypEnzymes,
    drug1Transporters: drug1.transporters,
    drug2Transporters: drug2.transporters,
  };
}
