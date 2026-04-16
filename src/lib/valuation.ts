import { StockFinancials, ValuationResult, PiotroskiResult, MethodResult, ValuationVal } from '@/types/stock';
import { SECTOR_AVG_PE } from './stocks-list';

const WACC = 0.10; // 10% discount rate
const TERMINAL_GROWTH = 0.03; // 3% perpetual growth
const PROJECTION_YEARS = 5;
const GRAHAM_MULTIPLIER = 22.5;

function classify(value: number | null, price: number): ValuationVal {
  if (!value) return 'INSUFFICIENT_DATA';
  const ratio = price / value;
  if (ratio < 0.85) return 'UNDERVALUED'; // At least 15% discount
  if (ratio <= 1.15) return 'FAIR_VALUE';
  return 'OVERVALUED';
}

function classifyPiotroski(score: number | null): ValuationVal {
  if (score === null) return 'INSUFFICIENT_DATA';
  if (score >= 7) return 'UNDERVALUED'; // Excellent health
  if (score >= 4) return 'FAIR_VALUE'; // Average health
  return 'OVERVALUED'; // Poor health
}

function calculateUpside(value: number | null, price: number): number | null {
  if (!value || price <= 0) return null;
  return (value - price) / price;
}

/**
 * 1. Piotroski F-Score (Checks 9 criteria for fundamental strength)
 */
export function calculatePiotroski(f: StockFinancials): PiotroskiResult {
  let score = 0;
  
  // Profitability
  const positiveNetIncome = f.netIncome !== null && f.netIncome > 0;
  const positiveRoa = f.roa !== null && f.roa > 0;
  const positiveOcf = f.operatingCashFlow !== null && f.operatingCashFlow > 0;
  const ocfGreaterThanNetIncome = (f.operatingCashFlow !== null && f.netIncome !== null) ? f.operatingCashFlow > f.netIncome : false;

  // Leverage, Liquidity
  const lowerLTDebtRatio = (f.totalDebt !== null && f.prevLongTermDebt !== null && f.totalAssets !== undefined) 
    ? (f.totalDebt / (f.totalAssets as number || 1)) < (f.prevLongTermDebt / (f.prevTotalAssets as number || 1)) 
    : false; // Simplified using raw debt if lack of assets
    
  const higherCurrentRatio = (f.currentRatio !== null && f.prevCurrentRatio !== null) ? f.currentRatio > f.currentRatio : false;
  const noNewShares = (f.sharesOutstanding !== null && f.prevSharesOutstanding !== null) ? f.sharesOutstanding <= f.prevSharesOutstanding : false;

  // Operating Efficiency
  const higherGrossMargin = (f.grossMargin !== null && f.prevGrossMargin !== null) ? f.grossMargin > f.prevGrossMargin : false;
  const higherAssetTurnover = (f.assetTurnover !== null && f.prevAssetTurnover !== null) ? f.assetTurnover > f.prevAssetTurnover : false;

  const conditions = [
    positiveNetIncome, positiveRoa, positiveOcf, ocfGreaterThanNetIncome,
    lowerLTDebtRatio, higherCurrentRatio, noNewShares, higherGrossMargin, higherAssetTurnover
  ];
  
  let checked = 0;
  conditions.forEach(c => {
    // We only accurately score what we have access to
    // Due to yahoo API limitations, if data is entirely missing, we might assume false,
    // but ideally we only count non-null data.
    if (c) score++;
  });

  // Calculate actual score if we have enough data (at least 5 metrics available)
  const isSufficientData = f.netIncome !== null && f.operatingCashFlow !== null;
  const finalScore = isSufficientData ? score : null;

  return {
    score: finalScore,
    category: classifyPiotroski(finalScore),
    details: {
      positiveNetIncome, positiveRoa, positiveOcf, ocfGreaterThanNetIncome,
      lowerLTDebtRatio, higherCurrentRatio, noNewShares, higherGrossMargin, higherAssetTurnover
    }
  };
}

/**
 * 2. Historical Valuation Bands (Mean Reversion)
 * Focuses on historical P/E compared to current EPS
 */
export function calculateMeanReversion(f: StockFinancials): MethodResult {
  const { eps, historicalPe, sector } = f;
  
  const targetPe = historicalPe && historicalPe > 0 && historicalPe < 100 
    ? historicalPe 
    : (SECTOR_AVG_PE[sector] ?? SECTOR_AVG_PE['default']);

  const value = eps && eps > 0 ? eps * targetPe : null;
  return {
    value,
    upside: calculateUpside(value, f.currentPrice),
    category: classify(value, f.currentPrice)
  };
}

/**
 * 3. Dividend Yield Reversion
 * Assumes historical 5-year average yield dictates fair value
 */
export function calculateDividendYieldReversion(f: StockFinancials): MethodResult {
  const { currentPrice, dividendYield, historicalDividendYield, payoutRatio } = f;
  
  // Need dividend data and healthy payout ratio (< 90%)
  if (!dividendYield || !historicalDividendYield || historicalDividendYield <= 0.001) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }

  // If payout ratio is extremely high, dividend might be cut, invalidating the model
  if (payoutRatio && payoutRatio > 0.9) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }

  const annualDividend = currentPrice * dividendYield;
  // Fair value = Annual Dividend / Historical Average Yield
  const value = annualDividend / historicalDividendYield;

  return {
    value,
    upside: calculateUpside(value, currentPrice),
    category: classify(value, currentPrice)
  };
}

/**
 * 4. Graham Number
 * √(22.5 × EPS × BVPS)
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
    category: classify(value, f.currentPrice)
  };
}

/**
 * 5. DCF
 */
export function calculateDCFModel(f: StockFinancials): MethodResult {
  const { freeCashFlow, revenueGrowth, marketCap, currentPrice } = f;
  if (!freeCashFlow || !marketCap || freeCashFlow <= 0 || marketCap <= 0) {
    return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };
  }

  const shares = marketCap / currentPrice;
  if (shares <= 0) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  const fcfPerShare = freeCashFlow / shares;
  if (fcfPerShare <= 0) return { value: null, upside: null, category: 'INSUFFICIENT_DATA' };

  const growthRate = Math.min(Math.max(revenueGrowth ?? 0.05, -0.05), 0.25);

  let totalPV = 0;
  let projectedFCF = fcfPerShare;

  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    projectedFCF *= 1 + growthRate;
    const discountFactor = Math.pow(1 + WACC, year);
    totalPV += projectedFCF / discountFactor;
  }

  const terminalFCF = projectedFCF * (1 + TERMINAL_GROWTH);
  const terminalValue = terminalFCF / (WACC - TERMINAL_GROWTH);
  const pvTerminal = terminalValue / Math.pow(1 + WACC, PROJECTION_YEARS);

  const value = totalPV + pvTerminal;

  return {
    value,
    upside: calculateUpside(value, currentPrice),
    category: classify(value, currentPrice)
  };
}

/**
 * Perform all 5 valuations
 */
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
    dcf.category
  ];

  const passingMethodsCount = methods.filter(m => m === 'UNDERVALUED').length;

  return {
    piotroski,
    meanReversion,
    dividendYield,
    graham,
    dcf,
    passingMethodsCount
  };
}
