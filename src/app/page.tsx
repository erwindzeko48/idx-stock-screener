'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { StockTable } from '@/components/StockTable';
import { StatsCard } from '@/components/StatsCard';
import { HealthFilterPanel, HealthFilters, DEFAULT_FILTERS } from '@/components/HealthFilterPanel';
import { TableSkeleton } from '@/components/LoadingSpinner';
import { StockData } from '@/types/stock';
import { TrendingUp, BarChart2, CheckSquare, Activity, RefreshCw } from 'lucide-react';
import { applyDynamicThresholds } from '@/lib/engines/decisionEngine';

type DistSummary = {
  count: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
};

type ScreeningStats = {
  processed: number;
  success: number;
  failed: number;
  successRate: number;
  upside: {
    meanReversion: DistSummary;
    graham: DistSummary;
    dcf: DistSummary;
    dividendYield: DistSummary;
    mos: DistSummary;
  };
  dataQuality?: {
    high: number;
    missing: number;
    inconsistent: number;
  };
};

function DashboardStats({ stocks }: { stocks: StockData[] }) {
  const strongBuys = stocks.filter((s) => s.valuation.recommendation === 'Strong Buy').length;
  const buys = stocks.filter((s) => s.valuation.recommendation === 'Buy').length;
  const piotroskiPass = stocks.filter((s) => s.valuation.quality >= 0.77).length; // 7/9 ≈ 0.77

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      <StatsCard
        label="Saham Dimuat"
        value={stocks.length || '—'}
        subValue="dari total antrian"
        icon={<Activity size={16} />}
        color="#60a5fa"
        glowColor="rgba(59, 130, 246, 0.08)"
      />
      <StatsCard
        label="Sinyal Strong Buy"
        value={strongBuys}
        subValue="Lolos saringan institusional"
        icon={<TrendingUp size={16} />}
        color="#22c55e"
        glowColor="rgba(34, 197, 94, 0.08)"
      />
      <StatsCard
        label="Sinyal Buy"
        value={buys}
        subValue="Valuasi menarik"
        icon={<BarChart2 size={16} />}
        color="#eab308"
        glowColor="rgba(234, 179, 8, 0.08)"
      />
      <StatsCard
        label="Fundamental Kuat"
        value={piotroskiPass}
        subValue="Piotroski Score 7-9"
        icon={<CheckSquare size={16} />}
        color="#818cf8"
        glowColor="rgba(129, 140, 248, 0.08)"
      />
    </div>
  );
}

// Progress bar for loading state
function LoadingProgress({ loaded, total }: { loaded: number; total: number }) {
  const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Mengambil data histori saham (halaman ini)...
          </p>
          <span className="mono text-sm font-bold" style={{ color: '#60a5fa' }}>
            {loaded}/{total}
          </span>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(99, 120, 175, 0.15)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
            }}
          />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Mengambil data 2-3 tahun ke belakang dari Yahoo Finance per batch...
        </p>
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}

