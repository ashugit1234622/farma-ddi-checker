import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Farma DDI Checker | AI-Powered Drug Interaction Analysis',
  description: 'Check drug-drug interactions with AI-powered analysis, ADME comparison charts, toxicity profiles, and clinical recommendations based on KD Tripathi pharmacology.',
};

import CinematicIntro from '@/components/CinematicIntro';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CinematicIntro />
        <header className="header">
          <div className="logo">
            <span>💊 Farma</span> DDI Checker
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', padding: '0.3rem 0.7rem', background: 'var(--bg-hover)', borderRadius: '6px' }}>
              Powered by Gemini AI
            </span>
          </nav>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
