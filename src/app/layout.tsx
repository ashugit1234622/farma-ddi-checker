import type { Metadata } from 'next';
import './globals.css';
import './medcheck.css';

export const metadata: Metadata = {
  title: 'Farma DDI Checker | AI-Powered Drug Interaction Analysis',
  description: 'Check drug-drug interactions with AI-powered analysis, ADME comparison charts, toxicity profiles, and clinical recommendations based on KD Tripathi pharmacology.',
};

import CinematicIntro from '@/components/CinematicIntro';
import Header from '@/components/Header';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <CinematicIntro />
        <Header />
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
