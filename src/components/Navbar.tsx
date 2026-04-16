'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TrendingUp } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: 'rgba(3, 7, 17, 0.85)',
        borderBottom: '1px solid rgba(99, 120, 175, 0.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
            }}
          >
            <TrendingUp size={16} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
              IDX Screener
            </span>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Saham Indonesia
            </div>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              color: pathname === '/' ? '#60a5fa' : 'var(--text-secondary)',
              background: pathname === '/' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            }}
          >
            Dashboard
          </Link>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live" />
            IDX Live
          </div>
        </div>
      </div>
    </nav>
  );
}
