const { getDatabase } = require('./db');

function searchDrugs(query) {
  const db = getDatabase();
  const q = `%${query}%`;
  return db.prepare(`
    SELECT * FROM drugs WHERE generic_name LIKE ? OR brand_names LIKE ? OR drug_class LIKE ?
    ORDER BY CASE WHEN generic_name LIKE ? THEN 0 ELSE 1 END, generic_name
    LIMIT 20
  `).all(q, q, q, `${query}%`);
}

function getDrugById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM drugs WHERE id = ?').get(id);
}

function getDrugEnzymes(drugId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM drug_enzymes WHERE drug_id = ?').all(drugId);
}

function getDrugTransporters(drugId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM drug_transporters WHERE drug_id = ?').all(drugId);
}

function getInteractions(drug1Id, drug2Id) {
  const db = getDatabase();
  return db.prepare(`
    SELECT i.*, s.title as source_title, s.publisher as source_publisher, s.url as source_url
    FROM interactions i
    LEFT JOIN sources s ON INSTR(i.source_ids, s.id) > 0
    WHERE (i.drug1_id = ? AND i.drug2_id = ?) OR (i.drug1_id = ? AND i.drug2_id = ?)
  `).all(drug1Id, drug2Id, drug2Id, drug1Id);
}

function getAlternatives(drugId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT a.*, d.generic_name as alt_name, d.drug_class as alt_class
    FROM alternatives a
    JOIN drugs d ON a.alternative_drug_id = d.id
    WHERE a.original_drug_id = ?
  `).all(drugId);
}

function getSources(sourceIds) {
  const db = getDatabase();
  if (!sourceIds || sourceIds.length === 0) return [];
  const placeholders = sourceIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM sources WHERE id IN (${placeholders})`).all(...sourceIds);
}

function buildEvidenceBundle(drug1Id, drug2Id) {
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

  const sourceIdSet = new Set();
  interactions.forEach(i => {
    try { JSON.parse(i.source_ids || '[]').forEach(s => sourceIdSet.add(s)); } catch (e) {}
  });
  [...drug1Enzymes, ...drug2Enzymes].forEach(e => {
    if (e.source_id) sourceIdSet.add(e.source_id);
  });

  const sources = getSources(Array.from(sourceIdSet));

  return {
    drug1,
    drug2,
    interactionRecords: interactions,
    drug1Enzymes,
    drug2Enzymes,
    drug1Transporters,
    drug2Transporters,
    alternatives: [...alt1, ...alt2],
    sources
  };
}

module.exports = {
  searchDrugs,
  getDrugById,
  getDrugEnzymes,
  getDrugTransporters,
  getInteractions,
  getAlternatives,
  getSources,
  buildEvidenceBundle
};
