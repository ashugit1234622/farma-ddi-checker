'use client';

import React, { useState, useMemo } from 'react';
import { DDIAnalysis } from '../lib/ai/schemas';
import { Activity, AlertCircle } from 'lucide-react';

interface Props {
  report: DDIAnalysis | null;
  drug1Name: string;
  drug2Name: string;
}

type OrganKey = 'hepatic' | 'renal' | 'cardiac' | 'neuro' | 'hemato';

interface OrganDisplayData {
  id: OrganKey;
  label: string;
  score: number;
  affected: boolean;
  severity: 'low' | 'moderate' | 'high' | 'severe';
  condition: string;
  cause: string;
  color: string;
}

// Map score to color
function scoreToColor(score: number): string {
  if (score >= 70) return 'var(--danger)'; // Severe/High
  if (score >= 40) return 'var(--warning)'; // Moderate
  if (score > 30) return '#facc15'; // Yellow-ish for borderline low-moderate
  return 'var(--success)'; // Low (usually not shown as affected)
}

function scoreToSeverity(score: number): 'low' | 'moderate' | 'high' | 'severe' {
  if (score >= 80) return 'severe';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  return 'low';
}

function getConditionLabel(id: OrganKey): string {
  switch (id) {
    case 'hepatic': return 'Hepatic Toxicity Risk';
    case 'renal': return 'Nephrotoxicity Risk';
    case 'cardiac': return 'Cardiotoxicity Risk';
    case 'neuro': return 'Neurotoxicity Risk';
    case 'hemato': return 'Hematologic Toxicity Risk';
    default: return 'Toxicity Risk';
  }
}

