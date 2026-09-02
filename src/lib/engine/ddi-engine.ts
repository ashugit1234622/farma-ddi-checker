import { getDatabase } from '../db';
export interface DrugRecord {
  id: string;
  generic_name: string;
  brand_names: string;
  drug_class: string;
  sub_class: string;
  description: string;
  mechanism_of_action: string;
  indications: string;
  contraindications: string;
  absorption: string;
  bioavailability: string;
  distribution: string;
  protein_binding: string;
  volume_of_distribution: string;
  metabolism: string;
  half_life: string;
  excretion: string;
  clearance: string;
  typical_dose_range: string;
  max_daily_dose: string;
  dose_adjustments: string;
  hepatotoxicity_risk: string;
  nephrotoxicity_risk: string;
  cardiotoxicity_risk: string;
  neurotoxicity_risk: string;
  hematotoxicity_risk: string;
  ld50: string;
  therapeutic_index: string;
  approval_status: string;
}

export function searchDrugs(query: string): DrugRecord[] {
  const db = getDatabase();
  const q = `%${query}%`;
  return db.prepare(`
    SELECT * FROM drugs WHERE generic_name LIKE ? OR brand_names LIKE ? OR drug_class LIKE ?
    ORDER BY CASE WHEN generic_name LIKE ? THEN 0 ELSE 1 END, generic_name
    LIMIT 20
  `).all(q, q, q, `${query}%`) as DrugRecord[];
}

export function getDrugById(id: string): DrugRecord | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM drugs WHERE id = ?').get(id) as DrugRecord | undefined;
}

export function getDrugEnzymes(drugId: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM drug_enzymes WHERE drug_id = ?').all(drugId);
}

export function getDrugTransporters(drugId: string) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM drug_transporters WHERE drug_id = ?').all(drugId);
}

export function getInteractions(drug1Id: string, drug2Id: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT i.*, s.title as source_title, s.publisher as source_publisher, s.url as source_url
    FROM interactions i
    LEFT JOIN sources s ON INSTR(i.source_ids, s.id) > 0
    WHERE (i.drug1_id = ? AND i.drug2_id = ?) OR (i.drug1_id = ? AND i.drug2_id = ?)
  `).all(drug1Id, drug2Id, drug2Id, drug1Id);
}

export function getAlternatives(drugId: string) {
  const db = getDatabase();
  return db.prepare(`
    SELECT a.*, d.generic_name as alt_name, d.drug_class as alt_class
    FROM alternatives a
    JOIN drugs d ON a.alternative_drug_id = d.id
    WHERE a.original_drug_id = ?
  `).all(drugId);
}

export function getSources(sourceIds: string[]) {
  const db = getDatabase();
  if (sourceIds.length === 0) return [];
  const placeholders = sourceIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM sources WHERE id IN (${placeholders})`).all(...sourceIds);
}

export function buildEvidenceBundle(drug1Id: string, drug2Id: string): any {
  const drug1 = getDrugById(drug1Id);
  const drug2 = getDrugById(drug2Id);
  if (!drug1 || !drug2) throw new Error('Drug not found');

  const interactions = getInteractions(drug1Id, drug2Id);
  const drug1Enzymes = getDrugEnzymes(drug1Id);
  const drug2Enzymes = getDrugEnzymes(drug2Id);
  const drug1Transporters = getDrugTransporters(drug1Id);
  const drug2Transporters = getDrugTransporters(drug2Id);
  const alt1 = getAlternatives(drug1Id);
  const alt2 = getAlternatives(drug2Id);

  // Collect all source IDs
  const sourceIdSet = new Set<string>();
  interactions.forEach((i: any) => {
    try { JSON.parse(i.source_ids || '[]').forEach((s: string) => sourceIdSet.add(s)); } catch {}
  });
  [...drug1Enzymes, ...drug2Enzymes].forEach((e: any) => {
    if (e.source_id) sourceIdSet.add(e.source_id);
  });

  const sources = getSources(Array.from(sourceIdSet));

  return {
    drug1: drug1 as unknown as Record<string, unknown>,
    drug2: drug2 as unknown as Record<string, unknown>,
    interactionRecords: interactions as unknown as Record<string, unknown>[],
    drug1Enzymes: drug1Enzymes as unknown as Record<string, unknown>[],
    drug2Enzymes: drug2Enzymes as unknown as Record<string, unknown>[],
    drug1Transporters: drug1Transporters as unknown as Record<string, unknown>[],
    drug2Transporters: drug2Transporters as unknown as Record<string, unknown>[],
    alternatives: [...alt1, ...alt2] as unknown as Record<string, unknown>[],
    sources: sources as unknown as Record<string, unknown>[],
  };
}
