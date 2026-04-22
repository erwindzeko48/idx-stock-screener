import { SensitivityPoint, SensitivityResult, StockFinancials } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';

function isValid(n: number | null | undefined): n is number {
  return typeof n === 'number' && isFinite(n) && !isNaN(n);
}

function estimateShares(f: StockFinancials): number | null {
  if (isValid(f.sharesOutstanding) && f.sharesOutstanding > 0) return f.sharesOutstanding;
  if (f.marketCap > 0 && f.currentPrice > 0) return f.marketCap / f.currentPrice;
  return null;
}

function estimateCashPerShare(f: StockFinancials): number | null {
  const shares = estimateShares(f);
  if (!shares || shares <= 0) return null;

  if (isValid(f.freeCashFlow) && f.freeCashFlow > 0) return f.freeCashFlow / shares;
  if (isValid(f.netIncome) && f.netIncome > 0) return (f.netIncome * 0.75) / shares;
  return null;
}

function dcfValuePerShare(
  cashPerShare: number,
  growth: number,
  wacc: number,
  marginAdj: number,
): number | null {
  if (cashPerShare <= 0) return null;
  if (wacc <= 0.03) return null;

  let projected = cashPerShare * Math.max(0.5, 1 + marginAdj);
  let pv = 0;

  for (let year = 1; year <= ValuationConfig.PROJECTION_YEARS; year++) {
    projected *= (1 + growth);
    pv += projected / Math.pow(1 + wacc, year);
  }

  const terminalGrowth = Math.min(ValuationConfig.TERMINAL_GROWTH_BASE, wacc - 0.02);
  if (terminalGrowth <= 0) return null;

  const terminal = projected * (1 + terminalGrowth) / (wacc - terminalGrowth);
  const value = pv + terminal / Math.pow(1 + wacc, ValuationConfig.PROJECTION_YEARS);
  if (!isFinite(value) || value <= 0) return null;
  return value;
}

function scenarioValue(f: StockFinancials, growthShock: number, waccShock: number, marginShock: number): number | null {
  const baseCash = estimateCashPerShare(f);
  if (!baseCash) return null;

  const baseGrowth = Math.min(0.2, Math.max(-0.05, f.revenueGrowth ?? 0.04));
  const baseWacc = Math.min(0.2, Math.max(0.06, ValuationConfig.SECTOR_WACC[f.sector] ?? ValuationConfig.SECTOR_WACC.default));

  const growth = Math.max(-0.1, Math.min(0.25, baseGrowth + growthShock));
  const wacc = Math.max(0.06, Math.min(0.25, baseWacc + waccShock));

  return dcfValuePerShare(baseCash, growth, wacc, marginShock);
}

function buildTornado(f: StockFinancials, base: number | null): SensitivityPoint[] {
  if (!base) return [];

  const entries: { name: string; low: number | null; high: number | null }[] = [
    {
      name: 'Growth +/- 5%',
      low: scenarioValue(f, -0.05, 0, 0),
      high: scenarioValue(f, 0.05, 0, 0),
    },
    {
      name: 'WACC +/- 3%',
      low: scenarioValue(f, 0, -0.03, 0),
      high: scenarioValue(f, 0, 0.03, 0),
    },
    {
      name: 'Margin +/- 5%',
      low: scenarioValue(f, 0, 0, -0.05),
      high: scenarioValue(f, 0, 0, 0.05),
    },
  ];

  return entries.map((e) => {
    const low = e.low ?? base;
    const high = e.high ?? base;
    return {
      name: e.name,
      intrinsicValue: Math.abs(high - low),
    };
  }).sort((a, b) => b.intrinsicValue - a.intrinsicValue);
}

export function buildSensitivityAnalysis(f: StockFinancials): SensitivityResult {
  const baseValue = scenarioValue(f, 0, 0, 0);

  const grid = [
    scenarioValue(f, -0.05, 0.03, -0.05),
    scenarioValue(f, -0.02, 0.01, -0.02),
    scenarioValue(f, 0, 0, 0),
    scenarioValue(f, 0.02, -0.01, 0.02),
    scenarioValue(f, 0.05, -0.03, 0.05),
  ].filter((v): v is number => typeof v === 'number' && isFinite(v) && v > 0);

  const min = grid.length > 0 ? Math.min(...grid) : null;
  const max = grid.length > 0 ? Math.max(...grid) : null;

  return {
    baseValue,
    valueRange: {
      min,
      max,
    },
    scenarios: {
      bullish: scenarioValue(f, 0.05, -0.02, 0.04),
      neutral: scenarioValue(f, 0, 0, 0),
      bearish: scenarioValue(f, -0.05, 0.02, -0.04),
    },
    tornado: buildTornado(f, baseValue),
  };
}
