'use client';

import { StockFinancials } from '@/types/stock';

interface Props {
  financials: StockFinancials;
}

export function FundamentalMetrics({ financials }: Props) {
  const formatStat = (num: number | null, isCurrency = false, isPercent = false, customFormatter?: (val: number) => string) => {
    if (num === null || num === undefined) return '—';
    if (customFormatter) return customFormatter(num);
    
    if (isPercent) return `${(num * 100).toFixed(1)}%`;
    
    if (isCurrency) {
      if (Math.abs(num) >= 1e12) return `Rp ${(num / 1e12).toFixed(2)} T`;
      if (Math.abs(num) >= 1e9)  return `Rp ${(num / 1e9).toFixed(2)} M`;
      return `Rp ${num.toLocaleString('id-ID')}`;
    }
    
    return num.toLocaleString('id-ID', { maximumFractionDigits: 2 });
  };

  const sections = [
    {
      title: 'Valuasi Utama',
      metrics: [
        { label: 'Market Cap', val: formatStat(financials.marketCap, true) },
        { label: 'P/E (Price to Earnings)', val: formatStat(financials.pe) },
        { label: 'P/BV (Price to Book)', val: formatStat(financials.pb) },
        { label: 'Dividend Yield', val: formatStat(financials.dividendYield, false, true) },
      ],
    },
    {
      title: 'Kinerja Profitabilitas',
      metrics: [
        { label: 'ROE (Return on Equity)', val: formatStat(financials.roe, false, true) },
        { label: 'ROA (Return on Assets)', val: formatStat(financials.roa, false, true) },
        { label: 'Net Income', val: formatStat(financials.netIncome, true) },
        { label: 'Total Revenue', val: formatStat(financials.revenue, true) },
      ],
    },
    {
      title: 'Pertumbuhan & Arus Kas',
      metrics: [
        { label: 'Revenue Growth (YoY)', val: formatStat(financials.revenueGrowth, false, true) },
        { label: 'EPS Growth (YoY)', val: formatStat(financials.epsGrowth, false, true) },
        { label: 'Operating Cash Flow', val: formatStat(financials.operatingCashFlow, true) },
        { label: 'Free Cash Flow', val: formatStat(financials.freeCashFlow, true) },
      ],
    },
    {
      title: 'Kekayaan & Utang',
      metrics: [
        { label: 'Total Aset', val: formatStat((financials.totalEquity ?? 0) + (financials.totalDebt ?? 0), true) },
        { label: 'Total Utang (Debt)', val: formatStat(financials.totalDebt, true) },
        { label: 'Debt to Equity', val: formatStat(financials.debtToEquity !== null ? financials.debtToEquity / 100 : null, false, true) },
        { label: 'Book Value per Share', val: formatStat(financials.bookValuePerShare, true) },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <div key={sec.title} className="glass-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            {sec.title}
          </h3>
          <div className="space-y-2.5">
            {sec.metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {m.label}
                </span>
                <span className="mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {m.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
