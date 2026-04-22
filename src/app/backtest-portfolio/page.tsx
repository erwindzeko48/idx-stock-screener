'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Target,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PortfolioBacktestResponse, RollingBacktestWindowResult } from '@/types/stock';

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function num(v: number): string {
  return v.toFixed(2);
}

export default function BacktestPortfolioPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortfolioBacktestResponse | null>(null);
  const [rebalancing, setRebalancing] = useState<'MONTHLY' | 'QUARTERLY'>('MONTHLY');
  const [windows, setWindows] = useState(2);
  const [universe, setUniverse] = useState(24);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const params = new URLSearchParams({
        rebalancing,
        windows: String(windows),
        universe: String(universe),
      });
      const res = await fetch(`/api/portfolio-backtest?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Backtest failed');
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const combinedCurve = useMemo(() => {
    if (!data || data.windows.length === 0) return [];
    return data.windows[data.windows.length - 1].equityCurve;
  }, [data]);

  const drawdownCurve = combinedCurve.map((p) => ({
    date: p.date,
    drawdownPct: p.drawdown * 100,
  }));

  const renderWindowCard = (w: RollingBacktestWindowResult) => (
    <div key={w.windowLabel} className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">{w.windowLabel}</p>
          <h3 className="text-sm font-bold text-slate-200">Train {w.trainStart} - {w.trainEnd}</h3>
          <p className="text-xs text-slate-400">Test {w.testStart} - {w.testEnd}</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded border border-blue-500/40 text-blue-300 bg-blue-500/10">
          {w.rebalancing} · Top {w.selectedTopN}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-slate-500">CAGR</p>
          <p className="font-mono text-slate-200">{pct(w.summary.cagr)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-slate-500">Sharpe</p>
          <p className="font-mono text-slate-200">{num(w.summary.sharpe)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-slate-500">Max DD</p>
          <p className="font-mono text-red-300">{pct(w.summary.maxDrawdown)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-slate-500">Win Rate</p>
          <p className="font-mono text-slate-200">{pct(w.summary.winRate)}</p>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <p className="text-slate-500">Alpha vs IHSG</p>
          <p className={`font-mono ${w.summary.alphaVsBenchmark >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {pct(w.summary.alphaVsBenchmark)}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
          Institutional Rolling Backtest
        </h1>
        <p className="text-slate-400 mt-2 max-w-3xl text-sm">
          Engine ini menjalankan rolling window (5Y training -&gt; 1Y testing), strict out-of-sample, dan benchmark terhadap IHSG.
        </p>
      </div>

      <div className="glass-card p-4 rounded-xl border border-slate-700/40">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="text-xs text-slate-400">
            Rebalancing
            <select
              value={rebalancing}
              onChange={(e) => setRebalancing(e.target.value as 'MONTHLY' | 'QUARTERLY')}
              className="mt-1 w-full bg-slate-900/70 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
            </select>
          </label>

          <label className="text-xs text-slate-400">
            Jumlah Window
            <input
              type="number"
              min={1}
              max={4}
              value={windows}
              onChange={(e) => setWindows(Math.max(1, Math.min(4, Number(e.target.value) || 2)))}
              className="mt-1 w-full bg-slate-900/70 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
            />
          </label>

          <label className="text-xs text-slate-400">
            Universe Size
            <input
              type="number"
              min={10}
              max={40}
              value={universe}
              onChange={(e) => setUniverse(Math.max(10, Math.min(40, Number(e.target.value) || 24)))}
              className="mt-1 w-full bg-slate-900/70 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200"
            />
          </label>

          <button
            onClick={runBacktest}
            disabled={loading}
            className="h-[42px] px-4 rounded-lg text-sm font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/35 hover:bg-blue-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <PlayCircle size={15} />}
            {loading ? 'Running...' : 'Run Backtest'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg p-3 border border-red-500/25 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="glass-card p-3 rounded-lg border border-slate-700/40">
              <p className="text-[10px] uppercase text-slate-500">Aggregate CAGR</p>
              <p className="font-mono text-lg text-slate-200">{pct(data.aggregate.cagr)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg border border-slate-700/40">
              <p className="text-[10px] uppercase text-slate-500">Aggregate Sharpe</p>
              <p className="font-mono text-lg text-slate-200">{num(data.aggregate.sharpe)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg border border-slate-700/40">
              <p className="text-[10px] uppercase text-slate-500">Aggregate Max DD</p>
              <p className="font-mono text-lg text-red-300">{pct(data.aggregate.maxDrawdown)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg border border-slate-700/40">
              <p className="text-[10px] uppercase text-slate-500">Aggregate Win Rate</p>
              <p className="font-mono text-lg text-slate-200">{pct(data.aggregate.winRate)}</p>
            </div>
            <div className="glass-card p-3 rounded-lg border border-slate-700/40">
              <p className="text-[10px] uppercase text-slate-500">Alpha vs IHSG</p>
              <p className={`font-mono text-lg ${data.aggregate.alphaVsBenchmark >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {pct(data.aggregate.alphaVsBenchmark)}
              </p>
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-700/40">
            <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-400" />
              Equity Curve (window terbaru)
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combinedCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                  <Legend />
                  <Line type="monotone" dataKey="strategy" name="Strategy" stroke="#60a5fa" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="benchmark" name="IHSG" stroke="#34d399" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl border border-slate-700/40">
            <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <CalendarClock size={16} className="text-red-400" />
              Drawdown Chart (window terbaru)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={drawdownCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155' }} />
                  <Area type="monotone" dataKey="drawdownPct" stroke="#f87171" fill="#ef444440" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Target size={16} className="text-amber-400" />
              Performance Summary Table
            </h2>
            {data.windows.map(renderWindowCard)}
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100 flex items-start gap-2">
            <ShieldAlert size={14} className="mt-0.5" />
            <div>
              Survivorship mitigation: universe memaksa memasukkan kandidat delisted {data.survivorshipMitigation.delistedCandidates.join(', ')}.
              Unavailable symbols saat fetch: {data.survivorshipMitigation.unavailableSymbols.length} ticker.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
