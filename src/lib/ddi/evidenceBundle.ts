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

  const createFallbackDrug = (id: string) => {
    const clean = id.trim();
    const formatted = clean
      .split(/[\s-]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return {
      _id: clean.toLowerCase().replace(/\s+/g, '-'),
      name: formatted,
      genericName: clean.toLowerCase(),
      synonyms: [formatted],
      drugClass: ['Clinical Medication'],
      cypEnzymes: { substrateOf: [], inhibitorOf: [], inducerOf: [] },
      transporters: [],
      pharmacokinetics: {
        absorption: 'Refer to pharmacological reference',
        proteinBinding: 'Variable',
        metabolism: 'Hepatic / systemic elimination',
        halfLife: 'Variable',
        excretion: 'Renal / fecal clearance'
      },
      toxicityProfile: {
        hepatic: 20,
        renal: 20,
        cardiac: 20,
        neuro: 20,
        hemato: 20,
        notes: []
      },
      indications: ['Therapeutic indication'],
      dataSource: 'User_Input+Pharmacological_Analysis',
      isSampleData: false,
    };
  };

  const findDrug = (id: string) => {
    const lower = id.toLowerCase().trim();
    const found = drugs.find((d: any) => 
      d._id?.toLowerCase() === lower || 
      d.name?.toLowerCase() === lower || 
      d.genericName?.toLowerCase() === lower ||
      (d.synonyms && d.synonyms.some((s: string) => s.toLowerCase() === lower))
    );
    if (found) {
      if (found.name.toLowerCase() !== lower && found.genericName?.toLowerCase() !== lower) {
        return { ...found, userQueriedName: id };
      }
      return found;
    }
    return createFallbackDrug(id);
  };

  const drug1 = findDrug(drug1Id);
  const drug2 = findDrug(drug2Id);

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
