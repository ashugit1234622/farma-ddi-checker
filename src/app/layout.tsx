import type { Metadata, Viewport } from 'next';
import './globals.css';
import './medcheck.css';
import './pwa.css';
import Script from 'next/script';
import CinematicIntro from '@/components/CinematicIntro';
import Header from '@/components/Header';

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Farma DDI Checker | AI-Powered Drug Interaction Analysis',
  description:
    'Check drug-drug interactions with AI-powered analysis, ADME comparison charts, toxicity profiles, and clinical recommendations based on KD Tripathi pharmacology.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Farma DDI',
  },
  icons: {
    icon: '/icon-512.jpg',
    apple: '/icon-512.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Farma DDI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0d1117" />
        <meta name="msapplication-TileImage" content="/icon-512.jpg" />
      </head>
      <body>
        {/* Service Worker Registration */}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(reg) { console.log('[SW] Registered:', reg.scope); })
                    .catch(function(err) { console.warn('[SW] Registration failed:', err); });
                });
              }
            `,
          }}
        />
        <CinematicIntro />
        <Header />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
