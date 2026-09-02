import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Farma DDI Checker | AI-Powered Pharmacology',
  description: 'Evidence-grounded pharmacology analysis assistant and Drug-Drug Interaction platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="logo">
            <span>Farma</span> DDI Checker
          </div>
          <nav>
            <a href="https://github.com/example/farma-ddi" target="_blank" rel="noreferrer">
              Documentation
            </a>
          </nav>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
