import { StockFinancials, MethodResult, PiotroskiResult, ValuationVal } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';
import { SECTOR_AVG_PE } from '../stocks-list';
import { calculateCV, hasNegativeTrend } from './riskEngine';

/** Utilities */
function isValid(n: number | null | undefined): n is number {
  return typeof n === 'number' && !isNaN(n) && isFinite(n);
}

function median(values: (number | null)[]): number | null {
  const valid = values.filter((n): n is number => isValid(n));
  if (valid.length === 0) return null;
  valid.sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];
}

function gt(a: number | null | undefined, b: number | null | undefined): boolean {
  return isValid(a) && isValid(b) && a > b;
}

function calculateUpside(value: number | null, price: number): number | null {
  if (!isValid(value) || value <= 0 || price <= 0) return null;
  return (value - price) / price;
}

function classify(value: number | null, price: number): ValuationVal {
  if (!isValid(value) || value <= 0) return 'INSUFFICIENT_DATA';
  const ratio = price / value;
  if (ratio < 0.85) return 'UNDERVALUED';
  if (ratio <= 1.15) return 'FAIR_VALUE';
  return 'OVERVALUED';
}

/** Confidence Filter application */
function applyConfidenceFilter(method: MethodResult): MethodResult {
  if (method.confidence < ValuationConfig.CONFIDENCE_THRESHOLD) {
    method.weight = 0;
    method.reasoning += ` [Filtered: Confidence < ${ValuationConfig.CONFIDENCE_THRESHOLD}]`;
  }
  return method;
}

// ─────────────────────────────────────────────────────────────────────────────
// Methods
// ─────────────────────────────────────────────────────────────────────────────

export function calculatePiotroski(f: StockFinancials): PiotroskiResult {
  const p = {
    positiveNetIncome: (f.netIncome ?? 0) > 0,
    positiveRoa: (f.roa ?? 0) > 0,
    positiveOcf: (f.operatingCashFlow ?? 0) > 0,
    ocfGreaterThanNetIncome: gt(f.operatingCashFlow, f.netIncome),
    lowerLTDebtRatio: (() => {
      if (!isValid(f.totalDebt) || !isValid(f.totalAssets) || f.totalAssets <= 0) return false;
      if (!isValid(f.prevLongTermDebt) || !isValid(f.prevTotalAssets) || f.prevTotalAssets <= 0) return false;
      return (f.totalDebt / f.totalAssets) < (f.prevLongTermDebt / f.prevTotalAssets);
    })(),
    higherCurrentRatio: gt(f.currentRatio, f.prevCurrentRatio),
    noNewShares: (() => {
      if (!isValid(f.sharesOutstanding) || !isValid(f.prevSharesOutstanding) || f.prevSharesOutstanding <= 0) return false;
      return f.sharesOutstanding <= (f.prevSharesOutstanding * 1.02);
    })(),
    higherGrossMargin: gt(f.grossMargin, f.prevGrossMargin),
    higherAssetTurnover: gt(f.assetTurnover, f.prevAssetTurnover)
  };

  const score = Object.values(p).filter(Boolean).length;
  const finalScore = isValid(f.netIncome) && isValid(f.operatingCashFlow) ? score : null;

  return {
    score: finalScore,
    category: finalScore === null ? 'INSUFFICIENT_DATA' : finalScore >= 7 ? 'UNDERVALUED' : finalScore >= 4 ? 'FAIR_VALUE' : 'OVERVALUED',
    details: p,
  };
}

export function calculateMeanReversion(f: StockFinancials, baseWeight: number): MethodResult {
  if (!isValid(f.eps) || f.eps <= 0) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'EPS unavailable or negative.' });
  }

  let confidence = 1.0;
  let targetPe = f.historicalTrailingPE;
  let reasoning = 'Using historical PE.';

  if (!isValid(targetPe) || targetPe <= 0 || targetPe > 35) {
    targetPe = SECTOR_AVG_PE[f.sector] ?? SECTOR_AVG_PE['default'];
    confidence *= 0.5; 
    reasoning = `Fallback to sector PE (${targetPe.toFixed(1)}x).`;
  }

  // Blend with current trailing PE to reduce single-source regime bias.
  if (isValid(f.pe) && f.pe > 0 && f.pe < 35) {
    targetPe = (targetPe * 0.7) + (f.pe * 0.3);
  }

  // Guard against one-off earnings spikes that can inflate EPS-implied value.
  let epsForValuation = f.eps;
  const epsMedian = median(f.epsHistory);
  if (isValid(epsMedian) && epsMedian > 0 && f.eps > epsMedian * 3) {
    epsForValuation = epsMedian * 2;
    confidence *= 0.65;
    reasoning += ' EPS adjusted due to spike vs historical median.';
  }

  if (calculateCV(f.netIncomeHistory) > 1.0) {
    confidence *= 0.6;
    reasoning += ' EPS is volatile.';
  }

  const value = epsForValuation * targetPe;
  return applyConfidenceFilter({
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice),
    confidence,
    weight: baseWeight,
    reasoning
  });
}

