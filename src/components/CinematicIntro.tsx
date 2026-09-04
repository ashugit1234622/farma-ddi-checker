'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const INTRO_ENABLED = true;
const PLAY_INTRO_ON_RETURNING_VISITS = false;

type IntroState =
  | 'LOADING'
  | 'BACKGROUND'
  | 'BORDERLESS_PILL'
  | 'CLICKABLE_PILL'
  | 'CRACK_ANIMATION'
  | 'TRANSPARENT_PILL'
  | 'BURST_FADE_IN'
  | 'ZOOM_REVEAL'
  | 'COMPLETE';

// Shared style for full-viewport image layers
const fullLayerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center 40%', // Shift visible area up to crop the bottom edge
  pointerEvents: 'none',
  userSelect: 'none',
};

export default function CinematicIntro() {
  const [stage, setStage] = useState<IntroState>('LOADING');
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const scrollCount = useRef(0);
  const lastScrollTime = useRef(0);
  const stageRef = useRef<IntroState>(stage);

  // Keep stageRef in sync so touch handlers always see current stage
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  // --- LIFECYCLE: preload & init ---
  useEffect(() => {
    if (!INTRO_ENABLED) {
      setStage('COMPLETE');
      return;
    }

    const hasSeenIntro = sessionStorage.getItem('farma_intro_seen');
    const isDebug = window.location.search.includes('introDebug=true');

    if (hasSeenIntro && !PLAY_INTRO_ON_RETURNING_VISITS && !isDebug) {
      setStage('COMPLETE');
      return;
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) setIsReducedMotion(true);

    if (stage === 'LOADING') {
      const srcs = [
        '/intro/only background.png',
        '/intro/pill without border.jpg',
        '/intro/pill with border.png',
        '/intro/pill crack image.png',
        '/intro/pill remove backgrund.png',
        '/intro/pill crack burst image.png',
      ];
      Promise.all(
        srcs.map(
          (src) =>
            new Promise<void>((res) => {
              const img = new Image();
              img.src = src;
              img.onload = () => res();
              img.onerror = () => res();
            })
        )
      ).then(() => setStage('BACKGROUND'));
    }
  }, [stage]);

  // --- LIFECYCLE: timed stage transitions ---
  useEffect(() => {
    if (stage === 'BACKGROUND') {
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => setStage('BORDERLESS_PILL'), 1100);
      return () => clearTimeout(t);
    }
    if (stage === 'BORDERLESS_PILL') {
      const t = setTimeout(() => setStage('CLICKABLE_PILL'), 1000);
      return () => clearTimeout(t);
    }
    if (stage === 'CRACK_ANIMATION') {
      const t = setTimeout(() => setStage('TRANSPARENT_PILL'), 1000);
      return () => clearTimeout(t);
    }
    if (stage === 'ZOOM_REVEAL') {
      sessionStorage.setItem('farma_intro_seen', 'true');
      const t = setTimeout(() => {
        setStage('COMPLETE');
        document.body.style.overflow = '';
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [stage]);

  // --- CLEANUP ---
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // --- PILL CLICK ---
  const handlePillClick = () => {
    if (stage !== 'CLICKABLE_PILL') return;
    if (isReducedMotion) {
      setStage('ZOOM_REVEAL');
    } else {
      setStage('CRACK_ANIMATION');
    }
  };

  // --- SCROLL GESTURE (debounced) ---
  const handleScrollGesture = useCallback(
    (e: Event) => {
      if (stage === 'COMPLETE') return;
      e.preventDefault();

      if (stage !== 'TRANSPARENT_PILL' && stage !== 'BURST_FADE_IN') return;

      const now = Date.now();
      if (now - lastScrollTime.current < 800) return;

      lastScrollTime.current = now;
      scrollCount.current += 1;

      if (stage === 'TRANSPARENT_PILL' && scrollCount.current === 1) {
        setStage('BURST_FADE_IN');
      } else if (stage === 'BURST_FADE_IN' && scrollCount.current >= 2) {
        setStage('ZOOM_REVEAL');
      }
    },
    [stage]
  );

  // --- EVENT LISTENERS ---
  useEffect(() => {
    if (stage === 'COMPLETE') return;

    const opts = { passive: false } as AddEventListenerOptions;

    window.addEventListener('wheel', handleScrollGesture, opts);

    let touchStartY = 0;
    let touchStartTime = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dy = Math.abs(touchStartY - e.changedTouches[0].clientY);
      const dt = Date.now() - touchStartTime;

      // Short tap with minimal movement = pill click on mobile
      if (dy < 15 && dt < 400 && stageRef.current === 'CLICKABLE_PILL') {
        // Don't preventDefault here — let the tap register
        setStage('CRACK_ANIMATION');
        return;
      }

      if (e.cancelable) e.preventDefault();
      if (dy > 30) handleScrollGesture(e);
    };

    window.addEventListener('touchstart', onTouchStart, opts);
    window.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('touchend', onTouchEnd, opts);

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.code)) {
        handleScrollGesture(e);
      }
    };
    window.addEventListener('keydown', onKeyDown, opts);

    return () => {
      window.removeEventListener('wheel', handleScrollGesture);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleScrollGesture, stage]);

  // --- BAIL EARLY ---
  if (stage === 'COMPLETE') return null;

  // --- VISIBILITY FLAGS ---
  const showBg = stage !== 'LOADING';
  const showBorderless = ['BORDERLESS_PILL', 'CLICKABLE_PILL'].includes(stage);
  const showBordered = stage === 'CLICKABLE_PILL';
  const showCracked = ['CRACK_ANIMATION', 'TRANSPARENT_PILL', 'BURST_FADE_IN', 'ZOOM_REVEAL'].includes(stage);
  const showTransparent = ['TRANSPARENT_PILL', 'BURST_FADE_IN', 'ZOOM_REVEAL'].includes(stage);
  const showBurst = ['BURST_FADE_IN', 'ZOOM_REVEAL'].includes(stage);
  const isZooming = stage === 'ZOOM_REVEAL';

  return (
    <>
      <div
        className="cinematic-intro-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          overflow: 'hidden',
          backgroundColor: '#0a6bcb',
          opacity: isZooming ? 0 : 1,
          transition: 'opacity 1.6s cubic-bezier(0.76, 0, 0.24, 1)',
          pointerEvents: isZooming ? 'none' : 'auto',
          touchAction: 'none',
        }}
      >
        {/* ── Layer 0: Background ── */}
        <img
          src="/intro/only background.png"
          alt=""
          draggable={false}
          style={{
            ...fullLayerStyle,
            opacity: showBg ? 1 : 0,
            transition: 'opacity 1.1s ease-out',
          }}
        />

        {/* ── Layer 1: Borderless pill (full-viewport, blends with bg) ── */}
        <img
          src="/intro/pill without border.jpg"
          alt=""
          draggable={false}
          style={{
            ...fullLayerStyle,
            opacity: showBorderless ? 1 : 0,
            transform: showBorderless ? 'scale(1) translateZ(0)' : 'scale(1.04) translateZ(0)',
            transition: 'opacity 1s ease, transform 1s ease-out',
          }}
        />

        {/* ── Layer 2: Bordered pill (full-viewport, clickable) ── */}
        <img
          src="/intro/pill with border.png"
          alt="Click the pill"
          draggable={false}
          onClick={handlePillClick}
          onTouchEnd={(e) => {
            // Backup mobile tap handler directly on the element
            if (stage === 'CLICKABLE_PILL') {
              e.stopPropagation();
              handlePillClick();
            }
          }}
          style={{
            ...fullLayerStyle,
            opacity: showBordered ? 1 : 0,
            transition: 'opacity 0.7s ease',
            cursor: showBordered ? 'pointer' : 'default',
            pointerEvents: showBordered ? 'auto' : 'none',
            animation: showBordered && !isReducedMotion ? 'introBreath 3s infinite ease-in-out' : 'none',
          }}
        />

        {/* ── Layer 3: Cracked pill ── */}
        <img
          src="/intro/pill crack image.png"
          alt=""
          draggable={false}
          style={{
            ...fullLayerStyle,
            opacity: showCracked ? 1 : 0,
            transform: showCracked ? 'scale(1.02) translateZ(0)' : 'scale(1) translateZ(0)',
            transition: 'opacity 0.18s ease-in, transform 0.18s ease-out',
          }}
        />

        {/* ── Layer 4: Transparent pill overlay ── */}
        <img
          src="/intro/pill remove backgrund.png"
          alt=""
          draggable={false}
          style={{
            ...fullLayerStyle,
            opacity: showTransparent ? 1 : 0,
            transition: 'opacity 0.5s ease',
            zIndex: 2,
          }}
        />

        {/* ── Layer 5: Burst image ── */}
        <img
          src="/intro/pill crack burst image.png"
          alt=""
          draggable={false}
          style={{
            ...fullLayerStyle,
            opacity: showBurst ? 1 : 0,
            transform: isZooming ? 'scale(4) translateZ(0)' : 'scale(1) translateZ(0)',
            transition: isZooming
              ? 'opacity 0.8s ease, transform 1.6s cubic-bezier(0.76, 0, 0.24, 1)'
              : 'opacity 0.8s ease, transform 0.5s ease',
            zIndex: 3,
          }}
        />

        {/* ── Microcopy: "Tap to begin" ── */}
        <div
          style={{
            position: 'absolute',
            bottom: '8vh',
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 10,
            opacity: showBordered ? 1 : 0,
            transition: 'opacity 0.7s ease',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
              fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 300,
            }}
          >
            Tap to begin
          </span>
        </div>

        {/* ── Microcopy: "Scroll to explore" ── */}
        <div
          style={{
            position: 'absolute',
            bottom: '8vh',
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 10,
            opacity: showTransparent && !isZooming ? 1 : 0,
            transition: 'opacity 0.7s ease',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
              fontSize: 'clamp(0.7rem, 1.2vw, 0.9rem)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontWeight: 300,
            }}
          >
            Scroll to explore
          </span>
          {/* Animated scroll chevron */}
          <div
            style={{
              marginTop: '12px',
              animation: !isReducedMotion ? 'introChevron 2s infinite ease-in-out' : 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Global keyframes ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes introBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.008); }
        }
        @keyframes introChevron {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(6px); opacity: 1; }
        }
      `}} />
    </>
  );
}
