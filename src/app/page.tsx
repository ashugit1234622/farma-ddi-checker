'use client';

import { useState } from 'react';
import { DrugRecord } from "../lib/engine/ddi-engine";
import { DDIAnalysis } from "../lib/ai/schemas";

export default function Home() {
  const [query1, setQuery1] = useState('');
  const [query2, setQuery2] = useState('');
  
  const [drug1, setDrug1] = useState<DrugRecord | null>(null);
  const [drug2, setDrug2] = useState<DrugRecord | null>(null);

  const [results1, setResults1] = useState<DrugRecord[]>([]);
  const [results2, setResults2] = useState<DrugRecord[]>([]);

  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<DDIAnalysis | null>(null);
  const [error, setError] = useState('');

  const searchDrug = async (query: string, setResult: (res: DrugRecord[]) => void) => {
    if (query.length < 2) {
      setResult([]);
      return;
    }
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResult(data.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyze = async () => {
    if (!drug1 || !drug2) return;
    
    setAnalyzing(true);
    setReport(null);
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug1Id: drug1.id, drug2Id: drug2.id })
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setReport(json.data.analysis);
      }
    } catch (e) {
      setError('Failed to reach analysis service. Ensure AI provider is correctly configured.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem', paddingTop: '2rem' }}>
        <h1 style={{ fontSize: '3rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>AI Pharmacology Analysis</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Evaluate drug interactions based on structured pharmacological evidence, ADME characteristics, and clinical data.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {/* Drug 1 Selection */}
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3>Select Drug 1</h3>
          {!drug1 ? (
            <div style={{ position: 'relative' }}>
              <input 
                className="input" 
                placeholder="Search drug (e.g. Sildenafil)" 
                value={query1}
                onChange={(e) => {
                  setQuery1(e.target.value);
                  searchDrug(e.target.value, setResults1);
                }}
              />
              {results1.length > 0 && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  zIndex: 10, 
                  backgroundColor: 'var(--bg-main)', 
                  marginTop: '0.5rem', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  maxHeight: '250px', 
                  overflowY: 'auto',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}>
                  {results1.map(d => (
                    <div 
                      key={d.id} 
                      style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => { setDrug1(d); setQuery1(''); setResults1([]); }}
                    >
                      <strong>{d.generic_name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.drug_class}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{drug1.generic_name}</strong>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{drug1.drug_class}</div>
              </div>
              <button className="btn" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-main)', width: '100%' }} onClick={() => setDrug1(null)}>
                Change Drug
              </button>
            </div>
          )}
        </div>

        {/* Drug 2 Selection */}
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h3>Select Drug 2</h3>
          {!drug2 ? (
            <div style={{ position: 'relative' }}>
              <input 
                className="input" 
                placeholder="Search drug (e.g. Isosorbide)" 
                value={query2}
                onChange={(e) => {
                  setQuery2(e.target.value);
                  searchDrug(e.target.value, setResults2);
                }}
              />
              {results2.length > 0 && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  zIndex: 10, 
                  backgroundColor: 'var(--bg-main)', 
                  marginTop: '0.5rem', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  maxHeight: '250px', 
                  overflowY: 'auto',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                }}>
                  {results2.map(d => (
                    <div 
                      key={d.id} 
                      style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      onClick={() => { setDrug2(d); setQuery2(''); setResults2([]); }}
                    >
                      <strong>{d.generic_name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.drug_class}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ padding: '1rem', backgroundColor: 'var(--bg-hover)', borderRadius: '8px', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '1.2rem', color: 'var(--accent-primary)' }}>{drug2.generic_name}</strong>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{drug2.drug_class}</div>
              </div>
              <button className="btn" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-main)', width: '100%' }} onClick={() => setDrug2(null)}>
                Change Drug
              </button>
            </div>
          )}
        </div>
      </div>

      {drug1 && drug2 && !report && !analyzing && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button className="btn btn-primary" style={{ fontSize: '1.2rem', padding: '1rem 3rem' }} onClick={handleAnalyze}>
            Analyze Interaction
          </button>
        </div>
      )}

      {error && (
        <div className="card bg-danger status-danger" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {analyzing && (
        <div className="card fade-in" style={{ marginTop: '2rem', maxWidth: '600px', margin: '2rem auto' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '2rem' }}>Analyzing Pharmacology...</h3>
          <div className="stepper">
            <div className="step active"><div className="spinner"></div> Resolving drugs & fetching evidence</div>
            <div className="step active"><div className="spinner"></div> Analyzing CYP pathways & transporters</div>
            <div className="step active"><div className="spinner"></div> Comparing ADME & Toxicity profiles</div>
            <div className="step active"><div className="spinner"></div> Generating comprehensive AI summary</div>
          </div>
        </div>
      )}

      {report && (
        <div className="fade-in" style={{ marginTop: '3rem' }}>
          {/* Executive Summary */}
          <div className={`card ${report.severity === 'contraindicated' || report.severity === 'major' ? 'bg-danger' : report.severity === 'moderate' ? 'bg-warning' : ''}`} style={{ borderLeft: '4px solid', borderLeftColor: report.severity === 'contraindicated' || report.severity === 'major' ? 'var(--danger)' : report.severity === 'moderate' ? 'var(--warning)' : 'var(--success)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px', opacity: 0.8 }}>AI Assessment</div>
                <h2 style={{ margin: 0 }}>
                  {report.severity === 'contraindicated' ? 'CONTRAINDICATED' : 
                   report.severity === 'major' ? 'MAJOR INTERACTION' : 
                   report.severity === 'moderate' ? 'MODERATE INTERACTION' : 
                   'MINOR / NO INTERACTION'}
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Confidence</span>
                <div style={{ fontWeight: 'bold', textTransform: 'capitalize' }}>{report.confidence}</div>
              </div>
            </div>
            <p style={{ fontSize: '1.1rem', lineHeight: 1.6 }}>{report.executiveSummary}</p>
          </div>

          {/* Mechanisms */}
          <div className="report-section">
            <h3>Interaction Mechanisms</h3>
            {report.interactionMechanisms.map((m, i) => (
              <div key={i} className="mechanism-card">
                <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>{m.type}</strong>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{m.explanation}</p>
                <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Evidence: {m.evidence}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Clinical Significance */}
            <div className="report-section">
              <h3>Clinical Significance</h3>
              <p>{report.clinicalSignificance}</p>
              
              <h4 style={{ marginTop: '1.5rem', color: 'var(--text-muted)' }}>Potential Consequences</h4>
              <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                {report.potentialConsequences.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>

            {/* ADME Analysis */}
            <div className="report-section">
              <h3>ADME Analysis</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div><strong style={{ color: 'var(--text-muted)' }}>Absorption:</strong> {report.admeAnalysis.absorption}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Distribution:</strong> {report.admeAnalysis.distribution}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Metabolism:</strong> {report.admeAnalysis.metabolism}</div>
                <div><strong style={{ color: 'var(--text-muted)' }}>Excretion:</strong> {report.admeAnalysis.excretion}</div>
              </div>
            </div>
          </div>

          {/* Monitoring & Toxicity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="report-section">
              <h3>Monitoring Required</h3>
              {report.monitoring.length > 0 ? report.monitoring.map((m, i) => (
                <div key={i} className="monitoring-card">
                  <strong>{m.parameter}</strong> {m.frequency && <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>({m.frequency})</span>}
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{m.reason}</p>
                </div>
              )) : <p>No specific monitoring required.</p>}
            </div>

            <div className="report-section">
              <h3>Dose Risk & Management</h3>
              <div className="card" style={{ backgroundColor: 'var(--bg-main)' }}>
                {report.doseRisk.doseAdjustmentNeeded && (
                  <div style={{ color: 'var(--warning)', fontWeight: 'bold', marginBottom: '0.5rem' }}>⚠ Dose Adjustment Required</div>
                )}
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Dangerous Dose Threshold:</strong>
                  <div>{report.doseRisk.dangerousDoseThreshold}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Co-Administration Guidance:</strong>
                  <div>{report.doseRisk.safeCoAdminGuidance}</div>
                </div>
                {report.doseRisk.adjustmentDetails && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {report.doseRisk.adjustmentDetails}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="report-section">
              <h3>Toxicity Analysis</h3>
              <div className="card" style={{ backgroundColor: 'var(--bg-main)' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Overall Risk</span>
                  <div style={{ fontWeight: 'bold' }}>{report.toxicityAnalysis.overallRisk}</div>
                </div>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>{report.toxicityAnalysis.combinedRiskAssessment}</p>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Specific Concerns:</h4>
                <ul style={{ paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                  {report.toxicityAnalysis.concerns.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            </div>

            <div className="report-section">
              <h3>Demographic Considerations</h3>
              <div className="card" style={{ backgroundColor: 'var(--bg-main)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Pediatric:</strong> {report.demographicEffects.pediatric}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Geriatric:</strong> {report.demographicEffects.geriatric}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Hepatic Impairment:</strong> {report.demographicEffects.hepaticImpairment}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Renal Impairment:</strong> {report.demographicEffects.renalImpairment}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Pregnancy / Lactation:</strong> {report.demographicEffects.pregnancyLactation}</div>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Sex-Specific (M/F):</strong> {report.demographicEffects.maleSpecific} / {report.demographicEffects.femaleSpecific}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Sources and Limitations */}
          <div className="report-section">
            <h3 style={{ color: 'var(--text-muted)' }}>Evidence & Limitations</h3>
            <div className="card" style={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border)' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}><strong>Evidence Assessment:</strong> {report.evidenceAssessment}</p>
              
              <h4 style={{ fontSize: '0.9rem', color: 'var(--warning)', marginTop: '1.5rem' }}>Limitations</h4>
              <ul style={{ paddingLeft: '1.5rem', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                {report.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>

              {report.sourceIds.length > 0 && (
                <>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sources Referenced</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {report.sourceIds.map((id, i) => (
                      <div key={i} className="source-item">Source ID: {id}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ marginTop: '3rem', padding: '1rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <strong>Disclaimer:</strong> AI-generated analysis is an evidence-grounded informational summary and does not replace professional clinical judgment. Verify important interaction information against current authoritative sources.
          </div>
        </div>
      )}
    </div>
  );
}