export function calculateGrahamNumber(f: StockFinancials, baseWeight: number): MethodResult {
  if (!isValid(f.eps) || !isValid(f.bookValuePerShare) || f.eps <= 0 || f.bookValuePerShare <= 0) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'EPS/BVPS unavailable/negative.' });
  }

  let confidence = 1.0;
  let reasoning = 'Passed Graham checks.';

  if (isValid(f.roe) && f.roe < 0.08) {
    confidence *= 0.4;
    reasoning = 'ROE below Graham safe limit (8%).';
  }
  if (isValid(f.debtToEquity) && f.debtToEquity > 150) { 
    confidence *= 0.3;
    reasoning = 'Debt too high.';
  }

  const product = ValuationConfig.GRAHAM_MULTIPLIER * f.eps * f.bookValuePerShare;
  let value = product > 0 ? Math.sqrt(product) : null;

  if (isValid(value) && value > f.currentPrice * 4) {
    value = f.currentPrice * 4;
    confidence *= 0.6;
    reasoning += ' Capped value at 4x current price.';
  }

  return applyConfidenceFilter({
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice),
    confidence,
    weight: baseWeight,
    reasoning
  });
}

export function calculateDividendYieldReversion(f: StockFinancials, baseWeight: number): MethodResult {
  const dy = f.dividendYield;
  const hdy = f.historicalDividendYield;
  if (!isValid(dy) || dy <= 0 || !isValid(hdy) || hdy <= 0.001) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'Dividend data missing.' });
  }

  let confidence = 1.0;
  let reasoning = 'Consistent dividend history.';

  if (isValid(f.payoutRatio) && f.payoutRatio > 0.9) {
    confidence *= 0.2;
    reasoning = 'Payout ratio >90%, cut risk high.';
  }

  const paidYears = f.dividendHistory.filter(d => isValid(d) && d > 0).length;
  if (paidYears < 3) {
    confidence *= 0.3;
    reasoning = `Dividends only paid ${paidYears} times in 5 years.`;
  }

  if (isValid(f.freeCashFlow) && isValid(f.sharesOutstanding)) {
    if (f.freeCashFlow < (dy * f.currentPrice * f.sharesOutstanding)) {
      confidence *= 0.6;
      reasoning = ' FCF does not cover dividends.';
    }
  }

  const rawRatio = dy / hdy;
  const reversionRatio = Math.min(Math.max(rawRatio, 0.5), 3.0);
  if (rawRatio !== reversionRatio) {
    confidence *= 0.7;
    reasoning += ' Yield reversion ratio capped for outlier control.';
  }

  const value = f.currentPrice * reversionRatio;
  return applyConfidenceFilter({
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice),
    confidence,
    weight: baseWeight,
    reasoning
  });
}

export function calculateDCFModel(f: StockFinancials, baseWeight: number): MethodResult {
  if (baseWeight === 0) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: 0, reasoning: 'DCF irrelevant for sector.' });
  }
  if (!isValid(f.marketCap) || f.marketCap <= 0 || f.currentPrice <= 0) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'Market Cap missing.' });
  }

  const shares = f.marketCap / f.currentPrice;
  let cashBase: number | null = null;
  let qualityDiscount = 1.0;
  let confidence = 1.0;
  let reasoning = 'DCF using FCF.';

  if (isValid(f.freeCashFlow) && f.freeCashFlow > 0) {
    cashBase = f.freeCashFlow;
    if (hasNegativeTrend(f.fcfHistory)) {
      confidence *= 0.5;
      reasoning += ' FCF trend negative.';
    }
  } else if (isValid(f.netIncome) && f.netIncome > 0) {
    cashBase = f.netIncome;
    qualityDiscount = 0.70;
    confidence *= 0.7;
    reasoning = 'Fallback to scaled Net Income due to missing/negative FCF.';
  }

  if (cashBase === null || (cashBase * qualityDiscount) / shares <= 0) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: Math.max(0, baseWeight - 0.5), reasoning: 'No positive cash base.' });
  }

  // Clamp unrealistic cash-yield assumptions from one-off earnings/FCF spikes.
  const cashYield = cashBase / f.marketCap;
  if (cashYield > 0.20) {
    cashBase = 0.20 * f.marketCap;
    confidence *= 0.7;
    reasoning += ' Cash yield capped at 20% of market cap.';
  }

  let wacc = ValuationConfig.SECTOR_WACC[f.sector] ?? ValuationConfig.SECTOR_WACC['default'];
  if (isValid(f.debtToEquity) && f.debtToEquity > 150) wacc += 0.015;
  if (f.marketCap < 1_000_000_000_000) wacc += 0.01;
  if (calculateCV(f.netIncomeHistory) > 1.5) wacc += 0.015;
  wacc = Math.min(wacc, 0.20);
  
  if (wacc <= ValuationConfig.TERMINAL_GROWTH_BASE) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'WACC illogical.' });
  }

  let projected = (cashBase * qualityDiscount) / shares;
  const initialGrowth = Math.min(Math.max(f.revenueGrowth ?? 0.04, -0.05), 0.20);
  let totalPV = 0;

  for (let year = 1; year <= ValuationConfig.PROJECTION_YEARS; year++) {
    const curG = year <= 3 ? initialGrowth : (initialGrowth + ValuationConfig.TERMINAL_GROWTH_BASE) / 2;
    projected *= (1 + curG);
    totalPV += projected / Math.pow(1 + wacc, year);
  }

  const tg = Math.min(ValuationConfig.TERMINAL_GROWTH_BASE, wacc - 0.03);
  if (tg <= 0) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'Terminal growth invalid.' });
  }
  const terminalVal = projected * (1 + tg) / (wacc - tg);
  let value = totalPV + (terminalVal / Math.pow(1 + wacc, ValuationConfig.PROJECTION_YEARS));

  if (value > f.currentPrice * 4) {
    value = f.currentPrice * 4;
    confidence *= 0.5;
    reasoning += ' Capped value at 4x current price.';
  }

  return applyConfidenceFilter({
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice),
    confidence,
    weight: baseWeight,
    reasoning
  });
}
