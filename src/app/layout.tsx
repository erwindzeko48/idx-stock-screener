import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'IDX Stock Screener — Temukan Saham Undervalued Indonesia',
  description:
    'Aplikasi screening saham Indonesia (IDX) berbasis fundamental. Identifikasi saham undervalued dengan DCF, PER, PBV, dan Graham Formula secara otomatis.',
  keywords: 'saham Indonesia, IDX, stock screener, undervalued, fundamental, investasi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div className="bg-mesh" />
        <Navbar />
        <main className="min-h-screen pt-16">
          {children}
        </main>
        <footer className="mt-20 pb-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>
            IDX Stock Screener • Data dari Yahoo Finance •{' '}
            <span className="mono">Diperbarui setiap jam</span>
          </p>
          <p className="mt-1">
            ⚠️ Bukan saran investasi. Lakukan riset sendiri sebelum berinvestasi.
          </p>
        </footer>
      </body>
    </html>
  );
}
