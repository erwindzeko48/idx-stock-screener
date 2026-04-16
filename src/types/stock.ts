export interface StockFinancials {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  marketCap: number;
  // Key ratios
  pe: number | null;
  historicalPe: number | null; // 5-Year Average PE
  pb: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  // Income statement
  eps: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  revenue: number | null;
  netIncome: number | null;
  ebitda: number | null;
  // Balance sheet
  bookValuePerShare: number | null;
  totalDebt: number | null;
  totalEquity: number | null;
  // Cash flow
  freeCashFlow: number | null;
  operatingCashFlow: number | null;
  // Enterprise value
  enterpriseValue: number | null;
  // Dividend
  dividendYield: number | null;
  historicalDividendYield: number | null; // 5-Year Average Yield
  payoutRatio: number | null;
  
  // Historical context for Piotroski
  prevNetIncome: number | null;
  prevRoa: number | null;
  prevOperatingCashFlow: number | null;
  prevLongTermDebt: number | null;
  currentRatio: number | null;
  prevCurrentRatio: number | null;
  prevSharesOutstanding: number | null;
  sharesOutstanding: number | null;
  grossMargin: number | null;
  prevGrossMargin: number | null;
  assetTurnover: number | null;
  prevAssetTurnover: number | null;
  totalAssets: number | null;
  prevTotalAssets: number | null;
}

export type ValuationVal = 'UNDERVALUED' | 'FAIR_VALUE' | 'OVERVALUED' | 'INSUFFICIENT_DATA';

export interface MethodResult {
  value: number | null;
  upside: number | null;
  category: ValuationVal;
}

export interface PiotroskiResult {
  score: number | null;
  category: ValuationVal; // 7-9: UNDERVALUED, 4-6: FAIR_VALUE, 0-3: OVERVALUED
  details: {
    positiveNetIncome: boolean;
    positiveRoa: boolean;
    positiveOcf: boolean;
    ocfGreaterThanNetIncome: boolean;
    lowerLTDebtRatio: boolean;
    higherCurrentRatio: boolean;
    noNewShares: boolean;
    higherGrossMargin: boolean;
    higherAssetTurnover: boolean;
  };
}

export interface ValuationResult {
  piotroski: PiotroskiResult;
  meanReversion: MethodResult;
  dividendYield: MethodResult;
  graham: MethodResult;
  dcf: MethodResult;
  // Summary fields for simpler sorting on dashboard
  passingMethodsCount: number; // 0 to 5
}

// We remove the old HealthStatus because Piotroski F-Score replaces it
export interface StockData {
  financials: StockFinancials;
  valuation: ValuationResult;
}

export interface PricePoint {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

export interface StockDetail extends StockData {
  priceHistory: PricePoint[];
}

export type SortField = 'passingCount' | 'piotroski' | 'dcfUpside' | 'grahamUpside' | 'name';
export type SortOrder = 'asc' | 'desc';
export type FilterCategory = 'ALL' | 'UNDERVALUED' | 'FAIR_VALUE' | 'OVERVALUED';
