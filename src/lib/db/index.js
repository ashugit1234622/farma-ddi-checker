"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
function getDatabase() {
    if (db)
        return db;
    const dbPath = process.env.DATABASE_PATH || './data/farma.db';
    const fullPath = path_1.default.resolve(process.cwd(), dbPath);
    const dir = path_1.default.dirname(fullPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    db = new better_sqlite3_1.default(fullPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
    return db;
}
function initializeSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS drugs (
      id TEXT PRIMARY KEY, generic_name TEXT NOT NULL, brand_names TEXT DEFAULT '[]',
      drug_class TEXT, sub_class TEXT, description TEXT, mechanism_of_action TEXT,
      indications TEXT DEFAULT '[]', contraindications TEXT DEFAULT '[]',
      absorption TEXT, bioavailability TEXT, distribution TEXT, protein_binding TEXT,
      volume_of_distribution TEXT, metabolism TEXT, half_life TEXT, excretion TEXT, clearance TEXT,
      typical_dose_range TEXT, max_daily_dose TEXT, dose_adjustments TEXT,
      hepatotoxicity_risk TEXT DEFAULT 'unknown', nephrotoxicity_risk TEXT DEFAULT 'unknown',
      cardiotoxicity_risk TEXT DEFAULT 'unknown', neurotoxicity_risk TEXT DEFAULT 'unknown',
      hematotoxicity_risk TEXT DEFAULT 'unknown', ld50 TEXT, therapeutic_index TEXT,
      approval_status TEXT DEFAULT 'approved',
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS drug_enzymes (
      id TEXT PRIMARY KEY, drug_id TEXT NOT NULL, enzyme_name TEXT NOT NULL,
      role TEXT NOT NULL, strength TEXT, evidence_level TEXT DEFAULT 'established',
      notes TEXT, source_id TEXT, FOREIGN KEY (drug_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS drug_transporters (
      id TEXT PRIMARY KEY, drug_id TEXT NOT NULL, transporter_name TEXT NOT NULL,
      role TEXT NOT NULL, significance TEXT, evidence_level TEXT DEFAULT 'established',
      notes TEXT, source_id TEXT, FOREIGN KEY (drug_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY, drug1_id TEXT NOT NULL, drug2_id TEXT NOT NULL,
      severity TEXT NOT NULL, interaction_type TEXT NOT NULL, mechanism TEXT,
      clinical_description TEXT, management TEXT, onset TEXT,
      documentation_level TEXT DEFAULT 'established',
      effect_on_drug1 TEXT, effect_on_drug2 TEXT, source_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (drug1_id) REFERENCES drugs(id), FOREIGN KEY (drug2_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS alternatives (
      id TEXT PRIMARY KEY, original_drug_id TEXT NOT NULL, alternative_drug_id TEXT NOT NULL,
      therapeutic_equivalence TEXT, rationale TEXT, evidence_level TEXT, source_id TEXT,
      FOREIGN KEY (original_drug_id) REFERENCES drugs(id),
      FOREIGN KEY (alternative_drug_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, publisher TEXT, url TEXT,
      publication_date TEXT, access_date TEXT, evidence_type TEXT, description TEXT
    );
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY, drug1_id TEXT NOT NULL, drug2_id TEXT NOT NULL,
      status TEXT NOT NULL, severity TEXT, confidence TEXT, executive_summary TEXT,
      structured_result TEXT NOT NULL, model TEXT, model_version TEXT,
      prompt_version TEXT NOT NULL, evidence_bundle_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (drug1_id) REFERENCES drugs(id), FOREIGN KEY (drug2_id) REFERENCES drugs(id)
    );
    CREATE TABLE IF NOT EXISTS qa_history (
      id TEXT PRIMARY KEY, analysis_id TEXT NOT NULL, question TEXT NOT NULL,
      answer TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id)
    );
    CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name);
    CREATE INDEX IF NOT EXISTS idx_drug_enzymes_drug_id ON drug_enzymes(drug_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_drugs ON interactions(drug1_id, drug2_id);
    CREATE INDEX IF NOT EXISTS idx_ai_analyses_drugs ON ai_analyses(drug1_id, drug2_id);
  `);
}
