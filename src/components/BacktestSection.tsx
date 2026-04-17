'use client';

import { useState } from 'react';
import { BacktestResult, ValuationVal } from '@/types/stock';
import { TrendingUp, TrendingDown, Minus, Clock, PlayCircle, RefreshCw, CheckCircle2, XCircle, HelpCircle, CalendarDays } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  symbol: string;
}

function SignalBadge({ signal }: { signal: ValuationVal }) {
  const cfg = {
    UNDERVALUED:       { label: 'Undervalued',  cls: 'bg-green-500/15  text-green-400  border-green-500/30' },
    FAIR_VALUE:        { label: 'Fair Value',    cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    OVERVALUED:        { label: 'Overvalued',    cls: 'bg-red-500/15    text-red-400    border-red-500/30' },
    INSUFFICIENT_DATA: { label: 'Data Kurang',   cls: 'bg-slate-500/15  text-slate-400  border-slate-500/30' },
  };
  const { label, cls } = cfg[signal];
  return (
    <span className={clsx('text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap', cls)}>
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

// Quick-select presets
const PRESETS = [
  { label: '3 Bln', months: 3 },
  { label: '6 Bln', months: 6 },
  { label: '1 Thn', months: 12 },
  { label: '2 Thn', months: 24 },
  { label: '3 Thn', months: 36 },
] as const;

function getDateNMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

// Max allowed date = yesterday (market data available)
function maxDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Min allowed date = 5 years ago
function minDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

export function BacktestSection({ symbol }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(getDateNMonthsAgo(12));
  const [activePreset, setActivePreset] = useState<number | null>(12);
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = (months: number) => {
    setSelectedDate(getDateNMonthsAgo(months));
    setActivePreset(months);
    setData(null);
    setError(null);
  };

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
    setActivePreset(null); // deactivate preset highlight
    setData(null);
    setError(null);
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const url = `/api/stock/${encodeURIComponent(symbol)}/backtest?date=${selectedDate}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
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
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-200 flex items-center gap-2 mb-1">
          <Clock size={16} className="text-violet-400" />
          Simulasi Historis (Backtest)
        </h2>
        <p className="text-xs text-slate-500">
          Pilih tanggal pembelian, lalu lihat seberapa akurat sinyal setiap metode valuasi.
        </p>
      </div>

      {/* Date selector */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/40 mb-4 space-y-3">
        {/* Preset buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mr-1">
            Cepat:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.months}
              onClick={() => handlePreset(p.months)}
              className={clsx(
                'text-xs px-3 py-1 rounded-full border font-medium transition-all',
                activePreset === p.months
                  ? 'bg-violet-500/25 text-violet-300 border-violet-500/40'
                  : 'bg-slate-700/40 text-slate-400 border-slate-600/40 hover:bg-slate-700/70 hover:text-slate-300',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date input + run button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <CalendarDays size={14} className="text-slate-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              min={minDate()}
              max={maxDate()}
              onChange={(e) => handleDateChange(e.target.value)}
              className="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-1.5 text-sm text-slate-300
                         focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30
                         transition-all [color-scheme:dark]"
            />
          </div>

          <button
            onClick={run}
            disabled={loading || !selectedDate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
                       bg-violet-500/20 text-violet-300 border border-violet-500/35
                       hover:bg-violet-500/30 transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {loading
              ? <RefreshCw size={13} className="animate-spin" />
              : <PlayCircle size={14} />
            }
            {loading ? 'Menghitung...' : 'Jalankan Simulasi'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20 mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-800/60 p-3 text-center border border-slate-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                Harga Beli
              </p>
              <p className="text-[10px] text-slate-600 mb-0.5">{data.dateOfSignal}</p>
              <p className="font-mono font-bold text-slate-200 text-sm">
                Rp {data.priceThen.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-3 text-center border border-slate-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Harga Sekarang</p>
              <p className="font-mono font-bold text-slate-200 text-sm">
                Rp {data.priceNow.toLocaleString('id-ID')}
              </p>
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
                  ? <TrendingUp size={13} className="text-green-400" />
                  : <TrendingDown size={13} className="text-red-400" />
                }
                <ReturnCell pct={data.actualReturnPct} />
              </div>
            </div>
          </div>

          {/* Piotroski summary */}
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 rounded-lg bg-indigo-500/8 border border-indigo-500/20">
            <span className="text-xs text-slate-400 font-medium">Piotroski F-Score (saat sinyal):</span>
            {data.methods.piotroski.scoreThen !== null
              ? <span className="font-mono font-bold text-slate-200 text-sm">{data.methods.piotroski.scoreThen} / 9</span>
              : <span className="text-slate-500 text-xs">Data tidak cukup</span>
            }
            <SignalBadge signal={data.methods.piotroski.signal} />
          </div>

          {/* Per-method table */}
          <div className="rounded-xl overflow-hidden border border-slate-700/40">
            {/* Header */}
            <div
              className="grid text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-4 py-2.5 bg-slate-800/50"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
            >
              <div>Metode Valuasi</div>
              <div className="text-center">Sinyal Saat Itu</div>
              <div className="text-right">Fair Value Saat Itu</div>
              <div className="text-right">Return Aktual</div>
              <div className="text-center">Akurat?</div>
            </div>

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

          <p className="text-[10px] text-slate-600 text-center">
            ✅ Akurat = sinyal <em>Undervalued</em> dan return positif, atau sinyal <em>Overvalued</em> dan return negatif.
          </p>
        </div>
      )}
    </div>
  );
}
