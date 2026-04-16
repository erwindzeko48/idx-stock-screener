'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StockDetail } from '@/types/stock';
import { PriceChart } from '@/components/PriceChart';
import { ValuationBreakdown } from '@/components/ValuationBreakdown';
import { FundamentalMetrics } from '@/components/FundamentalMetrics';
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = decodeURIComponent(params.symbol as string);

  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setDetail(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors hover:text-blue-400" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Kembali ke Dashboard
        </Link>
        <div className="glass-card p-16 text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#3b82f6', borderRightColor: '#6366f1' }} />
              <div className="absolute inset-2 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#22c55e', animationDirection: 'reverse', animationDuration: '0.7s' }} />
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Memuat data {symbol}...
          </p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-6 transition-colors hover:text-blue-400" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Kembali ke Dashboard
        </Link>
        <div className="glass-card p-16 text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Data tidak tersedia untuk {symbol}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Yahoo Finance tidak dapat mengambil data untuk saham ini saat ini.
          </p>
          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const { financials, valuation, priceHistory } = detail;
  const displaySymbol = financials.symbol.replace('.JK', '');

  const firstPrice = priceHistory?.[0]?.close;
  const priceChange = firstPrice ? ((financials.currentPrice - firstPrice) / firstPrice) * 100 : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors hover:text-blue-400"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={16} />
        Kembali ke Dashboard
      </Link>

      {/* Stock header */}
      <div className="glass-card p-6 mb-6 gradient-border">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shrink-0 border border-blue-500/20 bg-blue-500/10 text-blue-400"
            >
              {displaySymbol.slice(0, 2)}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {displaySymbol}
                </h1>
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold tracking-wide uppercase">
                  {valuation.passingMethodsCount} / 5 Methods Passed
                </span>
              </div>
              <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                {financials.name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Building2 size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{financials.sector}</span>
                <a href={`https://finance.yahoo.com/quote/${financials.symbol}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs transition-colors hover:text-blue-400" style={{ color: 'var(--text-muted)' }}>
                  Yahoo Finance <ExternalLink size={10} />
                </a>
                <button
                  onClick={() => { setLoading(true); setDetail(null); fetch(`/api/stock/${encodeURIComponent(symbol)}`).then(r => r.json()).then(setDetail).finally(() => setLoading(false)); }}
                  className="flex items-center gap-1 text-xs transition-colors hover:text-blue-400 ml-2 text-slate-500"
                >
                  <RefreshCw size={10} /> Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="font-mono text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
              Rp {financials.currentPrice.toLocaleString('id-ID')}
            </p>
            {priceChange !== null && (
              <p className="font-mono text-sm font-medium mt-0.5 flex items-center justify-end gap-1" style={{ color: priceChange >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {priceChange >= 0 ? <TrendingUp size={14}/> : <TrendingUp size={14} className="rotate-180" />}
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}% vs 1 tahun lalu
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
              Pergerakan Harga (1 Tahun)
            </h2>
            <PriceChart data={priceHistory ?? []} currentPrice={financials.currentPrice} />
          </div>
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              Breakdown 5 Metode Valuasi 
            </h2>
            <ValuationBreakdown valuation={valuation} currentPrice={financials.currentPrice} />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
            Metrik Fundamental Utama
          </h2>
          <FundamentalMetrics financials={financials} />
        </div>
      </div>
    </div>
  );
}
