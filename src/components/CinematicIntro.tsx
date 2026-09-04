'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

// Configuration
const INTRO_ENABLED = true;
const PLAY_INTRO_ON_RETURNING_VISITS = false; // Only play once unless in dev mode

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

export default function CinematicIntro() {
  const [stage, setStage] = useState<IntroState>('LOADING');
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  
  // Track scroll attempts
  const scrollCount = useRef(0);
  const lastScrollTime = useRef(0);

  // Initial sequence setup
  useEffect(() => {
    if (!INTRO_ENABLED) {
      setStage('COMPLETE');
      return;
    }

    // Check if returning visit
    const hasSeenIntro = sessionStorage.getItem('farma_intro_seen');
    const isDebug = window.location.search.includes('introDebug=true');
    
    if (hasSeenIntro && !PLAY_INTRO_ON_RETURNING_VISITS && !isDebug) {
      setStage('COMPLETE');
      return;
    }

    // Check reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsReducedMotion(true);
    }

    if (stage === 'LOADING') {
      // Preload critical images to avoid flashes
      const imgs = [
        '/intro/only background.png',
        '/intro/pill without border.jpg',
        '/intro/pill with border.png',
        '/intro/pill crack image.png',
        '/intro/pill remove backgrund.png',
        '/intro/pill crack burst image.png'
      ];
      Promise.all(imgs.map(src => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = resolve; // Continue even if error
        });
      })).then(() => {
        setStage('BACKGROUND');
      });
    }
  }, [stage]);

  // Handle stage progressions for initial load
  useEffect(() => {
    if (stage === 'BACKGROUND') {
      document.body.style.overflow = 'hidden'; // Lock scroll
      const t = setTimeout(() => setStage('BORDERLESS_PILL'), 1000); // 1s wait for bg fade
      return () => clearTimeout(t);
    }
    if (stage === 'BORDERLESS_PILL') {
      const t = setTimeout(() => setStage('CLICKABLE_PILL'), 1000);
      return () => clearTimeout(t);
    }
    if (stage === 'CRACK_ANIMATION') {
      const t = setTimeout(() => setStage('TRANSPARENT_PILL'), 1000); // 1s pause after crack
      return () => clearTimeout(t);
    }
    if (stage === 'ZOOM_REVEAL') {
      sessionStorage.setItem('farma_intro_seen', 'true');
      const t = setTimeout(() => {
        setStage('COMPLETE');
        document.body.style.overflow = ''; // Unlock scroll
      }, 1500); // 1.5s dramatic zoom time matches CSS
      return () => clearTimeout(t);
    }
  }, [stage]);

  // Clean up overflow on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle pill click
  const handlePillClick = () => {
    if (stage !== 'CLICKABLE_PILL') return;
    
    if (isReducedMotion) {
      // Skip straight to end for accessibility
      setStage('ZOOM_REVEAL');
    } else {
      setStage('CRACK_ANIMATION');
    }
  };

  // Handle scroll events (debounced)
  const handleScrollGesture = useCallback((e: Event) => {
    if (stage === 'COMPLETE') return;
    
    // Always prevent default scroll behavior while intro is active
    e.preventDefault(); 
    
    if (stage !== 'TRANSPARENT_PILL' && stage !== 'BURST_FADE_IN') {
      return;
    }

    const now = Date.now();
    if (now - lastScrollTime.current < 800) return; // 800ms debounce to prevent rapid firing

    lastScrollTime.current = now;
    scrollCount.current += 1;

    if (stage === 'TRANSPARENT_PILL' && scrollCount.current === 1) {
      setStage('BURST_FADE_IN');
    } else if (stage === 'BURST_FADE_IN' && scrollCount.current >= 2) {
      setStage('ZOOM_REVEAL');
    }
  }, [stage]);

  // Attach wheel/touch listeners safely with passive: false so we can preventDefault
  useEffect(() => {
    if (stage === 'COMPLETE') return;

    // We must use passive: false to block default scrolling
    const opts = { passive: false };
    
    // Desktop wheel
    window.addEventListener('wheel', handleScrollGesture, opts);
    
    // Mobile touch
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      // Prevent scrolling if not complete
      if (e.cancelable) e.preventDefault();
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const touchEndY = e.changedTouches[0].clientY;
      // Require at least a 30px swipe to register as a scroll step
      if (Math.abs(touchStartY - touchEndY) > 30) {
        handleScrollGesture(e);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, opts);
    window.addEventListener('touchmove', handleTouchMove, opts);
    window.addEventListener('touchend', handleTouchEnd, opts);
    
    // Keyboard support (space, arrow keys, page up/down)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.code)) {
        handleScrollGesture(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown, opts);

    return () => {
      window.removeEventListener('wheel', handleScrollGesture);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleScrollGesture, stage]);

  if (stage === 'COMPLETE') return null;

  // --- STYLING LOGIC ---

  // Opacities based on stage
  const showBg = stage !== 'LOADING';
  const showBorderless = ['BORDERLESS_PILL', 'CLICKABLE_PILL'].includes(stage);
  const showBordered = stage === 'CLICKABLE_PILL';
  const showCracked = ['CRACK_ANIMATION', 'TRANSPARENT_PILL', 'BURST_FADE_IN', 'ZOOM_REVEAL'].includes(stage);
  const showTransparent = ['TRANSPARENT_PILL', 'BURST_FADE_IN', 'ZOOM_REVEAL'].includes(stage);
  const showBurst = ['BURST_FADE_IN', 'ZOOM_REVEAL'].includes(stage);

  // Zoom logic
  const isZooming = stage === 'ZOOM_REVEAL';

  return (
    <div 
      className="intro-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#000',
        opacity: isZooming ? 0 : 1, // Entire container fades to reveal site behind
        transition: 'opacity 1.5s cubic-bezier(0.8, 0, 0.2, 1)',
        pointerEvents: isZooming ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none'
      }}
    >
      {/* 1. Base Background layer */}
      <img 
        src="/intro/only background.png" 
        alt="Cinematic Background"
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: showBg ? 1 : 0,
          transition: 'opacity 1s ease-out',
          userSelect: 'none'
        }}
      />

      {/* Pill Wrapper to handle scale/zoom */}
      <div 
        style={{
          position: 'relative',
          width: '45vw', // Responsive sizing
          minWidth: '350px',
          maxWidth: '600px',
          aspectRatio: '1/1',
          transform: isZooming ? 'scale(12) translateZ(0)' : 'scale(1) translateZ(0)',
          transition: isZooming ? 'transform 1.5s cubic-bezier(0.8, 0, 0.2, 1)' : 'transform 0.5s ease',
          willChange: 'transform'
        }}
      >
        
        {/* Layer 1: Borderless Pill */}
        <img 
          src="/intro/pill without border.jpg"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: showBorderless ? 1 : 0,
            transform: showBorderless ? 'scale(1)' : 'scale(0.96)',
            transition: 'opacity 0.9s ease, transform 0.9s ease-out',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />

        {/* Layer 2: Bordered Pill (Clickable) */}
        <img 
          src="/intro/pill with border.png"
          alt="Interactive Pill"
          onClick={handlePillClick}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: showBordered ? 1 : 0,
            transition: 'opacity 0.6s ease',
            cursor: showBordered ? 'pointer' : 'default',
            pointerEvents: showBordered ? 'auto' : 'none',
            userSelect: 'none',
            // Subtle breathing effect
            animation: showBordered && !isReducedMotion ? 'pillBreathe 3s infinite ease-in-out' : 'none'
          }}
        />

        {/* Layer 3: Cracked Pill Background replacement */}
        <img 
          src="/intro/pill crack image.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: showCracked ? 1 : 0,
            transform: showCracked ? 'scale(1.03)' : 'scale(1)',
            transition: 'opacity 0.15s ease-in, transform 0.15s ease-out', // Fast pop effect
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        />

        {/* Layer 4: Transparent Cracked Pill overlay */}
        <img 
          src="/intro/pill remove backgrund.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: showTransparent ? 1 : 0,
            transition: 'opacity 0.5s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 10 
          }}
        />

        {/* Layer 5: Burst Image */}
        <img 
          src="/intro/pill crack burst image.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: showBurst ? 1 : 0,
            transition: 'opacity 0.8s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 11
          }}
        />
        
        {/* Helper Text */}
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
          opacity: showBordered ? 1 : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
          userSelect: 'none'
        }}>
          Tap to begin
        </div>
        
        {/* Scroll Helper Text */}
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
          opacity: showTransparent && !isZooming ? 1 : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
          userSelect: 'none'
        }}>
          Scroll to explore
        </div>
      </div>
      
      {/* Global styles for animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pillBreathe {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(255,255,255,0)); }
          50% { transform: scale(1.015); filter: drop-shadow(0 0 15px rgba(255,255,255,0.1)); }
        }
      `}} />
    </div>
  );
}
