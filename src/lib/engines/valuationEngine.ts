import { StockFinancials, MethodResult, PiotroskiResult, ValuationVal } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';
import { SECTOR_AVG_PE } from '../stocks-list';
import { calculateCV, hasNegativeTrend } from './riskEngine';

/** Utilities */
function isValid(n: number | null | undefined): n is number {
  return typeof n === 'number' && !isNaN(n) && isFinite(n);
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
    ocfGreaterThanNetIncome: (f.operatingCashFlow ?? 0) > (f.netIncome ?? 0),
    lowerLTDebtRatio: (() => {
      if (!f.totalDebt || !f.totalAssets || f.totalAssets <= 0) return false;
      if (!f.prevLongTermDebt || !f.prevTotalAssets || f.prevTotalAssets <= 0) return false;
      return (f.totalDebt / f.totalAssets) < (f.prevLongTermDebt / f.prevTotalAssets);
    })(),
    higherCurrentRatio: (f.currentRatio ?? 0) > (f.prevCurrentRatio ?? 0),
    noNewShares: (f.sharesOutstanding ?? 0) <= ((f.prevSharesOutstanding ?? 0) * 1.02),
    higherGrossMargin: (f.grossMargin ?? 0) > (f.prevGrossMargin ?? 0),
    higherAssetTurnover: (f.assetTurnover ?? 0) > (f.prevAssetTurnover ?? 0)
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

  if (!isValid(targetPe) || targetPe <= 0 || targetPe > 80) {
    targetPe = SECTOR_AVG_PE[f.sector] ?? SECTOR_AVG_PE['default'];
    confidence *= 0.5; 
    reasoning = `Fallback to sector PE (${targetPe.toFixed(1)}x).`;
  }

  if (calculateCV(f.netIncomeHistory) > 1.0) {
    confidence *= 0.6;
    reasoning += ' EPS is volatile.';
  }

  const value = f.eps * targetPe;
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
  const value = product > 0 ? Math.sqrt(product) : null;

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

  const value = (f.currentPrice * dy) / hdy;
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

  let wacc = ValuationConfig.SECTOR_WACC[f.sector] ?? ValuationConfig.SECTOR_WACC['default'];
  if (isValid(f.debtToEquity) && f.debtToEquity > 150) wacc += 0.015;
  if (f.marketCap < 1_000_000_000_000) wacc += 0.01;
  if (calculateCV(f.netIncomeHistory) > 1.5) wacc += 0.015;
  wacc = Math.min(wacc, 0.20);
  
  if (wacc <= ValuationConfig.TERMINAL_GROWTH_BASE) {
    return applyConfidenceFilter({ value: null, upside: null, category: 'INSUFFICIENT_DATA', confidence: 0, weight: baseWeight, reasoning: 'WACC illogical.' });
  }

  let projected = (cashBase * qualityDiscount) / shares;
  const initialGrowth = Math.min(Math.max(f.revenueGrowth ?? 0.05, 0.02), 0.25);
  let totalPV = 0;

  for (let year = 1; year <= ValuationConfig.PROJECTION_YEARS; year++) {
    const curG = year <= 3 ? initialGrowth : (initialGrowth + ValuationConfig.TERMINAL_GROWTH_BASE) / 2;
    projected *= (1 + curG);
    totalPV += projected / Math.pow(1 + wacc, year);
  }

  const tg = ValuationConfig.TERMINAL_GROWTH_BASE;
  const terminalVal = projected * (1 + tg) / (wacc - tg);
  let value = totalPV + (terminalVal / Math.pow(1 + wacc, ValuationConfig.PROJECTION_YEARS));

  if (value > f.currentPrice * 10) {
    value = f.currentPrice * 10;
    confidence *= 0.5;
    reasoning += ' Capped value at 10x current price.';
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
