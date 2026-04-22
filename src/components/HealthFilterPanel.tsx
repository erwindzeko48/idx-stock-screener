'use client';

import { useState } from 'react';
import { SlidersHorizontal, ChevronDown, ChevronUp, X, ToggleLeft, ToggleRight } from 'lucide-react';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthFilters {
  roe:        { enabled: boolean; min: number };          // % e.g. 10 = 10%
  revGrowth:  { enabled: boolean; min: number };          // % YoY
  niGrowth:   { enabled: boolean; min: number };          // % YoY
  fcfPositive:{ enabled: boolean };                        // FCF > 0
  deRatio:    { enabled: boolean; max: number };          // D/E ratio (not ×100)
  divYield:   { enabled: boolean; min: number };          // % e.g. 2 = 2%
  niPositive: { enabled: boolean };                        // Net Income > 0
}

export const DEFAULT_FILTERS: HealthFilters = {
  // Default ON so dashboard immediately displays health-screened stocks.
  roe:         { enabled: true, min: 8 },
  revGrowth:   { enabled: true, min: 3 },
  niGrowth:    { enabled: true, min: 3 },
  fcfPositive: { enabled: true },
  deRatio:     { enabled: true, max: 1.5 },
  divYield:    { enabled: true, min: 1 },
  niPositive:  { enabled: true },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function activeCount(f: HealthFilters): number {
  return (Object.values(f) as Array<{ enabled: boolean }>).filter(v => v.enabled).length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="shrink-0 transition-colors">
      {enabled
        ? <ToggleRight size={22} className="text-emerald-400" />
        : <ToggleLeft  size={22} className="text-slate-600" />
      }
    </button>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

function NumberInput({ value, onChange, min = 0, max = 100, step = 0.5, unit = '%', disabled }: NumberInputProps) {
  return (
    <div className={clsx(
      'flex items-center gap-1 rounded-lg border px-2.5 py-1 transition-all',
      disabled
        ? 'border-slate-700/30 bg-slate-800/20 opacity-40'
        : 'border-slate-600/40 bg-slate-800/50 focus-within:border-violet-500/50',
    )}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="w-16 bg-transparent text-sm font-mono text-slate-200 outline-none"
      />
      <span className="text-xs text-slate-500">{unit}</span>
    </div>
  );
}

interface FilterRowProps {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

function FilterRow({ label, description, enabled, onToggle, children }: FilterRowProps) {
  return (
    <div className={clsx(
      'flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors',
      enabled ? 'bg-slate-800/40' : 'bg-transparent',
    )}>
      <Toggle enabled={enabled} onToggle={onToggle} />
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium leading-tight', enabled ? 'text-slate-200' : 'text-slate-500')}>
          {label}
        </p>
        <p className="text-[11px] text-slate-600 mt-0.5">{description}</p>
      </div>
      {children && (
        <div className="shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  filters: HealthFilters;
  onChange: (f: HealthFilters) => void;
  resultCount: number;
  totalCount: number;
}

export function HealthFilterPanel({ filters, onChange, resultCount, totalCount }: Props) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof HealthFilters>(key: K, patch: Partial<HealthFilters[K]>) => {
    onChange({ ...filters, [key]: { ...filters[key], ...patch } });
  };

  const resetAll = () => onChange(DEFAULT_FILTERS);
  const count = activeCount(filters);

  return (
    <div className="mb-4">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 rounded-xl border transition-all
                   bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/60 hover:border-slate-600/50"
      >
        <SlidersHorizontal size={15} className="text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-300 flex-1 text-left">
          Filter Kesehatan Perusahaan
        </span>
        {count > 0 && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-semibold">
            {count} aktif
          </span>
        )}
        {count > 0 && (
          <span className="text-xs text-slate-400 font-mono">
            {resultCount}/{totalCount} saham
          </span>
        )}
        {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-2 rounded-xl border border-slate-700/40 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/30 bg-slate-800/30">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Aktifkan kriteria yang ingin digunakan sebagai filter
            </p>
            {count > 0 && (
              <button
                onClick={resetAll}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={12} /> Reset Semua
              </button>
            )}
          </div>

          <div className="p-3 space-y-1">
            {/* 1. ROE */}
            <FilterRow
              label="Return on Equity (ROE)"
              description="Mengukur efisiensi penggunaan modal pemegang saham"
              enabled={filters.roe.enabled}
              onToggle={() => set('roe', { enabled: !filters.roe.enabled })}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>≥</span>
                <NumberInput
                  value={filters.roe.min}
                  onChange={v => set('roe', { min: v })}
                  min={-50} max={100} step={1} unit="%"
                  disabled={!filters.roe.enabled}
                />
              </div>
            </FilterRow>

            {/* 2. Revenue Growth */}
            <FilterRow
              label="Revenue Growth (YoY)"
              description="Pertumbuhan pendapatan tahun ke tahun"
              enabled={filters.revGrowth.enabled}
              onToggle={() => set('revGrowth', { enabled: !filters.revGrowth.enabled })}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>≥</span>
                <NumberInput
                  value={filters.revGrowth.min}
                  onChange={v => set('revGrowth', { min: v })}
                  min={-50} max={100} step={1} unit="%"
                  disabled={!filters.revGrowth.enabled}
                />
              </div>
            </FilterRow>

            {/* 3. Net Income Growth */}
            <FilterRow
              label="Net Income Growth (YoY)"
              description="Pertumbuhan laba bersih tahun ke tahun"
              enabled={filters.niGrowth.enabled}
              onToggle={() => set('niGrowth', { enabled: !filters.niGrowth.enabled })}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>≥</span>
                <NumberInput
                  value={filters.niGrowth.min}
                  onChange={v => set('niGrowth', { min: v })}
                  min={-50} max={200} step={1} unit="%"
                  disabled={!filters.niGrowth.enabled}
                />
              </div>
            </FilterRow>

            {/* 4. FCF > 0 */}
            <FilterRow
              label="Free Cash Flow Positif"
              description="Perusahaan menghasilkan kas setelah capex"
              enabled={filters.fcfPositive.enabled}
              onToggle={() => set('fcfPositive', { enabled: !filters.fcfPositive.enabled })}
            />

            {/* 5. D/E Ratio */}
            <FilterRow
              label="Debt-to-Equity Ratio"
              description="Rasio utang terhadap ekuitas (< 1 artinya utang lebih kecil dari modal)"
              enabled={filters.deRatio.enabled}
              onToggle={() => set('deRatio', { enabled: !filters.deRatio.enabled })}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>≤</span>
                <NumberInput
                  value={filters.deRatio.max}
                  onChange={v => set('deRatio', { max: v })}
                  min={0} max={10} step={0.1} unit="×"
                  disabled={!filters.deRatio.enabled}
                />
              </div>
            </FilterRow>

            {/* 6. Avg Dividend Yield */}
            <FilterRow
              label="Rata-rata Dividend Yield"
              description="Yield dividen historis rata-rata (5 tahun) dari Yahoo Finance"
              enabled={filters.divYield.enabled}
              onToggle={() => set('divYield', { enabled: !filters.divYield.enabled })}
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>≥</span>
                <NumberInput
                  value={filters.divYield.min}
                  onChange={v => set('divYield', { min: v })}
                  min={0} max={20} step={0.5} unit="%"
                  disabled={!filters.divYield.enabled}
                />
              </div>
            </FilterRow>

            {/* 7. Net Income > 0 */}
            <FilterRow
              label="Net Income Positif"
              description="Perusahaan tidak merugi (net income > 0)"
              enabled={filters.niPositive.enabled}
              onToggle={() => set('niPositive', { enabled: !filters.niPositive.enabled })}
            />
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 border-t border-slate-700/20 bg-slate-800/20">
            <p className="text-[10px] text-slate-600">
              💡 Revenue & Net Income Growth berbasis data YoY (Year-over-Year) dari Yahoo Finance.
              Semua filter diterapkan secara AND (semua kriteria yang aktif harus terpenuhi).
              Default awal: beberapa filter kesehatan inti sudah aktif otomatis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
