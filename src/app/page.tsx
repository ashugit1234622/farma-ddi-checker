'use client';

import { useState, useEffect, useRef } from 'react';
import { DDIAnalysis } from "../lib/ai/schemas";

interface DrugSearchResult {
  id: string;
  name: string;
  genericName: string;
  drugClass: string[];
  synonyms: string[];
  indications: string[];
}

/* ─── Animated Bar Component ─── */
function AnimatedBar({ value, className, delay = 0 }: { value: number; className: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 100 + delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <div className="chart-bar-track">
      <div ref={ref} className={`chart-bar-fill animated ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/* ─── Toxicity Color Helper ─── */
function getToxClass(val: number): string {
  if (val <= 30) return 'toxicity-low';
  if (val <= 60) return 'toxicity-moderate';
  return 'toxicity-high';
}

function getToxColor(val: number): string {
  if (val <= 30) return 'var(--chart-low)';
  if (val <= 60) return 'var(--chart-moderate)';
  return 'var(--chart-high)';
}

/* ─── ADME Chart ─── */
function ADMEChart({ report, drug1Name, drug2Name }: { report: DDIAnalysis; drug1Name: string; drug2Name: string }) {
  const params = ['absorption', 'distribution', 'metabolism', 'excretion'] as const;
  return (
    <div className="chart-container slide-up delay-2">
      <div className="chart-title">⚗️ ADME Comparison</div>
      {params.map((p, i) => (
        <div className="chart-row" key={p}>
          <div className="chart-label" style={{ textTransform: 'capitalize' }}>{p}</div>
          <div className="chart-bars">
            <AnimatedBar value={report.admeScores.drug1[p]} className="drug1" delay={i * 150} />
            <AnimatedBar value={report.admeScores.drug2[p]} className="drug2" delay={i * 150 + 80} />
          </div>
          <div className="chart-value" style={{ fontSize: '0.65rem' }}>
            {report.admeScores.drug1[p]}<br/>{report.admeScores.drug2[p]}
          </div>
        </div>
      ))}
      <div className="chart-legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-drug1)' }} />{drug1Name}</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-drug2)' }} />{drug2Name}</div>
      </div>
    </div>
  );
}

/* ─── Toxicity Chart ─── */
function ToxicityChart({ report, drug1Name, drug2Name }: { report: DDIAnalysis; drug1Name: string; drug2Name: string }) {
  const params = ['hepatic', 'renal', 'cardiac', 'neuro', 'hemato'] as const;
  const labels: Record<string, string> = { hepatic: 'Hepatic', renal: 'Renal', cardiac: 'Cardiac', neuro: 'Neuro', hemato: 'Hemato' };

  return (
    <div className="chart-container slide-up delay-3">
      <div className="chart-title">☠️ Toxicity Profile</div>
      {params.map((p, i) => (
        <div className="chart-row" key={p}>
          <div className="chart-label">{labels[p]}</div>
          <div className="chart-bars">
            <AnimatedBar value={report.toxicityScores.drug1[p]} className={getToxClass(report.toxicityScores.drug1[p])} delay={i * 120} />
            <AnimatedBar value={report.toxicityScores.drug2[p]} className={getToxClass(report.toxicityScores.drug2[p])} delay={i * 120 + 70} />
          </div>
          <div className="chart-value" style={{ fontSize: '0.65rem' }}>
            {report.toxicityScores.drug1[p]}<br/>{report.toxicityScores.drug2[p]}
          </div>
        </div>
      ))}
      <div className="chart-legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-drug1)' }} />{drug1Name}</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-drug2)' }} />{drug2Name}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-low)' }} />Low</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-moderate)' }} />Moderate</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--chart-high)' }} />High</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function Home() {
  const [query1, setQuery1] = useState('');
  const [query2, setQuery2] = useState('');
  const [drug1, setDrug1] = useState<DrugSearchResult | null>(null);
  const [drug2, setDrug2] = useState<DrugSearchResult | null>(null);
  const [results1, setResults1] = useState<DrugSearchResult[]>([]);
  const [results2, setResults2] = useState<DrugSearchResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<DDIAnalysis | null>(null);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);

  const searchDrug = async (query: string, setResult: (res: DrugSearchResult[]) => void) => {
    if (query.length < 1) { setResult([]); return; }
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResult(data.data || []);
    } catch { /* ignore */ }
  };

  // Stepper animation
  useEffect(() => {
    if (!analyzing) { setStepIndex(0); return; }
    const interval = setInterval(() => {
      setStepIndex(prev => (prev < 4 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [analyzing]);

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
      } else if (json.data?.analysis) {
        setReport(json.data.analysis);
      } else if (json.data?.aiError) {
        setError(json.data.aiError);
      }
    } catch {
      setError('Failed to reach analysis service.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setDrug1(null); setDrug2(null);
    setQuery1(''); setQuery2('');
    setResults1([]); setResults2([]);
    setReport(null); setError('');
  };

  const isInteraction = report?.overallStatus === 'interaction_detected';
  const isSafe = report?.overallStatus === 'no_significant_interaction_identified';

  const getSeverityStyle = () => {
    if (!report) return {};
    if (report.severity === 'contraindicated' || report.severity === 'major')
      return { borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.06)' };
    if (report.severity === 'moderate')
      return { borderColor: 'var(--warning)', background: 'rgba(245, 158, 11, 0.06)' };
    return { borderColor: 'var(--success)', background: 'rgba(16, 185, 129, 0.06)' };
  };

  const steps = [
    'Resolving drugs & loading evidence',
    'Analyzing CYP enzyme pathways',
    'Evaluating ADME & toxicity profiles',
    'Generating AI-powered report',
  ];

  return (
    <div style={{ paddingBottom: '3rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', paddingTop: '1.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💊</div>
        <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
          Drug-Drug Interaction Checker
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '550px', margin: '0 auto' }}>
          Select two drugs to check for interactions, view ADME & toxicity charts, and get AI-powered clinical analysis.
        </p>
      </div>

      {/* Drug Selection */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Drug 1 */}
        <div className="card" style={{ flex: '1 1 280px', minHeight: '180px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>Drug 1</h3>
          {!drug1 ? (
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search by name, class, or indication..."
                value={query1}
                onChange={(e) => { setQuery1(e.target.value); searchDrug(e.target.value, setResults1); }}
              />
              {results1.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  backgroundColor: 'var(--bg-card)', marginTop: '0.4rem',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  maxHeight: '280px', overflowY: 'auto',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.3)'
                }}>
                  {results1.map(d => (
                    <div key={d.id} style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => { setDrug1(d); setQuery1(''); setResults1([]); setReport(null); }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {d.drugClass.join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-hover)', borderRadius: '10px', marginBottom: '0.75rem', borderLeft: '3px solid var(--chart-drug1)' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--chart-drug1)' }}>{drug1.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{drug1.genericName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>{drug1.drugClass.join(' · ')}</div>
              </div>
              <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }} onClick={() => { setDrug1(null); setReport(null); }}>
                Change
              </button>
            </div>
          )}
        </div>

        {/* Interaction Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingTop: '1.5rem' }}>
          <div className={`interaction-indicator ${report ? (isInteraction ? 'indicator-danger' : 'indicator-safe') : 'indicator-pending'}`}>
            {report ? (isInteraction ? '⚠️' : '✅') : '⇄'}
          </div>
        </div>

        {/* Drug 2 */}
        <div className="card" style={{ flex: '1 1 280px', minHeight: '180px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>Drug 2</h3>
          {!drug2 ? (
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search by name, class, or indication..."
                value={query2}
                onChange={(e) => { setQuery2(e.target.value); searchDrug(e.target.value, setResults2); }}
              />
              {results2.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  backgroundColor: 'var(--bg-card)', marginTop: '0.4rem',
                  border: '1px solid var(--border)', borderRadius: '10px',
                  maxHeight: '280px', overflowY: 'auto',
                  boxShadow: '0 12px 28px rgba(0,0,0,0.3)'
                }}>
                  {results2.map(d => (
                    <div key={d.id} style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      onClick={() => { setDrug2(d); setQuery2(''); setResults2([]); setReport(null); }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {d.drugClass.join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-hover)', borderRadius: '10px', marginBottom: '0.75rem', borderLeft: '3px solid var(--chart-drug2)' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--chart-drug2)' }}>{drug2.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{drug2.genericName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>{drug2.drugClass.join(' · ')}</div>
              </div>
              <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }} onClick={() => { setDrug2(null); setReport(null); }}>
                Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Check Interaction Button */}
      {drug1 && drug2 && !report && !analyzing && (
        <div className="fade-in" style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
          <button className="btn btn-primary" style={{ fontSize: '1.05rem', padding: '0.85rem 2.5rem' }} onClick={handleAnalyze}>
            🔬 Check Interaction
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card fade-in" style={{ marginTop: '1.5rem', textAlign: 'center', borderColor: 'var(--danger)', background: 'rgba(239,68,68,0.06)' }}>
          <strong style={{ color: 'var(--danger)' }}>Error:</strong> <span style={{ color: 'var(--text-muted)' }}>{error}</span>
        </div>
      )}

      {/* Loading Stepper */}
      {analyzing && (
        <div className="card fade-in" style={{ marginTop: '1.5rem', maxWidth: '500px', margin: '1.5rem auto' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1rem' }}>Analyzing Interaction...</h3>
          <div className="stepper">
            {steps.map((s, i) => (
              <div key={i} className={`step ${i <= stepIndex ? 'active' : ''}`}>
                {i < stepIndex ? <span style={{ color: 'var(--success)' }}>✓</span> : i === stepIndex ? <div className="spinner" /> : <span style={{ width: 16 }}>○</span>}
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report */}
      {report && (
        <div className="fade-in" style={{ marginTop: '2rem' }}>
          {/* Status Banner */}
          <div className="card scale-in" style={{ ...getSeverityStyle(), borderLeft: '4px solid', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div className={`status-badge ${isInteraction ? (report.severity === 'major' || report.severity === 'contraindicated' ? 'status-danger' : 'status-warning') : 'status-safe'}`}>
                  {report.severity === 'contraindicated' ? '⛔ CONTRAINDICATED' :
                   report.severity === 'major' ? '🔴 MAJOR INTERACTION' :
                   report.severity === 'moderate' ? '🟡 MODERATE INTERACTION' :
                   report.severity === 'minor' ? '🟢 MINOR INTERACTION' : '✅ NO SIGNIFICANT INTERACTION'}
                </div>
                <p style={{ fontSize: '1rem', lineHeight: 1.7, marginTop: '0.75rem', color: 'var(--text-main)' }}>{report.executiveSummary}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Confidence</div>
                <div style={{ fontWeight: 700, textTransform: 'capitalize', fontSize: '1rem' }}>{report.confidence}</div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <ADMEChart report={report} drug1Name={drug1?.name || 'Drug 1'} drug2Name={drug2?.name || 'Drug 2'} />
            <ToxicityChart report={report} drug1Name={drug1?.name || 'Drug 1'} drug2Name={drug2?.name || 'Drug 2'} />
          </div>

          {/* Mechanisms */}
          {report.interactionMechanisms.length > 0 && (
            <div className="report-section slide-up delay-1">
              <h3>⚙️ Interaction Mechanisms</h3>
              {report.interactionMechanisms.map((m, i) => (
                <div key={i} className="mechanism-card">
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{m.type}</strong>
                  <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0', fontSize: '0.9rem' }}>{m.explanation}</p>
                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)' }}>Evidence: {m.evidence}</div>
                </div>
              ))}
            </div>
          )}

          {/* Clinical Significance + ADME Text */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            <div className="report-section slide-up delay-2">
              <h3>📋 Clinical Significance</h3>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{report.clinicalSignificance}</p>
              {report.potentialConsequences.length > 0 && (
                <ul style={{ paddingLeft: '1.25rem', marginTop: '0.75rem', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  {report.potentialConsequences.map((c, i) => <li key={i} style={{ marginBottom: '0.3rem' }}>{c}</li>)}
                </ul>
              )}
            </div>

            <div className="report-section slide-up delay-3">
              <h3>🧬 ADME Analysis</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
                <div><strong style={{ color: 'var(--text-dim)' }}>Absorption:</strong> {report.admeAnalysis.absorption}</div>
                <div><strong style={{ color: 'var(--text-dim)' }}>Distribution:</strong> {report.admeAnalysis.distribution}</div>
                <div><strong style={{ color: 'var(--text-dim)' }}>Metabolism:</strong> {report.admeAnalysis.metabolism}</div>
                <div><strong style={{ color: 'var(--text-dim)' }}>Excretion:</strong> {report.admeAnalysis.excretion}</div>
              </div>
            </div>
          </div>

          {/* Alternatives */}
          {report.alternatives.length > 0 && (
            <div className="report-section slide-up delay-4" style={{ marginTop: '1.5rem' }}>
              <h3>💡 Suggested Alternatives</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {isInteraction ? 'These drugs may have lower interaction risk:' : 'Other options in the same therapeutic class:'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
                {report.alternatives.map((alt, i) => (
                  <div key={i} className="alt-card">
                    <div className="alt-name">{alt.drugName}</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.3rem 0' }}>{alt.rationale}</p>
                    <span className="alt-risk" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                      Risk: {alt.interactionRisk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monitoring + Dose Risk */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>
            <div className="report-section slide-up delay-3">
              <h3>📊 Monitoring Required</h3>
              {report.monitoring.length > 0 ? report.monitoring.map((m, i) => (
                <div key={i} className="monitoring-card">
                  <strong>{m.parameter}</strong>
                  {m.frequency && <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>({m.frequency})</span>}
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{m.reason}</p>
                </div>
              )) : <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No specific monitoring required.</p>}
            </div>

            <div className="report-section slide-up delay-4">
              <h3>💊 Dose Risk & Management</h3>
              <div style={{ background: 'var(--bg-hover)', padding: '1rem', borderRadius: '10px', fontSize: '0.88rem' }}>
                {report.doseRisk.doseAdjustmentNeeded && (
                  <div style={{ color: 'var(--warning)', fontWeight: 600, marginBottom: '0.5rem' }}>⚠ Dose Adjustment Required</div>
                )}
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Dangerous Threshold:</strong>
                  <div style={{ marginTop: '0.15rem' }}>{report.doseRisk.dangerousDoseThreshold}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Safe Co-Admin Guidance:</strong>
                  <div style={{ marginTop: '0.15rem' }}>{report.doseRisk.safeCoAdminGuidance}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Demographics */}
          <div className="report-section slide-up delay-5" style={{ marginTop: '1.5rem' }}>
            <h3>👥 Demographic Considerations</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.85rem' }}>
              {[
                { label: 'Pediatric', val: report.demographicEffects.pediatric },
                { label: 'Geriatric', val: report.demographicEffects.geriatric },
                { label: 'Hepatic Impairment', val: report.demographicEffects.hepaticImpairment },
                { label: 'Renal Impairment', val: report.demographicEffects.renalImpairment },
                { label: 'Pregnancy/Lactation', val: report.demographicEffects.pregnancyLactation },
              ].map((item, i) => (
                <div key={i} style={{ background: 'var(--bg-hover)', padding: '0.65rem 0.85rem', borderRadius: '8px' }}>
                  <strong style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</strong>
                  <div style={{ marginTop: '0.2rem', color: 'var(--text-muted)' }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Evidence + Disclaimer */}
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.12)', borderRadius: '10px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--accent-primary)' }}>Evidence Assessment:</strong> {report.evidenceAssessment}
          </div>

          <div style={{ marginTop: '0.75rem', padding: '0.85rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.12)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center' }}>
            ⚕️ <strong>Disclaimer:</strong> AI-generated analysis for informational purposes only. Does not replace professional clinical judgment. Verify against authoritative sources.
          </div>

          {/* New Analysis Button */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button className="btn btn-outline" style={{ fontSize: '0.9rem' }} onClick={handleReset}>
              🔄 New Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
