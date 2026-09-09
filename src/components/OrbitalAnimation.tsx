'use client';

import React, { useEffect, useRef } from 'react';

export type VoiceState = 'listening' | 'processing' | 'speaking' | 'ready';

interface OrbitalAnimationProps {
  state: VoiceState;
  amplitude?: number; // 0–1 for speaking amplitude
}

export default function OrbitalAnimation({ state, amplitude = 0 }: OrbitalAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const stateRef = useRef<VoiceState>(state);
  const amplitudeRef = useRef<number>(amplitude);

  // Keep refs in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { amplitudeRef.current = amplitude; }, [amplitude]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const PARTICLES = 3; // Orbital rings

    // Orbit definitions: [radius, count, size, speed, hue]
    const orbits = [
      { r: 56, count: 6, size: 2.5, speed: 0.6, hue: 195 },
      { r: 80, count: 9, size: 2.0, speed: -0.4, hue: 215 },
      { r: 106, count: 12, size: 1.5, speed: 0.25, hue: 185 },
    ];

    const draw = (ts: number) => {
      const dt = Math.min(ts - timeRef.current, 50);
      timeRef.current = ts;

      const st = stateRef.current;
      const amp = amplitudeRef.current;

      // Speed multipliers per state
      const speedMult =
        st === 'processing' ? 2.5 :
        st === 'speaking' ? 1.6 + amp * 1.8 :
        st === 'listening' ? 1.0 :
        0.6; // ready

      // Core pulse
      const corePulse =
        st === 'speaking' ? 0.08 + amp * 0.18 :
        st === 'processing' ? 0.12 :
        st === 'listening' ? 0.06 :
        0.03;

      const t = ts * 0.001; // seconds

      ctx.clearRect(0, 0, W, H);

      // ─── Outer glow ring ──────────────────────────────────────
      const glowR = 38 + Math.sin(t * (st === 'speaking' ? 3 : 1.5)) * corePulse * 38;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR * 2.2);
      grad.addColorStop(0, `hsla(195, 100%, 65%, 0.18)`);
      grad.addColorStop(0.6, `hsla(215, 100%, 55%, 0.07)`);
      grad.addColorStop(1, `hsla(215, 100%, 50%, 0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, glowR * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // ─── Orbital rings ────────────────────────────────────────
      orbits.forEach((orb, oi) => {
        const baseAngle = t * orb.speed * speedMult * Math.PI * 2;
        const activeR = orb.r + (st === 'speaking' ? amp * 10 : 0);

        for (let pi = 0; pi < orb.count; pi++) {
          const angle = baseAngle + (pi / orb.count) * Math.PI * 2;
          const px = cx + Math.cos(angle) * activeR;
          const py = cy + Math.sin(angle) * activeR;

          // Particle size variation
          const sizeVar = orb.size * (0.7 + 0.3 * Math.sin(t * 2 + pi * 0.8));
          const opacity =
            st === 'ready' ? 0.25 :
            st === 'processing' ? 0.55 + 0.35 * Math.sin(t * 8 + pi) :
            0.55 + 0.35 * Math.sin(t * 2 + pi);

          ctx.beginPath();
          ctx.arc(px, py, sizeVar, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${orb.hue}, 100%, 70%, ${opacity})`;
          ctx.fill();

          // Trailing tail
          const tx2 = cx + Math.cos(angle - 0.22) * activeR;
          const ty2 = cy + Math.sin(angle - 0.22) * activeR;
          ctx.beginPath();
          ctx.arc(tx2, ty2, sizeVar * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${orb.hue}, 100%, 70%, ${opacity * 0.35})`;
          ctx.fill();
        }
      });

      // ─── Central core ─────────────────────────────────────────
      const coreR = 22 + Math.sin(t * (st === 'speaking' ? 4 : 2)) * corePulse * 22;

      // Outer aura
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2);
      coreGrad.addColorStop(0, `hsla(195, 100%, 75%, 0.9)`);
      coreGrad.addColorStop(0.35, `hsla(210, 100%, 60%, 0.6)`);
      coreGrad.addColorStop(0.7, `hsla(220, 100%, 50%, 0.15)`);
      coreGrad.addColorStop(1, `hsla(220, 100%, 45%, 0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Inner solid core
      const innerGrad = ctx.createRadialGradient(cx - coreR * 0.3, cy - coreR * 0.3, 0, cx, cy, coreR);
      innerGrad.addColorStop(0, `hsla(190, 100%, 90%, 1)`);
      innerGrad.addColorStop(0.5, `hsla(200, 100%, 65%, 0.95)`);
      innerGrad.addColorStop(1, `hsla(215, 100%, 45%, 0.8)`);
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      // Processing: rotating cross-hatch data lines
      if (st === 'processing') {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 3);
        ctx.strokeStyle = `hsla(195, 100%, 80%, 0.4)`;
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(0, -50);
          ctx.lineTo(0, 50);
          ctx.stroke();
          ctx.rotate(Math.PI / 4);
        }
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={260}
      style={{ display: 'block' }}
      aria-hidden="true"
    />
  );
}
