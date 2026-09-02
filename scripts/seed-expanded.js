const { getDatabase } = require('../lib/db');
const { v4: uuidv4 } = require('uuid');

function seedExpanded() {
  const db = getDatabase();

  console.log('Expanding database with more comprehensive drug data...');

  const source1Id = uuidv4();
  const source2Id = uuidv4();

  // Sources
  const insertSource = db.prepare(`
    INSERT OR IGNORE INTO sources (id, title, publisher, url, publication_date, access_date, evidence_type, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertSource.run(source1Id, 'FDA Prescribing Information', 'FDA', '', '2023-01-01', '2024-01-01', 'prescribing_info', 'Official FDA labels');
  insertSource.run(source2Id, 'Clinical Pharmacology Database', 'Elsevier', '', '2023-06-01', '2024-01-01', 'clinical_database', 'Comprehensive pharmacology data');

  const drugsData = [
    {
      id: uuidv4(), generic_name: 'Simvastatin', brand_names: '["Zocor"]', drug_class: 'Statin', sub_class: 'HMG-CoA Reductase Inhibitor',
      description: 'Used for the treatment of hypercholesterolemia and reduction of cardiovascular events.',
      mechanism_of_action: 'Competitively inhibits HMG-CoA reductase, the rate-limiting enzyme in cholesterol biosynthesis.',
      absorption: 'Well absorbed, but undergoes extensive first-pass metabolism.', metabolism: 'Extensively metabolized by CYP3A4.',
      clearance: 'Hepatic and renal.', typical_dose_range: '10-40 mg daily.',
      hepatotoxicity_risk: 'moderate', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Amiodarone', brand_names: '["Cordarone", "Pacerone"]', drug_class: 'Antiarrhythmic', sub_class: 'Class III',
      description: 'Used to treat various types of serious irregular heartbeats.',
      mechanism_of_action: 'Prolongs phase 3 of the cardiac action potential, primarily by blocking potassium channels. Also has beta-blocker and calcium channel blocker-like effects.',
      absorption: 'Slow and variable.', metabolism: 'Hepatic, primarily by CYP3A4 and CYP2C8. Potent inhibitor of multiple CYPs and P-gp.',
      clearance: 'Biliary excretion.', typical_dose_range: '200-400 mg daily for maintenance.',
      hepatotoxicity_risk: 'moderate', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'high'
    },
    {
      id: uuidv4(), generic_name: 'Warfarin', brand_names: '["Coumadin", "Jantoven"]', drug_class: 'Anticoagulant', sub_class: 'Vitamin K Antagonist',
      description: 'Used to treat and prevent blood clots.',
      mechanism_of_action: 'Inhibits vitamin K epoxide reductase complex 1 (VKORC1), depleting functional vitamin K reserves.',
      absorption: 'Rapid and complete.', metabolism: 'Hepatic, primarily by CYP2C9 (S-enantiomer, more potent) and CYP1A2/3A4 (R-enantiomer).',
      clearance: 'Renal (metabolites).', typical_dose_range: '2-10 mg daily (titrated to INR).',
      hepatotoxicity_risk: 'low', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Fluconazole', brand_names: '["Diflucan"]', drug_class: 'Antifungal', sub_class: 'Azole',
      description: 'Used to treat fungal and yeast infections.',
      mechanism_of_action: 'Inhibits fungal cytochrome P450 enzyme 14-alpha-demethylase.',
      absorption: 'Excellent bioavailability (>90%).', metabolism: 'Minimal hepatic metabolism. Potent inhibitor of CYP2C9 and CYP2C19, moderate inhibitor of CYP3A4.',
      clearance: 'Primarily renal (80% unchanged).', typical_dose_range: '150-400 mg daily depending on indication.',
      hepatotoxicity_risk: 'moderate', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Clopidogrel', brand_names: '["Plavix"]', drug_class: 'Antiplatelet', sub_class: 'P2Y12 Inhibitor',
      description: 'Used to prevent stroke, heart attack, and other heart problems.',
      mechanism_of_action: 'Prodrug that requires metabolic activation. The active metabolite irreversibly blocks the P2Y12 component of ADP receptors on the platelet surface.',
      absorption: 'Rapid.', metabolism: 'Extensive hepatic metabolism; requires activation primarily by CYP2C19.',
      clearance: 'Renal and fecal.', typical_dose_range: '75 mg daily.',
      hepatotoxicity_risk: 'low', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Omeprazole', brand_names: '["Prilosec"]', drug_class: 'Proton Pump Inhibitor (PPI)', sub_class: 'Anti-ulcer',
      description: 'Used to treat conditions where there is too much acid in the stomach.',
      mechanism_of_action: 'Irreversibly inhibits the gastric H+/K+-ATPase pump in parietal cells, suppressing acid secretion.',
      absorption: 'Rapid.', metabolism: 'Extensively metabolized by CYP2C19 and CYP3A4. Strong inhibitor of CYP2C19.',
      clearance: 'Primarily renal.', typical_dose_range: '20-40 mg daily.',
      hepatotoxicity_risk: 'low', nephrotoxicity_risk: 'moderate', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Ibuprofen', brand_names: '["Advil", "Motrin"]', drug_class: 'NSAID', sub_class: 'Non-selective COX Inhibitor',
      description: 'Used to reduce fever and treat pain or inflammation.',
      mechanism_of_action: 'Reversibly inhibits cyclooxygenase-1 and 2 (COX-1 and COX-2) enzymes, leading to decreased prostaglandin synthesis.',
      absorption: 'Rapid and complete.', metabolism: 'Hepatic oxidation.',
      clearance: 'Renal excretion.', typical_dose_range: '200-800 mg per dose.',
      hepatotoxicity_risk: 'low', nephrotoxicity_risk: 'moderate', cardiotoxicity_risk: 'moderate'
    },
    {
      id: uuidv4(), generic_name: 'Lithium', brand_names: '["Lithobid"]', drug_class: 'Mood Stabilizer', sub_class: 'Monovalent Cation',
      description: 'Used to treat bipolar disorder.',
      mechanism_of_action: 'Mechanism is complex and not fully understood; alters sodium transport in nerve and muscle cells and affects intraneuronal metabolism of catecholamines.',
      absorption: 'Rapid and complete.', metabolism: 'Not metabolized.',
      clearance: 'Almost exclusively renal. Excretion is critically dependent on sodium and fluid balance.', typical_dose_range: '600-1200 mg daily (titrated to serum levels).',
      hepatotoxicity_risk: 'low', nephrotoxicity_risk: 'high', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Penicillin', brand_names: '["Pen VK"]', drug_class: 'Antibiotic', sub_class: 'Beta-lactam',
      description: 'Used to treat various bacterial infections.',
      mechanism_of_action: 'Inhibits bacterial cell wall synthesis by binding to penicillin-binding proteins.',
      absorption: 'Variable depending on form.', metabolism: 'Minimal hepatic metabolism.',
      clearance: 'Primarily renal via tubular secretion.', typical_dose_range: '250-500 mg every 6 hours.',
      hepatotoxicity_risk: 'low', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Methotrexate', brand_names: '["Trexall"]', drug_class: 'Antineoplastic', sub_class: 'Antimetabolite',
      description: 'Used to treat various cancers including breast, head and neck, leukemia, lymphoma, and osteosarcoma.',
      mechanism_of_action: 'Competitively inhibits dihydrofolate reductase (DHFR).',
      absorption: 'Variable.', metabolism: 'Hepatic and intracellular.',
      clearance: 'Primarily renal via glomerular filtration and active tubular secretion.', typical_dose_range: 'Highly variable depending on cancer type.',
      hepatotoxicity_risk: 'high', nephrotoxicity_risk: 'high', cardiotoxicity_risk: 'low'
    },
    {
      id: uuidv4(), generic_name: 'Paclitaxel', brand_names: '["Taxol"]', drug_class: 'Antineoplastic', sub_class: 'Taxane (Microtubule Stabilizer)',
      description: 'First-line therapy for ovarian, breast, lung, and advanced Kaposi sarcoma.',
      mechanism_of_action: 'Promotes microtubule assembly and stabilizes them, preventing depolymerization and blocking mitosis.',
      absorption: 'IV administration.', metabolism: 'Extensively hepatic by CYP2C8 and CYP3A4.',
      clearance: 'Biliary/fecal.', typical_dose_range: '135-175 mg/m2 IV every 3 weeks.',
      hepatotoxicity_risk: 'moderate', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'moderate'
    },
    {
      id: uuidv4(), generic_name: 'Doxorubicin', brand_names: '["Adriamycin"]', drug_class: 'Antineoplastic', sub_class: 'Anthracycline',
      description: 'Used for leukemias, lymphomas, and solid tumors (breast, ovarian).',
      mechanism_of_action: 'Intercalates DNA and inhibits topoisomerase II, leading to DNA damage.',
      absorption: 'IV administration.', metabolism: 'Hepatic reduction and CYP metabolism.',
      clearance: 'Biliary/fecal.', typical_dose_range: '40-60 mg/m2 IV every 21-28 days.',
      hepatotoxicity_risk: 'moderate', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'high'
    },
    {
      id: uuidv4(), generic_name: 'Imatinib', brand_names: '["Gleevec"]', drug_class: 'Antineoplastic', sub_class: 'Tyrosine Kinase Inhibitor (TKI)',
      description: 'Targeted therapy for Chronic Myeloid Leukemia (CML) and GIST.',
      mechanism_of_action: 'Inhibits BCR-ABL, c-KIT, and PDGFR tyrosine kinases.',
      absorption: 'Highly bioavailable (98%).', metabolism: 'Extensively hepatic primarily via CYP3A4.',
      clearance: 'Fecal.', typical_dose_range: '400-800 mg orally daily.',
      hepatotoxicity_risk: 'moderate', nephrotoxicity_risk: 'low', cardiotoxicity_risk: 'low'
    }
  ];

  const insertDrug = db.prepare(`
    INSERT INTO drugs (id, generic_name, brand_names, drug_class, sub_class, description, mechanism_of_action, absorption, metabolism, clearance, typical_dose_range, hepatotoxicity_risk, nephrotoxicity_risk, cardiotoxicity_risk)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  drugsData.forEach(d => {
    try {
      insertDrug.run(d.id, d.generic_name, d.brand_names, d.drug_class, d.sub_class, d.description, d.mechanism_of_action, d.absorption, d.metabolism, d.clearance, d.typical_dose_range, d.hepatotoxicity_risk, d.nephrotoxicity_risk, d.cardiotoxicity_risk);
    } catch(e) {
      console.log('Skipping', d.generic_name);
    }
  });

  // Interactions
  const insertInteraction = db.prepare(`
    INSERT INTO interactions (id, drug1_id, drug2_id, severity, interaction_type, mechanism, clinical_description, management, source_ids)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const simvastatin = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Simvastatin'").get();
  const amiodarone = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Amiodarone'").get();
  const warfarin = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Warfarin'").get();
  const fluconazole = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Fluconazole'").get();
  const clopidogrel = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Clopidogrel'").get();
  const omeprazole = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Omeprazole'").get();
  const ibuprofen = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Ibuprofen'").get();
  const lithium = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Lithium'").get();
  const penicillin = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Penicillin'").get();
  const methotrexate = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Methotrexate'").get();
  const paclitaxel = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Paclitaxel'").get();
  const doxorubicin = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Doxorubicin'").get();
  const imatinib = db.prepare("SELECT id FROM drugs WHERE generic_name = 'Imatinib'").get();

  if(simvastatin && amiodarone) {
    insertInteraction.run(uuidv4(), simvastatin.id, amiodarone.id, 'major', 'pharmacokinetic', 
      'Amiodarone inhibits CYP3A4, leading to significantly increased serum concentrations of simvastatin.',
      'Increased risk of skeletal muscle toxicity, including rhabdomyolysis.',
      'Limit simvastatin dose to 20 mg daily when used with amiodarone, or consider alternative statins not metabolized by CYP3A4 (e.g., rosuvastatin, pravastatin).',
      JSON.stringify([source1Id])
    );
  }

  if(warfarin && fluconazole) {
    insertInteraction.run(uuidv4(), warfarin.id, fluconazole.id, 'major', 'pharmacokinetic', 
      'Fluconazole strongly inhibits CYP2C9, the primary enzyme responsible for the metabolism of the more active S-enantiomer of warfarin.',
      'Markedly increased INR and risk of severe bleeding.',
      'Monitor INR very closely upon initiation, dose change, or discontinuation of fluconazole. Significant warfarin dose reduction is usually required.',
      JSON.stringify([source1Id, source2Id])
    );
  }

  if(clopidogrel && omeprazole) {
    insertInteraction.run(uuidv4(), clopidogrel.id, omeprazole.id, 'moderate', 'pharmacokinetic', 
      'Omeprazole inhibits CYP2C19, the primary enzyme required for the activation of the clopidogrel prodrug.',
      'Reduced formation of clopidogrel active metabolite, potentially decreasing its antiplatelet efficacy and increasing the risk of adverse cardiovascular events.',
      'Avoid concomitant use. If a PPI is necessary, consider pantoprazole, which is a weaker inhibitor of CYP2C19.',
      JSON.stringify([source1Id])
    );
  }

  if(ibuprofen && lithium) {
    insertInteraction.run(uuidv4(), ibuprofen.id, lithium.id, 'major', 'pharmacodynamic/pharmacokinetic', 
      'NSAIDs can decrease renal blood flow and inhibit prostaglandin synthesis, leading to decreased renal excretion of lithium.',
      'Increased serum lithium concentrations and risk of lithium toxicity (tremor, confusion, ataxia, renal dysfunction).',
      'Avoid concomitant use if possible. If required, monitor lithium levels closely and adjust dose. Consider safer analgesics like acetaminophen.',
      JSON.stringify([source2Id])
    );
  }

  if(penicillin && methotrexate) {
    insertInteraction.run(uuidv4(), penicillin.id, methotrexate.id, 'major', 'pharmacokinetic', 
      'Penicillins can reduce the renal tubular secretion of methotrexate.',
      'Increased serum methotrexate concentrations and risk of severe methotrexate toxicity (myelosuppression, nephrotoxicity, mucosal ulcers).',
      'Avoid concomitant use if possible. If required, closely monitor methotrexate levels and blood counts. Consider alternative antibiotics.',
      JSON.stringify([source1Id])
    );
  }

  if(imatinib && simvastatin) {
    insertInteraction.run(uuidv4(), imatinib.id, simvastatin.id, 'major', 'pharmacokinetic', 
      'Imatinib is a strong inhibitor of CYP3A4, which is the primary metabolic pathway for simvastatin.',
      'Significant increase in simvastatin plasma levels, leading to high risk of severe myopathy and rhabdomyolysis.',
      'Avoid concomitant use. Switch to a statin not metabolized by CYP3A4 (e.g., rosuvastatin) for patients on Imatinib therapy.',
      JSON.stringify([source2Id])
    );
  }

  if(paclitaxel && doxorubicin) {
    insertInteraction.run(uuidv4(), paclitaxel.id, doxorubicin.id, 'major', 'pharmacokinetic/pharmacodynamic', 
      'Paclitaxel decreases the clearance of doxorubicin. Both have overlapping severe toxicity profiles.',
      'Increased risk of severe cardiotoxicity and extreme myelosuppression (neutropenia).',
      'Strict dose adjustments and sequencing required. Doxorubicin should be given BEFORE paclitaxel if both are required in a regimen.',
      JSON.stringify([source1Id])
    );
  }

  console.log('Expanded seeding complete.');
}

seedExpanded();
