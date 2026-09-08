'use client';

import React, { useState } from 'react';
import { Menu, ScanBarcode, X } from 'lucide-react';
import MedCheck from './MedCheck';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMedCheckOpen, setIsMedCheckOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
  };

  const openMedCheck = () => {
    setIsMedCheckOpen(true);
    setIsMenuOpen(false); // Close the hamburger menu
  };

  const closeMedCheck = () => {
    setIsMedCheckOpen(false);
  };

  return (
    <>
      <header className="header" style={{ position: 'relative', zIndex: 50 }}>
        <div className="logo">
          <span>💊 Farma</span> DDI Checker
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="print-hide" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0.3rem 0.7rem', background: 'var(--bg-hover)', borderRadius: '6px' }}>
            Powered by Gemini AI
          </span>
          
          <div className="hamburger-container print-hide" style={{ position: 'relative' }}>
            <button 
              onClick={toggleMenu}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
                borderRadius: '8px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              aria-label="Menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {isMenuOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  minWidth: '200px',
                  padding: '0.5rem',
                  zIndex: 100,
                  animation: 'fadeIn 0.2s ease'
                }}
              >
                <button
                  onClick={openMedCheck}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ScanBarcode size={20} style={{ color: 'var(--accent-primary)' }} />
                  MedCheck
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Full Screen MedCheck Overlay */}
      {isMedCheckOpen && <MedCheck onClose={closeMedCheck} />}
    </>
  );
}
