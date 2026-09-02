"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = require("../lib/db");
const uuid_1 = require("uuid");
function seed() {
    const db = (0, db_1.getDatabase)();
    const existing = db.prepare('SELECT count(*) as count FROM drugs').get();
    if (existing.count > 0) {
        console.log('Database already seeded.');
        return;
    }
    console.log('Seeding database...');
    const sildenafilId = (0, uuid_1.v4)();
    const isosorbideId = (0, uuid_1.v4)();
    const source1Id = (0, uuid_1.v4)();
    // Sources
    db.prepare(`
    INSERT INTO sources (id, title, publisher, url, publication_date, access_date, evidence_type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(source1Id, 'Clinical Pharmacology and Therapeutics', 'Medical Publisher Inc', '', '2022-01-01', '2023-10-01', 'clinical_trial', 'Study on the hemodynamic effects of PDE5 inhibitors and nitrates.');
    // Drugs
    const insertDrug = db.prepare(`
    INSERT INTO drugs (id, generic_name, brand_names, drug_class, sub_class, description, mechanism_of_action, absorption, metabolism, clearance, typical_dose_range, hepatotoxicity_risk, nephrotoxicity_risk, cardiotoxicity_risk)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    insertDrug.run(sildenafilId, 'Sildenafil', '["Viagra", "Revatio"]', 'Phosphodiesterase-5 (PDE5) Inhibitor', 'Vasodilator', 'Used for erectile dysfunction and pulmonary arterial hypertension.', 'Inhibits PDE5, enhancing the effect of nitric oxide (NO) by increasing cGMP levels, resulting in smooth muscle relaxation and inflow of blood.', 'Rapidly absorbed (bioavailability 40%).', 'Primarily metabolized by CYP3A4 (major) and CYP2C9 (minor).', 'Predominantly excreted as metabolites in feces (80%) and urine (13%).', '50 mg PRN for ED.', 'low', 'low', 'moderate');
    insertDrug.run(isosorbideId, 'Isosorbide Mononitrate', '["Imdur", "Monoket"]', 'Nitrate', 'Antianginal', 'Used for the prevention of angina pectoris due to coronary artery disease.', 'Converted to nitric oxide (NO), which activates guanylate cyclase and increases cGMP, causing vasodilation.', 'Well absorbed (bioavailability near 100%).', 'Denitration in the liver to inactive metabolites.', 'Renal excretion of metabolites.', '30-120 mg daily.', 'low', 'low', 'moderate');
    // Interactions
    db.prepare(`
    INSERT INTO interactions (id, drug1_id, drug2_id, severity, interaction_type, mechanism, clinical_description, management, source_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run((0, uuid_1.v4)(), sildenafilId, isosorbideId, 'contraindicated', 'pharmacodynamic', 'Synergistic vasodilation. Both drugs increase cGMP levels (nitrates by increasing production via NO, sildenafil by preventing breakdown).', 'Concomitant use can cause severe, life-threatening hypotension and syncope.', 'Absolute contraindication. Avoid use of sildenafil in patients taking any form of organic nitrate.', JSON.stringify([source1Id]));
    console.log('Seeding complete.');
}
seed();
