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
          viewBox="0 0 400 600" 
          className="anatomy-svg" 
          role="img" 
          aria-label="Human anatomy highlighting affected organs"
        >
          {/* BODY OUTLINE (Subtle) */}
          <g id="body-outline" opacity="0.15">
            <path d="M200 40 C 230 40, 250 60, 250 90 C 250 120, 225 130, 235 150 C 265 160, 310 180, 310 220 L 300 350 C 295 400, 270 420, 260 450 L 260 550 C 260 580, 230 580, 220 550 L 210 400 L 190 400 L 180 550 C 170 580, 140 580, 140 550 L 140 450 C 130 420, 105 400, 100 350 L 90 220 C 90 180, 135 160, 165 150 C 175 130, 150 120, 150 90 C 150 60, 170 40, 200 40 Z" fill="none" stroke="var(--text-main)" strokeWidth="4" />
          </g>

          {/* LUNGS (Background/Neutral) */}
          <g id="lungs" opacity="0.1">
            <path d="M 160 180 C 130 190, 140 250, 145 280 C 150 310, 180 300, 190 290 C 195 285, 185 240, 160 180 Z" fill="var(--text-main)" />
            <path d="M 240 180 C 270 190, 260 250, 255 280 C 250 310, 220 300, 210 290 C 205 285, 215 240, 240 180 Z" fill="var(--text-main)" />
          </g>

          {/* STOMACH & INTESTINES (Background/Neutral) */}
          <g id="digestive-bg" opacity="0.1">
            <path d="M 210 280 C 250 280, 260 300, 250 330 C 240 350, 200 350, 180 340 C 160 330, 170 280, 210 280 Z" fill="var(--text-main)" />
            <path d="M 160 360 C 200 350, 240 350, 260 390 C 280 430, 240 460, 200 460 C 150 460, 130 420, 160 360 Z" fill="var(--text-main)" />
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
            <path d="M 200 55 C 225 55, 235 70, 235 90 C 235 110, 215 115, 200 120 C 185 115, 165 110, 165 90 C 165 70, 175 55, 200 55 Z" />
            <circle cx="200" cy="85" r="45" fill="transparent" />
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
            <path d="M 210 220 C 230 210, 245 230, 225 250 L 200 275 L 185 245 C 175 225, 195 210, 210 220 Z" />
            <circle cx="210" cy="240" r="40" fill="transparent" />
          </g>

          {/* LIVER (hepatic) */}
          <g 
            id="organ-hepatic" 
            className={getOrganClass('hepatic')} 
            style={getOrganStyle('hepatic')}
            onMouseEnter={() => handleMouseEnter('hepatic')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('hepatic')}
          >
            <path d="M 160 285 C 190 275, 230 280, 245 300 C 255 315, 240 335, 220 330 C 190 320, 155 310, 160 285 Z" />
            <ellipse cx="205" cy="305" rx="55" ry="35" fill="transparent" />
          </g>

          {/* KIDNEYS (renal) */}
          <g 
            id="organ-renal" 
            className={getOrganClass('renal')} 
            style={getOrganStyle('renal')}
            onMouseEnter={() => handleMouseEnter('renal')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('renal')}
          >
            <path d="M 175 320 C 165 315, 155 330, 165 345 C 175 355, 185 340, 175 320 Z" />
            <path d="M 225 320 C 235 315, 245 330, 235 345 C 225 355, 215 340, 225 320 Z" />
            <rect x="145" y="300" width="110" height="65" fill="transparent" />
          </g>

          {/* SPLEEN/BLOOD (hemato) */}
          <g 
            id="organ-hemato" 
            className={getOrganClass('hemato')} 
            style={getOrganStyle('hemato')}
            onMouseEnter={() => handleMouseEnter('hemato')}
            onMouseLeave={handleMouseLeave}
            onClick={() => handleMouseEnter('hemato')}
          >
            <path d="M 245 285 C 255 280, 265 290, 260 305 C 255 315, 245 310, 245 285 Z" />
            <circle cx="255" cy="295" r="30" fill="transparent" />
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
