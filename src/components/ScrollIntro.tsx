'use client';

import React, { useEffect, useRef, useState } from 'react';

interface ScrollIntroProps {
  onComplete: () => void;
}

export default function ScrollIntro({ onComplete }: ScrollIntroProps) {
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  
  // Track particles
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    rotation: number;
    vrot: number;
  }>>([]);

  const spawnParticles = (x: number, y: number, amount: number) => {
    for (let i = 0; i < amount; i++) {
      particlesRef.current.push({
        x,
        y: y + (Math.random() - 0.5) * 80, // Spread along the vertical crack
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2, // Slight upward initial velocity
        life: 0,
        maxLife: 60 + Math.random() * 40,
        size: 2 + Math.random() * 4,
        rotation: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 10
      });
    }
  };

  useEffect(() => {
    // Particle animation loop
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life++;
        p.vy += 0.15; // Gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vrot;

        if (p.life >= p.maxLife) {
          parts.splice(i, 1);
          continue;
        }

        const opacity = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.shadowColor = 'rgba(255,255,255,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
      }

      reqRef.current = requestAnimationFrame(animate);
    };
    reqRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    let lastProgress = 0;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Calculate the true maximum scrollable distance
          const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
          let p = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
          
          // Browser subpixel rounding safety net
          if (p > 0.99 || window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
            p = 1.0;
          }
          
          setProgress(p);

          // Spawn particles when passing the crack threshold (e.g., 0.2 to 0.4)
          if (p > 0.25 && p < 0.45 && p > lastProgress) {
            // Spawn intensity based on scroll speed
            spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 2 + Math.random() * 3);
          }
          
          lastProgress = p;

          if (p >= 1.0) {
            onComplete();
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial check
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [onComplete]);

  // Derived state for animation phases
  const isMorphing = progress > 0.7;
  const morphProgress = Math.max(0, (progress - 0.7) / 0.3); // 0 to 1
  const separationProgress = Math.max(0, Math.min(1, (progress - 0.2) / 0.5));
  
  const getTransform = (side: 'left' | 'right') => {
    const dir = side === 'left' ? -1 : 1;
    
    let x = 0;
    let scale = 1 + (Math.min(progress, 0.2) / 0.2) * 0.2; // Scale up to 1.2
    
    if (progress > 0.2) {
      x = dir * (separationProgress * 25); // vw
    }
    
    if (isMorphing) {
      x = dir * (25 + morphProgress * 5);
      scale = 1.2 - morphProgress * 0.2; // Return to scale 1
    }

    return `translateX(${x}vw) scale(${scale})`;
  };

  const getStyles = (side: 'left' | 'right'): React.CSSProperties => {
    // Base Pill Half styles
    const w = 60 + (morphProgress * 220); // morphs to ~280px wide
    const h = 240 - (morphProgress * 60); // morphs to ~180px tall
    
    const baseRadius = 120;
    const targetRadius = 16;
    const r = baseRadius - (morphProgress * (baseRadius - targetRadius));

    return {
      position: 'absolute',
      top: '50%',
      left: side === 'left' ? `calc(50% - ${w}px)` : '50%',
      width: `${w}px`,
      height: `${h}px`,
      transform: `translateY(-50%) ${getTransform(side)}`,
      transformOrigin: side === 'left' ? 'right center' : 'left center',
      borderRadius: side === 'left' ? `${r}px 0 0 ${r}px` : `0 ${r}px ${r}px 0`,
      backgroundColor: '#ffffff',
      boxShadow: isMorphing ? '0 4px 20px rgba(0,0,0,0.1)' : 'inset -10px 0 20px rgba(0,0,0,0.1), 0 10px 30px rgba(0,0,0,0.2)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      willChange: 'transform, width, height, border-radius'
    };
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 9999,
      pointerEvents: 'none',
      background: `radial-gradient(circle at center, rgba(10, 107, 203, ${1 - morphProgress}), rgba(5, 30, 60, ${1 - morphProgress}))`
    }}>
      <div style={{
        position: 'absolute',
        bottom: '10%',
        width: '100%',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Inter, sans-serif',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontSize: '0.85rem',
        opacity: Math.max(0, 1 - progress * 4), // Fades out early
        transition: 'opacity 0.2s'
      }}>
        Scroll to explore
      </div>

      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />

      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        {/* LEFT HALF */}
        <div style={getStyles('left')}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-card)',
            opacity: morphProgress,
            border: '1px solid var(--border)'
          }} />
          <div style={{
            opacity: Math.pow(morphProgress, 3),
            color: 'var(--text-main)',
            width: '100%',
            padding: '1.5rem',
            fontFamily: 'Inter, sans-serif'
          }}>
            <div style={{ width: '40%', height: '14px', background: 'var(--bg-hover)', borderRadius: '4px', marginBottom: '1rem' }} />
            <div style={{ width: '100%', height: '38px', background: 'var(--bg-hover)', borderRadius: '8px' }} />
          </div>
        </div>

        {/* RIGHT HALF */}
        <div style={getStyles('right')}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--bg-card)',
            opacity: morphProgress,
            border: '1px solid var(--border)'
          }} />
          <div style={{
            opacity: Math.pow(morphProgress, 3),
            color: 'var(--text-main)',
            width: '100%',
            padding: '1.5rem',
            fontFamily: 'Inter, sans-serif'
          }}>
            <div style={{ width: '40%', height: '14px', background: 'var(--bg-hover)', borderRadius: '4px', marginBottom: '1rem' }} />
            <div style={{ width: '100%', height: '38px', background: 'var(--bg-hover)', borderRadius: '8px' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
