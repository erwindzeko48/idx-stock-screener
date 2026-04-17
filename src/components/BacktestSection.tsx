'use client';

import { useState } from 'react';
import { BacktestResult, ValuationVal } from '@/types/stock';
import { TrendingUp, TrendingDown, Minus, Clock, RefreshCw, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  symbol: string;
}

function SignalBadge({ signal }: { signal: ValuationVal }) {
  const cfg = {
    UNDERVALUED:       { label: 'Undervalued',      cls: 'bg-green-500/15  text-green-400  border-green-500/30' },
    FAIR_VALUE:        { label: 'Fair Value',        cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    OVERVALUED:        { label: 'Overvalued',        cls: 'bg-red-500/15    text-red-400    border-red-500/30' },
    INSUFFICIENT_DATA: { label: 'Data Kurang',       cls: 'bg-slate-500/15  text-slate-400  border-slate-500/30' },
  };
  const { label, cls } = cfg[signal];
  return (
    <span className={clsx('text-[11px] px-2 py-0.5 rounded border font-semibold', cls)}>
      {label}
    </span>
  );
}

function AccuracyIcon({ accurate }: { accurate: boolean | null }) {
  if (accurate === null) return <HelpCircle size={14} className="text-slate-500" />;
  if (accurate) return <CheckCircle2 size={14} className="text-green-400" />;
  return <XCircle size={14} className="text-red-400" />;
}

function ReturnCell({ pct }: { pct: number }) {
  const isPos = pct >= 0;
  return (
    <span className={clsx('font-mono font-bold text-sm', isPos ? 'text-green-400' : 'text-red-400')}>
      {isPos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

const METHODS = [
  { key: 'meanReversion', label: 'Historis P/E (Mean Reversion)' },
  { key: 'graham',        label: 'Graham Number' },
  { key: 'dcf',           label: 'DCF Model' },
  { key: 'dividendYield', label: 'Dividend Yield Reversion' },
] as const;

export function BacktestSection({ symbol }: Props) {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}/backtest`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Gagal memuat data simulasi');
      }
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-5 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Clock size={16} className="text-violet-400" />
            Simulasi Historis (Backtest 1 Tahun)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Jika Anda membeli berdasarkan sinyal 1 tahun lalu, seberapa akurat setiap metode?
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                     bg-violet-500/15 text-violet-400 border border-violet-500/30
                     hover:bg-violet-500/25 transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Menghitung...' : data ? 'Hitung Ulang' : 'Jalankan Simulasi'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-800/60 p-3 text-center border border-slate-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Harga Beli ({data.dateOfSignal})</p>
              <p className="font-mono font-bold text-slate-200">Rp {data.priceThen.toLocaleString('id-ID')}</p>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-3 text-center border border-slate-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Harga Sekarang</p>
              <p className="font-mono font-bold text-slate-200">Rp {data.priceNow.toLocaleString('id-ID')}</p>
            </div>
            <div className={clsx(
              'rounded-lg p-3 text-center border',
              data.actualReturnPct >= 0
                ? 'bg-green-500/10 border-green-500/25'
                : 'bg-red-500/10 border-red-500/25',
            )}>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Return Aktual</p>
              <div className="flex items-center justify-center gap-1">
                {data.actualReturnPct >= 0
                  ? <TrendingUp size={14} className="text-green-400" />
                  : <TrendingDown size={14} className="text-red-400" />
                }
                <ReturnCell pct={data.actualReturnPct} />
              </div>
            </div>
          </div>

          {/* Piotroski summary */}
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-500/8 border border-indigo-500/20">
            <span className="text-xs text-slate-400 font-medium">Piotroski F-Score (1 tahun lalu):</span>
            {data.methods.piotroski.scoreThen !== null
              ? <span className="font-mono font-bold text-slate-200 text-sm">{data.methods.piotroski.scoreThen} / 9</span>
              : <span className="text-slate-500 text-xs">Data tidak cukup</span>
            }
            <SignalBadge signal={data.methods.piotroski.signal} />
          </div>

          {/* Per-method table */}
          <div className="rounded-xl overflow-hidden border border-slate-700/40">
            {/* Table header */}
            <div
              className="grid text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-4 py-2.5"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
            >
              <div>Metode Valuasi</div>
              <div className="text-center">Sinyal Saat Itu</div>
              <div className="text-right">Fair Value Saat Itu</div>
              <div className="text-right">Return Aktual</div>
              <div className="text-center">Akurat?</div>
            </div>

            {/* Method rows */}
            {METHODS.map(({ key, label }) => {
              const m = data.methods[key];
              return (
                <div
                  key={key}
                  className="grid items-center px-4 py-3 border-t border-slate-700/20 hover:bg-slate-800/30 transition-colors"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                >
                  <span className="text-sm text-slate-300">{label}</span>
                  <div className="flex justify-center">
                    <SignalBadge signal={m.signal} />
                  </div>
                  <div className="text-right font-mono text-sm text-slate-400">
                    {m.fairValueThen
                      ? `Rp ${m.fairValueThen.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`
                      : <span className="text-slate-600">—</span>
                    }
                  </div>
                  <div className="text-right">
                    <ReturnCell pct={m.actualReturnPct} />
                  </div>
                  <div className="flex justify-center">
                    {m.signal !== 'INSUFFICIENT_DATA'
                      ? <AccuracyIcon accurate={m.accurate} />
                      : <Minus size={14} className="text-slate-600" />
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <p className="text-[10px] text-slate-600 text-center">
            ✅ Akurat = sinyal <em>Undervalued</em> dan return positif, atau sinyal <em>Overvalued</em> dan return negatif.
            ❌ Tidak akurat = sinyal berlawanan dengan kejadian nyata.
          </p>
        </div>
      )}
    </div>
  );
}
