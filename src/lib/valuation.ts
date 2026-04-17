import { StockFinancials, ValuationResult, PiotroskiResult, MethodResult, ValuationVal } from '@/types/stock';
import { SECTOR_AVG_PE } from './stocks-list';

// ---- Constants ----
const TERMINAL_GROWTH = 0.03; // 3% perpetual growth (long-run GDP proxy)
const PROJECTION_YEARS = 5;
const GRAHAM_MULTIPLIER = 22.5;

/**
 * Sector-specific WACC (Weighted Average Cost of Capital).
 * Banks and utilities typically have lower WACC; mining and tech higher.
 */
const SECTOR_WACC: Record<string, number> = {
  Banking: 0.08,
  Telecommunications: 0.09,
  'Consumer Staples': 0.09,
  'Consumer Goods': 0.10,
  Automotive: 0.10,
  Healthcare: 0.10,
  Energy: 0.12,
  Mining: 0.14,
  Materials: 0.11,
  Property: 0.10,
  Infrastructure: 0.09,
  Technology: 0.12,
  Agriculture: 0.11,
  Metals: 0.12,
  Retail: 0.10,
  Media: 0.11,
  Transportation: 0.10,
  default: 0.10,
};

function getWACC(sector: string): number {
  return SECTOR_WACC[sector] ?? SECTOR_WACC['default'];
}

/**
 * Classify whether a computed fair value means the stock is cheap or expensive.
 * - UNDERVALUED:  price is at least 15% below fair value
 * - FAIR_VALUE:   price is within ±15% of fair value
 * - OVERVALUED:   price is more than 15% above fair value
 */
function classify(value: number | null, price: number): ValuationVal {
  if (!value || value <= 0) return 'INSUFFICIENT_DATA';
  const ratio = price / value;
  if (ratio < 0.85) return 'UNDERVALUED';
  if (ratio <= 1.15) return 'FAIR_VALUE';
  return 'OVERVALUED';
}

function classifyPiotroski(score: number | null): ValuationVal {
  if (score === null) return 'INSUFFICIENT_DATA';
  if (score >= 7) return 'UNDERVALUED'; // Strong fundamental
  if (score >= 4) return 'FAIR_VALUE';  // Average fundamental
  return 'OVERVALUED';                  // Weak fundamental
}