export default function OrganToxicityAnatomy({ report, drug1Name, drug2Name }: Props) {
  const [activeOrgan, setActiveOrgan] = useState<OrganDisplayData | null>(null);

  const mappedOrgans = useMemo(() => {
    if (!report) return {};

    const d1 = report.toxicityScores.drug1;
    const d2 = report.toxicityScores.drug2;

    const organs: Record<string, OrganDisplayData> = {};
    const axes: OrganKey[] = ['hepatic', 'renal', 'cardiac', 'neuro', 'hemato'];

    axes.forEach(axis => {
      const maxScore = Math.max(d1[axis], d2[axis]);
      const affected = maxScore > 30; // Threshold for emphasizing an organ

      if (affected) {
        // Try to find a relevant concern line from the report
        const keywords = {
          hepatic: ['liver', 'hepatic', 'hepatotoxicity', 'enzyme'],
          renal: ['kidney', 'renal', 'nephrotoxicity', 'clearance'],
          cardiac: ['heart', 'cardiac', 'qt', 'arrhythmia', 'cardiotoxicity'],
          neuro: ['brain', 'neuro', 'cns', 'seizure', 'dizziness', 'sedation', 'confusion'],
          hemato: ['blood', 'hemato', 'bleeding', 'bone marrow', 'spleen', 'anemia']
        }[axis];

        let cause = report.toxicityAnalysis.combinedRiskAssessment;
        const matchedConcern = report.toxicityAnalysis.concerns.find(c => 
          keywords.some(k => c.toLowerCase().includes(k))
        );
        if (matchedConcern) {
          cause = matchedConcern;
        }

        organs[axis] = {
          id: axis,
          label: axis.charAt(0).toUpperCase() + axis.slice(1),
          score: maxScore,
          affected: true,
          severity: scoreToSeverity(maxScore),
          condition: getConditionLabel(axis),
          cause: cause,
          color: scoreToColor(maxScore)
        };
      }
    });

    return organs;
  }, [report]);

  if (!report || Object.keys(mappedOrgans).length === 0) {
    return null;
  }

  const handleMouseEnter = (id: OrganKey) => {
    if (mappedOrgans[id]) {
      setActiveOrgan(mappedOrgans[id]);
    }
  };

  const handleMouseLeave = () => {
    setActiveOrgan(null);
  };

  const getOrganClass = (id: OrganKey) => {
    const isAffected = !!mappedOrgans[id];
    const isHovered = activeOrgan?.id === id;
    let className = 'anatomy-organ';
    if (isAffected) className += ' affected';
    if (isHovered) className += ' hovered';
    return className;
  };

  const getOrganStyle = (id: OrganKey) => {
    const data = mappedOrgans[id];
    if (!data) return {};
    return {
      '--organ-color': data.color,
      '--organ-glow': `${data.color}33`, // 20% opacity
    } as React.CSSProperties;
  };

  return (
    <div className="anatomy-container print-hide">
      <div className="anatomy-title">Anatomical Risk</div>
      <div className="anatomy-svg-wrapper">
        <svg 
          viewBox="0 0 400 500" 
          className="anatomy-svg" 
          role="img" 
          aria-label="Human anatomy highlighting affected organs"
        >
          {/* BODY OUTLINE (Clean Mannequin) */}
          <g id="body-outline" opacity="0.2">
            {/* Head */}
            <circle cx="200" cy="80" r="45" fill="none" stroke="var(--text-main)" strokeWidth="3" />
            {/* Shoulders and Torso */}
            <path d="M 120 180 C 120 140, 280 140, 280 180 L 280 380 C 280 430, 120 430, 120 380 Z" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinejoin="round" />
            {/* Arms implied by outer line */}
            <path d="M 120 180 C 90 190, 80 250, 80 320 C 80 350, 100 350, 100 320 L 110 240 M 280 180 C 310 190, 320 250, 320 320 C 320 350, 300 350, 300 320 L 290 240" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="round" />
            {/* Legs implied */}
            <path d="M 160 420 L 160 480 C 160 500, 180 500, 180 480 L 180 420 M 240 420 L 240 480 C 240 500, 220 500, 220 480 L 220 420" fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* ── INTERACTIVE ORGANS ── */}

          {/* BRAIN (neuro) */}
          <g 
            id="organ-neuro" 
            className={getOrganClass('neuro')} 
            style={getOrganStyle('neuro')}
            onMouseEnter={() => handleMouseEnter('neuro')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('neuro')}
          >
            <path d="M 170 80 C 170 50, 230 50, 230 80 C 230 105, 170 105, 170 80 Z" />
            <circle cx="200" cy="80" r="35" fill="transparent" />
          </g>

          {/* HEART (cardiac) */}
          <g 
            id="organ-cardiac" 
            className={getOrganClass('cardiac')} 
            style={getOrganStyle('cardiac')}
            onMouseEnter={() => handleMouseEnter('cardiac')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('cardiac')}
          >
            <path d="M 200 230 C 200 230, 165 190, 165 170 C 165 150, 195 150, 200 170 C 205 150, 235 150, 235 170 C 235 190, 200 230, 200 230 Z" />
            <circle cx="200" cy="190" r="40" fill="transparent" />
          </g>

          {/* LIVER (hepatic) - Viewer's left */}
          <g 
            id="organ-hepatic" 
            className={getOrganClass('hepatic')} 
            style={getOrganStyle('hepatic')}
            onMouseEnter={() => handleMouseEnter('hepatic')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('hepatic')}
          >
            <path d="M 130 280 C 130 240, 240 245, 235 285 C 230 310, 160 310, 130 280 Z" />
            <ellipse cx="180" cy="280" rx="60" ry="35" fill="transparent" />
          </g>

          {/* KIDNEYS (renal) - Symmetrical */}
          <g 
            id="organ-renal" 
            className={getOrganClass('renal')} 
            style={getOrganStyle('renal')}
            onMouseEnter={() => handleMouseEnter('renal')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('renal')}
          >
            {/* Left Kidney */}
            <path d="M 160 320 C 140 310, 130 350, 150 360 C 170 370, 170 330, 160 320 Z" />
            {/* Right Kidney */}
            <path d="M 240 320 C 260 310, 270 350, 250 360 C 230 370, 230 330, 240 320 Z" />
            <rect x="120" y="300" width="160" height="80" fill="transparent" />
          </g>

          {/* SPLEEN/BLOOD (hemato) - Viewer's right */}
          <g 
            id="organ-hemato" 
            className={getOrganClass('hemato')} 
            style={getOrganStyle('hemato')}
            onMouseEnter={() => handleMouseEnter('hemato')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('hemato')}
          >
            <ellipse cx="250" cy="275" rx="15" ry="25" transform="rotate(25 250 275)" />
            <circle cx="250" cy="275" r="30" fill="transparent" />
          </g>

        </svg>

        {/* POPOVER */}
        <div className={`anatomy-popover ${activeOrgan ? 'active' : ''}`}>
          {activeOrgan && (
            <div className="anatomy-popover-content">
              <div className="popover-header">
                <span className="popover-title">{activeOrgan.label}</span>
                <span className={`popover-badge severity-${activeOrgan.severity}`} style={{ backgroundColor: `${activeOrgan.color}22`, color: activeOrgan.color }}>
                  {activeOrgan.severity.charAt(0).toUpperCase() + activeOrgan.severity.slice(1)}
                </span>
              </div>
              
              <div className="popover-section">
                <div className="popover-label"><Activity size={12} className="icon" /> Condition</div>
                <div className="popover-text">{activeOrgan.condition}</div>
              </div>

              {activeOrgan.cause && (
                <div className="popover-section">
                  <div className="popover-label"><AlertCircle size={12} className="icon" /> Cause</div>
                  <div className="popover-text text-muted">{activeOrgan.cause}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
