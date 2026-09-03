'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { DDIAnalysis } from "../lib/ai/schemas";

interface DrugSearchResult {
  id: string;
  name: string;
  genericName: string;
  drugClass: string[];
  synonyms: string[];
  indications: string[];
}

/* ══════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════ */

function severityToScore(severity: string): number {
  switch (severity) {
    case 'contraindicated': return 96;
    case 'major':           return 80;
    case 'moderate':        return 54;
    case 'minor':           return 25;
    default:                return 8;
  }
}

function scoreToColor(score: number): string {
  if (score >= 70) return 'var(--danger)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--success)';
}

function getToxClass(val: number): string {
  if (val <= 30) return 'toxicity-low';
  if (val <= 60) return 'toxicity-moderate';
  return 'toxicity-high';
}

const DOSE_MULTIPLIERS: Record<string, number> = {
  normal:  1.0,
  high:    1.5,
  elderly: 1.25,
};

/* ══════════════════════════════════════════════════════
   RADIAL RISK GAUGE
══════════════════════════════════════════════════════ */
function RadialGauge({ score, severity }: { score: number; severity: string }) {
  const [animScore, setAnimScore] = useState(0);
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  // Arc spans 270° (from 135° to 45°)
  const ARC = CIRC * 0.75;
  const offset = ARC - (animScore / 100) * ARC;
  const color = scoreToColor(animScore);

  useEffect(() => {
    const t = setTimeout(() => setAnimScore(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const label =
    severity === 'contraindicated' ? 'CONTRAINDICATED' :
    severity === 'major'           ? 'MAJOR RISK' :
    severity === 'moderate'        ? 'MODERATE RISK' :
    severity === 'minor'           ? 'MINOR RISK' : 'SAFE';

  return (
    <div className="gauge-wrapper">
      <svg viewBox="0 0 130 130" className="gauge-svg">
        {/* Track */}
        <circle
          cx="65" cy="65" r={R}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"
          strokeDasharray={`${ARC} ${CIRC}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform="rotate(135 65 65)"
        />
        {/* Value arc */}
        <circle
          cx="65" cy="65" r={R}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${ARC} ${CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(135 65 65)"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.25,0.8,0.25,1), stroke 0.6s ease', filter: `drop-shadow(0 0 8px ${color})` }}
        />
        {/* Score number */}
        <text x="65" y="60" textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="Inter,sans-serif">
          {Math.round(animScore)}
        </text>
        <text x="65" y="75" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8.5" fontFamily="Inter,sans-serif" letterSpacing="1">
          RISK SCORE
        </text>
      </svg>
      <div className="gauge-label" style={{ color }}>{label}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   RADAR CHART — pure SVG, zero deps
══════════════════════════════════════════════════════ */
type ToxScores = { hepatic: number; renal: number; cardiac: number; neuro: number; hemato: number };

function RadarChart({ d1, d2, drug1Name, drug2Name }: { d1: ToxScores; d2: ToxScores; drug1Name: string; drug2Name: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setProgress(1), 300);
    return () => clearTimeout(t);
  }, [d1, d2]);

  const SIZE = 200;
  const CENTER = SIZE / 2;
  const RADIUS = 80;
  const AXES = ['hepatic', 'renal', 'cardiac', 'neuro', 'hemato'] as const;
  const LABELS = ['Hepatic', 'Renal', 'Cardiac', 'Neuro', 'Hemato'];
  const N = AXES.length;

  // Convert axis index to angle (starting from top, going clockwise)
  function angle(i: number) { return (Math.PI * 2 * i) / N - Math.PI / 2; }
  function pt(i: number, val: number) {
    const r = (val / 100) * RADIUS * progress;
    return { x: CENTER + r * Math.cos(angle(i)), y: CENTER + r * Math.sin(angle(i)) };
  }
  function labelPt(i: number) {
    const r = RADIUS + 18;
    return { x: CENTER + r * Math.cos(angle(i)), y: CENTER + r * Math.sin(angle(i)) };
  }

  function polygon(scores: ToxScores, color: string, glow: string) {
    const points = AXES.map((a, i) => {
      const p = pt(i, scores[a]);
      return `${p.x},${p.y}`;
    }).join(' ');
    return (
      <>
        <polygon points={points} fill={color} opacity="0.18" />
        <polygon points={points} fill="none" stroke={glow} strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 6px ${glow})`, transition: 'all 1.2s cubic-bezier(0.25,0.8,0.25,1)' }} />
        {AXES.map((a, i) => {
          const p = pt(i, scores[a]);
          return <circle key={a} cx={p.x} cy={p.y} r="3" fill={glow}
            style={{ filter: `drop-shadow(0 0 4px ${glow})`, transition: 'all 1.2s ease' }} />;
        })}
      </>
    );
  }

  // Concentric rings for grid
  const rings = [25, 50, 75, 100];

  return (
    <div className="chart-container slide-up delay-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="chart-title">🧬 Organ Toxicity Radar</div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', maxWidth: 260, overflow: 'visible' }}>
        {/* Grid rings */}
        {rings.map(ring => {
          const rpts = AXES.map((_, i) => {
            const r = (ring / 100) * RADIUS;
            return `${CENTER + r * Math.cos(angle(i))},${CENTER + r * Math.sin(angle(i))}`;
          }).join(' ');
          return <polygon key={ring} points={rpts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
        })}
        {/* Axis lines */}
        {AXES.map((_, i) => {
          const ep = { x: CENTER + RADIUS * Math.cos(angle(i)), y: CENTER + RADIUS * Math.sin(angle(i)) };
          return <line key={i} x1={CENTER} y1={CENTER} x2={ep.x} y2={ep.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
        })}
        {/* Axis labels */}
        {LABELS.map((label, i) => {
          const lp = labelPt(i);
          return (
            <text key={label} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
              fill="rgba(255,255,255,0.45)" fontSize="8.5" fontFamily="Inter,sans-serif">{label}</text>
          );
        })}
        {/* Data polygons */}
        {polygon(d1, '#6366f1', '#818cf8')}
        {polygon(d2, '#06b6d4', '#22d3ee')}
      </svg>
      <div className="chart-legend" style={{ justifyContent: 'center', borderTop: 'none', paddingTop: 0, gap: '1.5rem' }}>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#818cf8' }} />{drug1Name}</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#22d3ee' }} />{drug2Name}</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ANIMATED BAR
══════════════════════════════════════════════════════ */
function AnimatedBar({ value, className, delay = 0 }: { value: number; className: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(value, 100)), 100 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div className="chart-bar-track">
      <div className={`chart-bar-fill animated ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ADME CHART
══════════════════════════════════════════════════════ */
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
            {report.admeScores.drug1[p]}<br />{report.admeScores.drug2[p]}
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

/* ══════════════════════════════════════════════════════
   DOSAGE SLIDER TOXICITY CHART
══════════════════════════════════════════════════════ */
function DosageToxicityChart({ report, drug1Name, drug2Name, multiplier }: {
  report: DDIAnalysis; drug1Name: string; drug2Name: string; multiplier: number;
}) {
  const params = ['hepatic', 'renal', 'cardiac', 'neuro', 'hemato'] as const;
  const labels: Record<string, string> = { hepatic: 'Hepatic', renal: 'Renal', cardiac: 'Cardiac', neuro: 'Neuro', hemato: 'Hemato' };

  return (
    <div className="chart-container slide-up delay-3">
      <div className="chart-title">☠️ Adjusted Toxicity Profile</div>
      {params.map((p, i) => {
        const v1 = Math.min(Math.round(report.toxicityScores.drug1[p] * multiplier), 100);
        const v2 = Math.min(Math.round(report.toxicityScores.drug2[p] * multiplier), 100);
        return (
          <div className="chart-row" key={p}>
            <div className="chart-label">{labels[p]}</div>
            <div className="chart-bars">
              <AnimatedBar value={v1} className={getToxClass(v1)} delay={i * 80} />
              <AnimatedBar value={v2} className={getToxClass(v2)} delay={i * 80 + 50} />
            </div>
            <div className="chart-value" style={{ fontSize: '0.65rem' }}>{v1}<br />{v2}</div>
          </div>
        );
      })}
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

/* ══════════════════════════════════════════════════════
   PRINT CLINICAL SUMMARY
══════════════════════════════════════════════════════ */
function handlePrint() {
  window.print();
}

/* ══════════════════════════════════════════════════════
   DRUG SEARCH BOX (shared)
══════════════════════════════════════════════════════ */
function DrugSearchBox({ label, drug, onSelect, onClear, accentColor }: {
  label: string;
  drug: DrugSearchResult | null;
  onSelect: (d: DrugSearchResult) => void;
  onClear: () => void;
  accentColor: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugSearchResult[]>([]);

  const search = async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data || []);
    } catch { /* ignore */ }
  };

  return (
    <div className="card" style={{ flex: '1 1 280px', minHeight: '180px' }}>
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 500 }}>{label}</h3>
      {!drug ? (
        <div style={{ position: 'relative' }}>
          <input
            className="input"
            placeholder="Search by name, class, or indication..."
            value={query}
            onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          />
          {results.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
              backgroundColor: 'var(--bg-card)', marginTop: '0.4rem',
              border: '1px solid var(--border)', borderRadius: '10px',
              maxHeight: '280px', overflowY: 'auto',
              boxShadow: '0 12px 28px rgba(0,0,0,0.4)'
            }}>
              {results.map(d => (
                <div key={d.id}
                  style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => { onSelect(d); setQuery(''); setResults([]); }}>
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
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-hover)', borderRadius: '10px', marginBottom: '0.75rem', borderLeft: `3px solid ${accentColor}` }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: accentColor }}>{drug.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{drug.genericName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>{drug.drugClass.join(' · ')}</div>
          </div>
          <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem', padding: '0.5rem' }} onClick={onClear}>
            Change
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function Home() {
  const [drug1, setDrug1] = useState<DrugSearchResult | null>(null);
  const [drug2, setDrug2] = useState<DrugSearchResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<DDIAnalysis | null>(null);
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [doseMode, setDoseMode] = useState<'normal' | 'high' | 'elderly'>('normal');
  const reportRef = useRef<HTMLDivElement>(null);

  // Stepper animation
  useEffect(() => {
    if (!analyzing) { setStepIndex(0); return; }
    const interval = setInterval(() => setStepIndex(prev => (prev < 3 ? prev + 1 : prev)), 2500);
    return () => clearInterval(interval);
  }, [analyzing]);

  const runAnalysis = useCallback(async (d1: DrugSearchResult, d2: DrugSearchResult) => {
    setAnalyzing(true);
    setReport(null);
    setError('');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug1Id: d1.id, drug2Id: d2.id })
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else if (json.data?.analysis) {
        setReport(json.data.analysis);
        setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
      } else if (json.data?.aiError) setError(json.data.aiError);
    } catch { setError('Failed to reach analysis service.'); }
    finally { setAnalyzing(false); }
  }, []);

  const handleAnalyze = () => { if (drug1 && drug2) runAnalysis(drug1, drug2); };

  const handleReset = () => { setDrug1(null); setDrug2(null); setReport(null); setError(''); setDoseMode('normal'); };

  // Quick-Swap alternative into Drug2
  const handleSwap = async (altName: string) => {
    try {
      const res = await fetch(`/api/drugs?q=${encodeURIComponent(altName)}`);
      const data = await res.json();
      const match = (data.data || [])[0] as DrugSearchResult | undefined;
      if (match && drug1) {
        setDrug2(match);
        runAnalysis(drug1, match);
      } else {
        // Alt not in local db — create a stub so AI can still analyze
        const stub: DrugSearchResult = { id: altName.toLowerCase().replace(/\s+/g, '-'), name: altName, genericName: altName, drugClass: [], synonyms: [], indications: [] };
        setDrug2(stub);
        if (drug1) runAnalysis(drug1, stub);
      }
    } catch { /* ignore */ }
  };

  const isInteraction = report?.overallStatus === 'interaction_detected';
  const riskScore = report ? severityToScore(report.severity) : 0;
  const multiplier = DOSE_MULTIPLIERS[doseMode];

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
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', paddingTop: '1.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💊</div>
        <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Drug-Drug Interaction Checker</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '550px', margin: '0 auto' }}>
          Select two drugs to check for interactions, view ADME & toxicity charts, and get AI-powered clinical analysis.
        </p>
      </div>

      {/* Drug Selection */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <DrugSearchBox
          label="Drug 1" drug={drug1} accentColor="var(--chart-drug1)"
          onSelect={d => { setDrug1(d); setReport(null); }}
          onClear={() => { setDrug1(null); setReport(null); }}
        />

        {/* Centre status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingTop: '1.5rem' }}>
          <div className={`interaction-indicator ${report ? (isInteraction ? 'indicator-danger' : 'indicator-safe') : 'indicator-pending'}`}>
            {report ? (isInteraction ? '⚠️' : '✅') : '⇄'}
          </div>
        </div>

        <DrugSearchBox
          label="Drug 2" drug={drug2} accentColor="var(--chart-drug2)"
          onSelect={d => { setDrug2(d); setReport(null); }}
          onClear={() => { setDrug2(null); setReport(null); }}
        />
      </div>

      {/* Check button */}
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
          <strong style={{ color: 'var(--danger)' }}>Error:</strong>{' '}
          <span style={{ color: 'var(--text-muted)' }}>{error}</span>
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

      {/* ── REPORT ── */}
      {report && (
        <div ref={reportRef} className="fade-in" style={{ marginTop: '2rem' }}>

          {/* ── Top Row: Status Banner + Gauge ── */}
          <div className="card scale-in" style={{ ...getSeverityStyle(), borderLeft: '4px solid', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Gauge */}
              <div style={{ flexShrink: 0 }}>
                <RadialGauge score={riskScore} severity={report.severity} />
              </div>
              {/* Summary */}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className={`status-badge ${isInteraction ? (report.severity === 'major' || report.severity === 'contraindicated' ? 'status-danger' : 'status-warning') : 'status-safe'}`}>
                  {report.severity === 'contraindicated' ? '⛔ CONTRAINDICATED' :
                   report.severity === 'major'           ? '🔴 MAJOR INTERACTION' :
                   report.severity === 'moderate'        ? '🟡 MODERATE INTERACTION' :
                   report.severity === 'minor'           ? '🟢 MINOR INTERACTION' : '✅ NO SIGNIFICANT INTERACTION'}
                </div>
                <p style={{ fontSize: '0.97rem', lineHeight: 1.7, marginTop: '0.75rem', color: 'var(--text-main)' }}>{report.executiveSummary}</p>
                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Confidence: <strong style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{report.confidence}</strong>
                  </div>
                </div>
              </div>
              {/* Print button */}
              <button className="btn btn-outline print-hide" style={{ fontSize: '0.82rem', padding: '0.5rem 0.9rem', flexShrink: 0 }} onClick={handlePrint}>
                📄 Print Summary
              </button>
            </div>
          </div>

          {/* ── Charts Row ── */}
          {/* Dosage slider */}
          <div className="card slide-up delay-1" style={{ marginBottom: '1rem', padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>💊 Dose Simulation:</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['normal', 'high', 'elderly'] as const).map(mode => (
                  <button key={mode} onClick={() => setDoseMode(mode)}
                    className={`dose-pill ${doseMode === mode ? 'dose-pill-active' : ''}`}>
                    {mode === 'normal' ? '⚖️ Normal' : mode === 'high' ? '⬆️ High Dose' : '👴 Elderly'}
                  </button>
                ))}
              </div>
              {doseMode !== 'normal' && (
                <span style={{ fontSize: '0.78rem', color: 'var(--warning)' }}>
                  ⚠ Toxicity scaled ×{multiplier.toFixed(2)} — bars may shift to higher risk
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <ADMEChart report={report} drug1Name={drug1?.name || 'Drug 1'} drug2Name={drug2?.name || 'Drug 2'} />
            <DosageToxicityChart report={report} drug1Name={drug1?.name || 'Drug 1'} drug2Name={drug2?.name || 'Drug 2'} multiplier={multiplier} />
            <RadarChart
              d1={{ ...report.toxicityScores.drug1 }}
              d2={{ ...report.toxicityScores.drug2 }}
              drug1Name={drug1?.name || 'Drug 1'}
              drug2Name={drug2?.name || 'Drug 2'}
            />
          </div>

          {/* ── Mechanisms ── */}
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

          {/* ── Clinical + ADME text ── */}
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

          {/* ── Alternatives with Quick-Swap ── */}
          {report.alternatives.length > 0 && (
            <div className="report-section slide-up delay-4" style={{ marginTop: '1.5rem' }}>
              <h3>💡 Suggested Alternatives</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                {isInteraction ? 'These drugs may carry lower interaction risk:' : 'Other options in the same therapeutic class:'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
                {report.alternatives.map((alt, i) => (
                  <div key={i} className="alt-card">
                    <div className="alt-name">{alt.drugName}</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.3rem 0 0.6rem' }}>{alt.rationale}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="alt-risk" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                        Risk: {alt.interactionRisk}
                      </span>
                      <button className="swap-btn print-hide" onClick={() => handleSwap(alt.drugName)}>
                        ⇄ Swap with Drug 2
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Monitoring + Dose Risk ── */}
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

          {/* ── Demographics ── */}
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
            ⚕️ <strong>Disclaimer:</strong> AI-generated analysis for informational purposes only. Does not replace professional clinical judgment.
          </div>

          {/* New Analysis */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }} className="print-hide">
            <button className="btn btn-outline" style={{ fontSize: '0.9rem' }} onClick={handleReset}>
              🔄 New Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