function calculateUpside(value: number | null, price: number): number | null {
  if (!value || value <= 0 || price <= 0) return null;
  return (value - price) / price;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Piotroski F-Score
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Scores 9 binary criteria across three pillars:
 *   Profitability  (4): net income, ROA, OCF, accruals quality
 *   Leverage       (3): long-term debt ratio, current ratio, share dilution
 *   Efficiency     (2): gross margin, asset turnover
 */
export function calculatePiotroski(f: StockFinancials): PiotroskiResult {
  // -- Profitability --
  const positiveNetIncome = f.netIncome !== null && f.netIncome > 0;
  const positiveRoa = f.roa !== null && f.roa > 0;
  const positiveOcf = f.operatingCashFlow !== null && f.operatingCashFlow > 0;
  // Accruals: OCF should exceed net income (higher quality earnings)
  const ocfGreaterThanNetIncome =
    f.operatingCashFlow !== null && f.netIncome !== null
      ? f.operatingCashFlow > f.netIncome
      : false;

  // -- Leverage / Liquidity --
  // Debt-to-assets ratio should be lower than the prior year
  const lowerLTDebtRatio: boolean = (() => {
    const debtNow = f.totalDebt;
    const assetsNow = f.totalAssets;
    const debtPrev = f.prevLongTermDebt;
    const assetsPrev = f.prevTotalAssets;
    if (!debtNow || !assetsNow || assetsNow <= 0) return false;
    if (!debtPrev || !assetsPrev || assetsPrev <= 0) return false;
    return (debtNow / assetsNow) < (debtPrev / assetsPrev);
  })();

  // *** BUG FIX: was comparing f.currentRatio > f.currentRatio (always false) ***
  const higherCurrentRatio =
    f.currentRatio !== null && f.prevCurrentRatio !== null
      ? f.currentRatio > f.prevCurrentRatio
      : false;

  // No new share dilution
  const noNewShares =
    f.sharesOutstanding !== null && f.prevSharesOutstanding !== null
      ? f.sharesOutstanding <= f.prevSharesOutstanding
      : false;

  // -- Efficiency --
  const higherGrossMargin =
    f.grossMargin !== null && f.prevGrossMargin !== null
      ? f.grossMargin > f.prevGrossMargin
      : false;

  const higherAssetTurnover =
    f.assetTurnover !== null && f.prevAssetTurnover !== null
      ? f.assetTurnover > f.prevAssetTurnover
      : false;

  const conditions = [
    positiveNetIncome, positiveRoa, positiveOcf, ocfGreaterThanNetIncome,
    lowerLTDebtRatio, higherCurrentRatio, noNewShares, higherGrossMargin, higherAssetTurnover,
  ];

  let score = 0;
  conditions.forEach(c => { if (c) score++; });

  // Only return a valid score when the two most critical data points exist
  const isSufficientData = f.netIncome !== null && f.operatingCashFlow !== null;
  const finalScore = isSufficientData ? score : null;

  return {
    score: finalScore,
    category: classifyPiotroski(finalScore),
    details: {
      positiveNetIncome, positiveRoa, positiveOcf, ocfGreaterThanNetIncome,
      lowerLTDebtRatio, higherCurrentRatio, noNewShares, higherGrossMargin, higherAssetTurnover,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Historical Valuation Bands (Mean Reversion)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fair value = EPS × historical average trailing PE.
 * Uses `historicalTrailingPE` computed from the fundamentals time series,
 * falling back to sector average PE when historical data is unavailable.
 * This is genuinely "mean reversion" — not a forward-looking projection.
 */
export function calculateMeanReversion(f: StockFinancials): MethodResult {
  const { eps, historicalTrailingPE, sector } = f;

  if (!eps || eps <= 0) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  // Use historical trailing PE first; if missing fall back to sector average
  const targetPe =
    historicalTrailingPE && historicalTrailingPE > 0 && historicalTrailingPE < 80
      ? historicalTrailingPE
      : (SECTOR_AVG_PE[sector] ?? SECTOR_AVG_PE['default']);

  const value = eps * targetPe;
  return {
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Dividend Yield Reversion
// ─────────────────────────────────────────────────────────────────────────────
/**
 * If the stock now yields less than its own 5-year historic average yield,
 * the price has run ahead of dividends → the stock may be overvalued (and vice versa).
 *
 * Fair value = (current price × current yield) / historical avg yield
 */
export function calculateDividendYieldReversion(f: StockFinancials): MethodResult {
  const { currentPrice, dividendYield, historicalDividendYield, payoutRatio } = f;

  if (!dividendYield || dividendYield <= 0) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }
  if (!historicalDividendYield || historicalDividendYield <= 0.001) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }
  // Unsustainable payout ratio (>90%) makes the model unreliable
  if (payoutRatio && payoutRatio > 0.9) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }

  const annualDividendPerShare = currentPrice * dividendYield;
  const fairValue = annualDividendPerShare / historicalDividendYield;

  return {
    value: fairValue,
    upside: calculateUpside(fairValue, currentPrice),
    category: classify(fairValue, currentPrice),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Graham Number
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Classic Benjamin Graham formula for defensive investors:
 * √(22.5 × EPS × Book Value Per Share)
 *
 * The constant 22.5 = 15 (max PE) × 1.5 (max PB).
 */
export function calculateGrahamNumber(f: StockFinancials): MethodResult {
  const { eps, bookValuePerShare } = f;

  if (!eps || !bookValuePerShare || eps <= 0 || bookValuePerShare <= 0) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }

  const product = GRAHAM_MULTIPLIER * eps * bookValuePerShare;
  const value = product > 0 ? Math.sqrt(product) : null;

  return {
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DCF Model
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Discounted Cash Flow: project free cash flow for PROJECTION_YEARS years,
 * then add a terminal value.  Uses sector-specific WACC.
 *
 * Growth rate is capped: max 25% per year (aggressive), min -10% (distress).
 * DCF value is also sanity-capped at 10× current price to avoid runaway numbers
 * when FCF is tiny relative to market cap.
 */
export function calculateDCFModel(f: StockFinancials): MethodResult {
  const { freeCashFlow, netIncome, revenueGrowth, marketCap, currentPrice, sector } = f;

  if (!marketCap || marketCap <= 0 || currentPrice <= 0) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }

  const shares = marketCap / currentPrice;
  if (shares <= 0) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  // Determine the cash-flow base: FCF preferred, netIncome as fallback (with quality discount)
  let cashBase: number | null = null;
  let qualityDiscount = 1.0;

  if (freeCashFlow !== null && freeCashFlow > 0) {
    cashBase = freeCashFlow;
  } else if (netIncome !== null && netIncome > 0) {
    // Net income excludes capex; apply a 30% haircut for conservatism
    cashBase = netIncome;
    qualityDiscount = 0.70;
  }

  if (cashBase === null) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  const cashBasePerShare = (cashBase * qualityDiscount) / shares;
  if (cashBasePerShare <= 0) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  const wacc = getWACC(sector);
  if (wacc <= TERMINAL_GROWTH) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  // Growth rate: clamp between -10% and +25%
  const growthRate = Math.min(Math.max(revenueGrowth ?? 0.05, -0.10), 0.25);

  let totalPV = 0;
  let projected = cashBasePerShare;

  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    projected *= 1 + growthRate;
    const discountFactor = Math.pow(1 + wacc, year);
    totalPV += projected / discountFactor;
  }

  const terminalFCF = projected * (1 + TERMINAL_GROWTH);
  const terminalValue = terminalFCF / (wacc - TERMINAL_GROWTH);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, PROJECTION_YEARS);

  // Sanity cap at 10× current price
  const value = Math.min(totalPV + pvTerminal, currentPrice * 10);

  return {
    value,
    upside: calculateUpside(value, currentPrice),
    category: classify(value, currentPrice),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregate: run all 5 valuations
// ─────────────────────────────────────────────────────────────────────────────
export function valuateStock(f: StockFinancials): ValuationResult {
  const piotroski = calculatePiotroski(f);
  const meanReversion = calculateMeanReversion(f);
  const dividendYield = calculateDividendYieldReversion(f);
  const graham = calculateGrahamNumber(f);
  const dcf = calculateDCFModel(f);

  const methods = [
    piotroski.category,
    meanReversion.category,
    dividendYield.category,
    graham.category,
    dcf.category,
  ];

  const passingMethodsCount = methods.filter(m => m === 'UNDERVALUED').length;

  return { piotroski, meanReversion, dividendYield, graham, dcf, passingMethodsCount };
}