export default function DashboardPage() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(0);
  const [targetBatchCount, setTargetBatchCount] = useState(0);
  const [error, setError] = useState(false);
  const [screeningStats, setScreeningStats] = useState<ScreeningStats | null>(null);
  const [healthFilters, setHealthFilters] = useState<HealthFilters>(DEFAULT_FILTERS);
  
  const [page, setPage] = useState(1);
  const LIMIT = 100;
  const [hasMore, setHasMore] = useState(true);

  const fetchRef = useRef<number>(0);

  const fetchData = async (pageNum: number, isLoadMore = false) => {
    setLoading(true);
    setError(false);
    if (!isLoadMore) {
      setStocks([]);
      setLoaded(0);
      setScreeningStats(null);
      setPage(1);
      setHasMore(true);
    }
    
    const fetchId = Date.now();
    fetchRef.current = fetchId;

    try {
      const res = await fetch(`/api/stocks/stream?page=${pageNum}&limit=${LIMIT}`);
      if (!res.ok || !res.body) throw new Error('Stream unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      let totalReturned = 0;

      while (true) {
        if (fetchRef.current !== fetchId) break; // Abort if new fetch started

        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            if (msg.type === 'meta') {
              setTargetBatchCount(msg.total ?? msg.returned);
              totalReturned = msg.returned;
              if (msg.returned < LIMIT) {
                 setHasMore(false);
              }
            } else if (msg.type === 'stock') {
              setLoaded((n) => n + 1);
              setStocks((prev) => {
                // Ensure no duplicates
                if (prev.find(p => p.financials.symbol === msg.data.financials.symbol)) {
                  return prev;
                }
                const updated = [...prev, msg.data];
                return updated;
              });
            } else if (msg.type === 'stats') {
              setScreeningStats(msg.data as ScreeningStats);
            }
          } catch {
            // ignore parse errors for incomplete chunks
          }
        }
      }

      if (totalReturned === 0) setHasMore(false);

      if (fetchRef.current === fetchId && totalReturned === LIMIT) {
        const nextPage = pageNum + 1;
        setPage(nextPage);
        await fetchData(nextPage, true);
      }
      
    } catch {
      setError(true);
    } finally {
      if (fetchRef.current === fetchId) {
         setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    setPage(1);
    setHasMore(true);
    fetchData(1, false);
  };

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchData(nextPage, true);
  };

  // ── Client-side health filter ────────────────────────────────────────────
  const filteredStocks = useMemo(() => {
    const f = healthFilters;
    const valid = stocks.filter(({ financials: fin }) => {
      if (f.roe.enabled) {
        if (fin.roe === null) return false;
        if ((fin.roe * 100) < f.roe.min) return false;
      }
      if (f.revGrowth.enabled) {
        if (fin.revenueGrowth === null) return false;
        if ((fin.revenueGrowth * 100) < f.revGrowth.min) return false;
      }
      if (f.niGrowth.enabled) {
        if (fin.epsGrowth === null) return false;
        if ((fin.epsGrowth * 100) < f.niGrowth.min) return false;
      }
      if (f.fcfPositive.enabled) {
        if (!fin.freeCashFlow || fin.freeCashFlow <= 0) return false;
      }
      if (f.deRatio.enabled) {
        // debtToEquity stored as (debt/equity)*100; convert back for comparison
        if (fin.debtToEquity === null) return false;
        if ((fin.debtToEquity / 100) > f.deRatio.max) return false;
      }
      if (f.divYield.enabled) {
        if (!fin.historicalDividendYield || fin.historicalDividendYield <= 0) return false;
        // historicalDividendYield stored as decimal (e.g. 0.035 = 3.5%)
        if ((fin.historicalDividendYield * 100) < f.divYield.min) return false;
      }
      if (f.niPositive.enabled) {
        if (!fin.netIncome || fin.netIncome <= 0) return false;
      }
      return true;
    });

    // Make a deep clone to not mutate React state directly
    const clonedValid = JSON.parse(JSON.stringify(valid)) as StockData[];
    
    // Dynamically rank signals across the passed filters
    applyDynamicThresholds(clonedValid);

    return clonedValid;
  }, [stocks, healthFilters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
            }}
          >
            IDX · Bursa Efek Indonesia
          </span>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1"
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              color: '#22c55e',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-live" />
            5 Valuation Models
          </span>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              <span className="gradient-text">IDX Stock Screener Max</span>
            </h1>
            <p className="text-sm sm:text-base max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
              Analisis saham independen menggunakan 5 metode valuasi komprehensif: Piotroski F-Score, Graham Number, DCF Model, Mean Reversion, & Dividend Yield.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading && page === 1}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: 'rgba(99, 120, 175, 0.1)',
              border: '1px solid var(--border)',
              color: (loading && page === 1) ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: (loading && page === 1) ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={(loading && page === 1) ? 'animate-spin' : ''} />
            {(loading && page === 1) ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Stats — always based on full loaded list, not filtered */}
      <DashboardStats stocks={stocks} />

      {screeningStats && (
        <div className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Robustness Audit (Realtime)
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Success {screeningStats.success}/{screeningStats.processed} ({(screeningStats.successRate * 100).toFixed(1)}%) · Fail {screeningStats.failed}
            </p>
          </div>

          {screeningStats.dataQuality && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Data quality: ✅ {screeningStats.dataQuality.high} · ⚠️ {screeningStats.dataQuality.missing} · ❌ {screeningStats.dataQuality.inconsistent}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {[
              { label: 'MOS', dist: screeningStats.upside.mos },
              { label: 'DCF', dist: screeningStats.upside.dcf },
              { label: 'Graham', dist: screeningStats.upside.graham },
              { label: 'MeanRev', dist: screeningStats.upside.meanReversion },
              { label: 'DivYield', dist: screeningStats.upside.dividendYield },
            ].map(({ label, dist }) => {
              const d: DistSummary = dist;
              return (
                <div key={label} className="rounded-lg p-3" style={{ background: 'rgba(99, 120, 175, 0.08)', border: '1px solid var(--border)' }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    p50 {(d.p50 * 100).toFixed(1)}% · p90 {(d.p90 * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    p99 {(d.p99 * 100).toFixed(1)}% · max {(d.max * 100).toFixed(1)}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Health Filter Panel */}
      <HealthFilterPanel
        filters={healthFilters}
        onChange={setHealthFilters}
        resultCount={filteredStocks.length}
        totalCount={stocks.length}
      />

      {/* Content */}
      {loading && page === 1 && stocks.length === 0 ? (
        <LoadingProgress loaded={loaded} total={targetBatchCount || LIMIT} />
      ) : error && stocks.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Gagal mengambil data
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Yahoo Finance mungkin sedang rate-limiting atau koneksi terputus.
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30"
          >
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {loading && page === 1 && stocks.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <RefreshCw size={12} className="animate-spin" />
              Masih memuat... ({loaded} saham diproses)
            </div>
          )}
          <StockTable stocks={filteredStocks} loadingMore={loading && page > 1} onLoadMore={handleLoadMore} hasMore={hasMore} />
        </>
      )}
    </div>
  );
}
