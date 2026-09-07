'use client';

import React, { useEffect, useState } from 'react';

// Assuming DrugSearchResult has `name` property
interface DrugStub {
  name: string;
}

interface AnalysisScannerProps {
  isAnalyzing: boolean;
  drug1: DrugStub | null;
  drug2: DrugStub | null;
  currentStepText: string;
}

const CustomPill = ({ color, name, style }: { color: string, name: string, style?: React.CSSProperties }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', ...style }}>
    <svg width="80" height="36" viewBox="0 0 80 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="76" height="32" rx="16" stroke={color} strokeWidth="2" fill="var(--bg-card)" />
      <rect x="4" y="4" width="34" height="28" rx="14" fill={color} fillOpacity="0.25" />
      <line x1="40" y1="2" x2="40" y2="34" stroke={color} strokeWidth="2" strokeDasharray="3 3" opacity="0.6" />
      
      {/* Subtle details on the pill */}
      <circle cx="16" cy="18" r="3" fill={color} opacity="0.4" />
      <circle cx="24" cy="18" r="3" fill={color} opacity="0.4" />
      <path d="M50 14 H66 M50 22 H66" stroke={color} strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
    </svg>
    <div style={{ 
      fontSize: '0.85rem', 
      color: 'var(--text-main)', 
      fontWeight: 600, 
      maxWidth: '120px', 
      textAlign: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }}>
      {name || 'Unknown Drug'}
    </div>
  </div>
);

export default function AnalysisScanner({ isAnalyzing, drug1, drug2, currentStepText }: AnalysisScannerProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'entering' | 'plus' | 'scanning' | 'completing'>('idle');
  
  const [prevText, setPrevText] = useState('');
  const [text, setText] = useState('');
  const [morphing, setMorphing] = useState(false);

  // Lifecycle
  useEffect(() => {
    if (isAnalyzing) {
      setMounted(true);
      setPhase('entering');
      const t1 = setTimeout(() => setPhase('plus'), 800);
      const t2 = setTimeout(() => setPhase('scanning'), 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else if (mounted) {
      setPhase('completing');
      const t = setTimeout(() => {
        setMounted(false);
        setPhase('idle');
      }, 800); // Match exit transition duration
      return () => clearTimeout(t);
    }
  }, [isAnalyzing, mounted]);

  // Text morphing logic
  useEffect(() => {
    if (currentStepText !== text && isAnalyzing) {
      setPrevText(text);
      setText(currentStepText);
      setMorphing(true);
      const t = setTimeout(() => setMorphing(false), 500);
      return () => clearTimeout(t);
    }
  }, [currentStepText, text, isAnalyzing]);

  if (!mounted) return null;

  const isCompleting = phase === 'completing';
  const overlayOpacity = isCompleting ? 0 : 1;
  const contentScale = isCompleting ? 1.05 : 1;

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes scanSweep {
          0% { left: -15%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { left: 110%; opacity: 0; }
        }
        @keyframes textSlideOutUp {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-12px); }
        }
        @keyframes textSlideInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gridFade {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(10, 10, 12, 0.9)',
        backdropFilter: 'blur(8px)',
        opacity: overlayOpacity,
        transition: 'opacity 600ms ease',
        pointerEvents: 'all' // Block interactions while analyzing
      }}>
        
        {/* Subtle background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundSize: '40px 40px',
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)',
          animation: 'gridFade 4s infinite',
          pointerEvents: 'none'
        }} />

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transform: `scale(${contentScale})`,
          transition: 'transform 800ms ease',
        }}>
          
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '2.5rem', marginBottom: '2.5rem', padding: '1rem' }}>
            
            {/* Drug 1 Pill */}
            <div style={{ animation: 'slideInLeft 800ms cubic-bezier(0.25, 0.8, 0.25, 1) forwards' }}>
              <CustomPill color="var(--chart-drug1)" name={drug1?.name || 'Drug 1'} />
            </div>

            {/* Plus Sign */}
            <div style={{
              opacity: phase === 'entering' ? 0 : 1,
              animation: phase !== 'entering' ? 'fadeInScale 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
              fontSize: '1.5rem',
              color: 'var(--text-muted)',
              fontWeight: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              +
            </div>

            {/* Drug 2 Pill */}
            <div style={{ animation: 'slideInRight 800ms cubic-bezier(0.25, 0.8, 0.25, 1) forwards' }}>
              <CustomPill color="var(--chart-drug2)" name={drug2?.name || 'Drug 2'} />
            </div>

            {/* Scanner Line */}
            {phase === 'scanning' && !isCompleting && (
              <div style={{
                position: 'absolute',
                top: -30, bottom: -30,
                left: '-10%', width: '120%',
                pointerEvents: 'none',
                zIndex: 10,
                overflow: 'hidden',
                maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, bottom: 0,
                  width: '60px',
                  background: 'linear-gradient(to right, transparent, rgba(99, 102, 241, 0.1) 70%, rgba(99, 102, 241, 0.8) 98%, var(--accent-primary) 100%)',
                  boxShadow: '4px 0 15px rgba(99, 102, 241, 0.4)',
                  animation: 'scanSweep 2.2s infinite ease-in-out',
                  borderRight: '1px solid rgba(255,255,255,0.5)'
                }}>
                  {/* Subtle data points within scanner trail */}
                  <div style={{ position: 'absolute', right: 5, top: '20%', width: 3, height: 3, background: '#fff', borderRadius: '50%', opacity: 0.6 }} />
                  <div style={{ position: 'absolute', right: 15, top: '40%', width: 2, height: 2, background: '#fff', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ position: 'absolute', right: 8, top: '70%', width: 4, height: 2, background: '#fff', opacity: 0.5 }} />
                </div>
              </div>
            )}
          </div>

          {/* Morphing Status Text */}
          <div style={{
            position: 'relative',
            height: '24px',
            width: '100%',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            letterSpacing: '0.02em',
            opacity: isCompleting ? 0 : 1,
            transition: 'opacity 400ms ease'
          }}>
            {morphing && (
              <div style={{
                position: 'absolute', width: '100%',
                animation: 'textSlideOutUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
              }}>
                {prevText}
              </div>
            )}
            <div style={{
              position: 'absolute', width: '100%',
              animation: morphing ? 'textSlideInUp 400ms cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none'
            }}>
              {text || 'Initializing...'}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
