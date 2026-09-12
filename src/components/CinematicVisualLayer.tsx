'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CinematicVisualProps } from '../types';
import { SceneManager } from '../scene/SceneManager';

function isWebGLAvailable() { try { const canvas = document.createElement('canvas'); return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch { return false; } }

export function CinematicVisualLayer({ scrollProgress: controlledProgress, reducedMotion: controlledReducedMotion, onProgressChange, enablePointerParallax = true, autoPlayAtMidpoint = true, midpointThreshold = .5, autoPlayDuration = 10, className = '', style = {} }: CinematicVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const managerRef = useRef<SceneManager | null>(null); const frameRef = useRef<number | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0); const [autoProgress, setAutoProgress] = useState<number | null>(null); const [webglSupported, setWebglSupported] = useState(true); const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const reducedMotion = controlledReducedMotion ?? systemReducedMotion;
  useEffect(() => { const media = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setSystemReducedMotion(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { if (!isWebGLAvailable() || !canvasRef.current) { setWebglSupported(false); return; } try { managerRef.current = new SceneManager(canvasRef.current); } catch (error) { console.warn('CinematicVisualLayer: WebGL initialization failed', error); setWebglSupported(false); return; } const observer = new ResizeObserver(([entry]) => managerRef.current?.resize(entry.contentRect.width, entry.contentRect.height)); if (containerRef.current) observer.observe(containerRef.current); return () => { observer.disconnect(); managerRef.current?.dispose(); managerRef.current = null; }; }, []);
  useEffect(() => { managerRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);
  useEffect(() => { if (controlledProgress !== undefined) return; const update = () => { const max = document.documentElement.scrollHeight - window.innerHeight; const value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0; setScrollProgress(value); onProgressChange?.(value, Math.floor(value * 3)); }; window.addEventListener('scroll', update, { passive: true }); update(); return () => window.removeEventListener('scroll', update); }, [controlledProgress, onProgressChange]);
  const baseProgress = controlledProgress ?? scrollProgress;
  useEffect(() => { if (!autoPlayAtMidpoint || reducedMotion || baseProgress < midpointThreshold || autoProgress !== null) return; const start = performance.now(), duration = Math.max(2000, (1 - baseProgress) * autoPlayDuration * 1000); const animate = (now: number) => { const t = Math.min(1, (now - start) / duration); setAutoProgress(baseProgress + (1 - Math.pow(1 - t, 2.2)) * (1 - baseProgress)); if (t < 1) frameRef.current = requestAnimationFrame(animate); }; frameRef.current = requestAnimationFrame(animate); return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }; }, [autoPlayAtMidpoint, autoPlayDuration, autoProgress, baseProgress, midpointThreshold, reducedMotion]);
  useEffect(() => { if (baseProgress < midpointThreshold * .75) setAutoProgress(null); }, [baseProgress, midpointThreshold]);
  useEffect(() => { managerRef.current?.setProgress(Math.max(baseProgress, autoProgress ?? 0)); }, [autoProgress, baseProgress]);
  const movePointer = useCallback((event: PointerEvent) => managerRef.current?.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1), []);
  useEffect(() => { if (!enablePointerParallax || reducedMotion) return; window.addEventListener('pointermove', movePointer, { passive: true }); return () => window.removeEventListener('pointermove', movePointer); }, [enablePointerParallax, movePointer, reducedMotion]);
  return <div ref={containerRef} id="cinematic-visual-container" className={`cinematic-visual-layer ${className}`} style={style} aria-hidden="true">{webglSupported ? <canvas ref={canvasRef} id="cinematic-visual-canvas" /> : <div className="cinematic-visual-fallback" />}</div>;
}
