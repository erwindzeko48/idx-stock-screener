'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { StockData, SortField, SortOrder, FilterCategory, ValuationVal } from '@/types/stock';
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  stocks: StockData[];
  loadingMore?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function SortIcon({ field, currentField, currentOrder }: {
  field: SortField;
  currentField: SortField;
  currentOrder: SortOrder;
}) {
  if (field !== currentField) return <ChevronsUpDown size={12} style={{ color: 'var(--text-muted)' }} />;
  return currentOrder === 'asc'
    ? <ChevronUp size={12} style={{ color: '#60a5fa' }} />
    : <ChevronDown size={12} style={{ color: '#60a5fa' }} />;
}

function SignalCell({ label, cat, upside }: { label: string, cat: ValuationVal, upside: number | null }) {
  if (cat === 'INSUFFICIENT_DATA') {
    return <span className="text-[10px] text-slate-500">—</span>;
  }
  
  const isGreen = cat === 'UNDERVALUED';
  const isYellow = cat === 'FAIR_VALUE';
  
  return (
    <div className="flex flex-col items-end">
      <span className={clsx(
        "text-[10px] px-1 rounded font-medium",
        isGreen ? "bg-green-500/10 text-green-400" : 
        isYellow ? "bg-yellow-500/10 text-yellow-400" : 
        "bg-red-500/10 text-red-400"
      )}>
        {isGreen ? 'Undervalued' : isYellow ? 'Fair Value' : 'Overvalued'}
      </span>
      {upside !== null && (
        <span className={clsx(
          "text-xs font-mono font-bold mt-0.5",
          upside > 0 ? "text-green-400" : "text-red-400"
        )}>
          {upside > 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export function StockTable({ stocks, loadingMore, onLoadMore, hasMore }: Props) {
  const [sortField, setSortField] = useState<SortField>('passingCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filtered = useMemo(() => {
    let data = [...stocks];

    if (search.trim()) {
      const q = search.trim().toUpperCase();
      data = data.filter(
        (s) =>
          s.financials.symbol.toUpperCase().includes(q) ||
          s.financials.name.toUpperCase().includes(q) ||
          s.financials.sector.toUpperCase().includes(q)
      );
    }

    data.sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'passingCount':
          va = a.valuation.passingMethodsCount;
          vb = b.valuation.passingMethodsCount;
          break;
        case 'piotroski':
          va = a.valuation.piotroski.score ?? -1;
          vb = b.valuation.piotroski.score ?? -1;
          break;
        case 'dcfUpside':
          va = a.valuation.dcf.upside ?? -Infinity;
          vb = b.valuation.dcf.upside ?? -Infinity;
          break;
        case 'grahamUpside':
          va = a.valuation.graham.upside ?? -Infinity;
          vb = b.valuation.graham.upside ?? -Infinity;
          break;
        case 'name':
          return sortOrder === 'asc'
            ? a.financials.name.localeCompare(b.financials.name)
            : b.financials.name.localeCompare(a.financials.name);
        default:
          va = 0; vb = 0;
      }
      return sortOrder === 'asc' ? va - vb : vb - va;
    });

    return data;
  }, [stocks, search, sortField, sortOrder]);

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={clsx('sort-btn text-[11px] font-semibold tracking-wide uppercase', sortField === field && 'sort-btn-active')}
    >
      {children}
      <SortIcon field={field} currentField={sortField} currentOrder={sortOrder} />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari emiten..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 px-3 py-2 rounded-lg text-sm outline-none transition-all"
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              caretColor: '#60a5fa',
            }}
          />
        </div>
        <div className="text-right flex flex-col justify-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Menampilkan <span className="text-blue-400 font-medium">{filtered.length}</span> saham diproses
          </p>
        </div>
      </div>

      {/* Table grid */}
      <div
        className="rounded-xl overflow-x-auto overflow-y-hidden shadow-2xl"
        style={{ border: '1px solid var(--border)', background: 'rgba(10, 15, 30, 0.6)' }}
      >
        <div className="min-w-[900px]">
          {/* Header */}
          <div
            className="grid gap-2 px-4 py-3 text-xs"
            style={{
              gridTemplateColumns: 'minmax(120px, 1.5fr) 1fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr',
              borderBottom: '1px solid var(--border)',
              background: 'rgba(15, 23, 42, 0.9)',
            }}
          >
            <div className="flex flex-col justify-start">
              <SortBtn field="name">Saham</SortBtn>
            </div>
            <div className="text-right">
               <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Harga</span>
            </div>
            <div className="text-right">
              <SortBtn field="piotroski">Piotroski</SortBtn>
            </div>
            <div className="text-right">
              <SortBtn field="grahamUpside">Graham</SortBtn>
            </div>
            <div className="text-right">
              <SortBtn field="dcfUpside">DCF Model</SortBtn>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Mean Reversion</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Div Yield Rev</span>
            </div>
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-3xl mb-2">🔍</p>
              <p>Tidak ada saham yang ditemukan</p>
            </div>
          ) : (
            <>
              {filtered.map((stock, idx) => {
                const { financials, valuation } = stock;
                const symbol = financials.symbol.replace('.JK', '');
                
                return (
                  <Link
                    key={financials.symbol}
                    href={`/stock/${encodeURIComponent(financials.symbol)}`}
                    className="stock-row grid gap-2 px-4 py-3 items-center group transition-colors hover:bg-slate-800/40"
                    style={{
                      gridTemplateColumns: 'minmax(120px, 1.5fr) 1fr 1fr 1.2fr 1.2fr 1.2fr 1.2fr',
                      borderBottom: idx < filtered.length - 1 ? '1px solid rgba(99, 120, 175, 0.06)' : 'none',
                    }}
                  >
                    {/* Emiten */}
                    <div className="flex items-center gap-2">
                       <div className="flex flex-col min-w-0">
                         <div className="flex items-center gap-1.5">
                           <p className="font-bold text-sm tracking-tight text-slate-200">
                             {symbol}
                           </p>
                           <ExternalLink size={10} className="text-slate-500 opacity-0 group-hover:opacity-100" />
                         </div>
                         <p className="text-[10px] text-slate-500 truncate" title={financials.name}>
                           {financials.name.length > 20 ? financials.name.substring(0, 18) + '...' : financials.name}
                         </p>
                       </div>
                    </div>

                    {/* Harga */}
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-slate-300">
                        {financials.currentPrice.toLocaleString('id-ID')}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        P/E {financials.pe ? financials.pe.toFixed(1) : '-'}
                      </p>
                    </div>

                    {/* Piotroski */}
                    <div className="text-right flex flex-col items-end">
                       {valuation.piotroski.score !== null ? (
                         <>
                           <span className={clsx(
                             "text-[10px] px-1.5 py-0.5 rounded font-bold",
                             valuation.piotroski.score >= 7 ? "bg-green-500/20 text-green-400" :
                             valuation.piotroski.score >= 4 ? "bg-yellow-500/20 text-yellow-400" :
                             "bg-red-500/20 text-red-400"
                           )}>
                             {valuation.piotroski.score} / 9
                           </span>
                           <span className="text-[9px] text-slate-500 mt-1 uppercase tracking-wider">Score</span>
                         </>
                       ) : <span className="text-slate-500 text-xs">—</span>}
                    </div>

                    {/* Graham */}
                    <div className="text-right">
                      <SignalCell label="Graham" cat={valuation.graham.category} upside={valuation.graham.upside} />
                    </div>

                    {/* DCF */}
                    <div className="text-right">
                       <SignalCell label="DCF" cat={valuation.dcf.category} upside={valuation.dcf.upside} />
                    </div>

                    {/* MeanReversion */}
                    <div className="text-right">
                       <SignalCell label="MeanRev" cat={valuation.meanReversion.category} upside={valuation.meanReversion.upside} />
                    </div>

                    {/* Dividend Yield */}
                    <div className="text-right">
                       <SignalCell label="DivYield" cat={valuation.dividendYield.category} upside={valuation.dividendYield.upside} />
                    </div>

                  </Link>
                );
              })}
              
              {/* Load More Button Row */}
              {hasMore && (
                <div className="p-4 border-t border-slate-800/40 flex justify-center bg-slate-900/40">
                  <button 
                    onClick={(e) => { e.preventDefault(); onLoadMore?.(); }}
                    disabled={loadingMore}
                    className="px-6 py-2 rounded-full text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-all border border-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loadingMore ? (
                        <>
                          <div className="w-3 h-3 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                          Memuat lebih banyak...
                        </>
                      ) : (
                        "Muat Saham Lainnya"
                      )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
