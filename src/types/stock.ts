export interface StockFinancials {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  marketCap: number;

  // Key ratios
  pe: number | null;
  /** Calculated trailing PE average from historical time-series (not forward PE) */
  historicalTrailingPE: number | null;
  pb: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;

  // Momentum
  return12m: number | null;
  return6m: number | null;

  // History arrays (index 0 is newest, index 4 is oldest, up to 5 years)
  epsHistory: (number | null)[];
  fcfHistory: (number | null)[];
  netIncomeHistory: (number | null)[];
  revenueHistory: (number | null)[];
  dividendHistory: (number | null)[];
  sharesHistory: (number | null)[];

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
  grossMarginHistory: (number | null)[];
}

export type ValuationVal = 'UNDERVALUED' | 'FAIR_VALUE' | 'OVERVALUED' | 'INSUFFICIENT_DATA';

export interface MethodResult {
  value: number | null;
  upside: number | null;
  category: ValuationVal;
  confidence: number; // 0 to 1
  weight: number;     // 0 to 1
  reasoning: string;
}

export interface MethodContribution {
  method: 'DCF' | 'GRAHAM' | 'MEAN_REVERSION' | 'DIVIDEND_YIELD';
  contributionPct: number;
  effectiveWeight: number;
  intrinsicValue: number | null;
  confidence: number;
  signal: ValuationVal;
}

export interface ConfidenceBreakdown {
  compositeConfidence: number;
  modelCoverage: number;
  methodConfidence: {
    method: MethodContribution['method'];
    confidence: number;
    passedThreshold: boolean;
  }[];
}

export interface WaterfallStep {
  label: string;
  value: number;
}

export interface ValuationExplainability {
  contributions: MethodContribution[];
  confidenceDetail: ConfidenceBreakdown;
  reasoning: string[];
  waterfall: WaterfallStep[];
}

export interface RiskProfile {
  riskScore: number; // 0..100
  cyclicalityScore: number; // 0..100
  cyclicalityClass: 'DEFENSIVE' | 'CYCLICAL' | 'HIGHLY_CYCLICAL';
  industryRiskTags: string[];
  earningsStabilityStdDev: number;
  earningsConsistencyScore: number; // 0..100
  flags: string[];
}

export interface SensitivityPoint {
  name: string;
  intrinsicValue: number;
}

export interface SensitivityResult {
  baseValue: number | null;
  valueRange: {
    min: number | null;
    max: number | null;
  };
  scenarios: {
    bullish: number | null;
    neutral: number | null;
    bearish: number | null;
  };
  tornado: SensitivityPoint[];
}

export interface DataQualityReport {
  sourceChecks: {
    yahoo: boolean;
    alternativeSource: boolean;
    priceConsistencyDiffPct: number | null;
  };
  dataCompletenessScore: number; // 0..100
  confidenceScore: number; // 0..100
  flag: 'HIGH_CONFIDENCE' | 'MISSING_DATA' | 'INCONSISTENT_DATA';
  warnings: string[];
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
  
  // Composite & Final Scoring
  intrinsic_value: number | null;
  mos: number | null; // Margin of safety
  mos_normalized: number; // Scaled via non-linear curve
  confidence: number;       // 0 to 1
  quality: number; // 0 to 1 (usually Piotroski / 9)
  risk: number;             // 0 to 1, higher is riskier
  final_score: number;            // 0 to 1 composite score
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Avoid';
  type: string;        // e.g., 'DIVIDEND', 'GROWTH', 'BANK'
  top_methods: string[];         // Key methods that drove the valuation, e.g., ['PE', 'DCF']
  warnings: string[];
  explanation: string[];         // Key reasons for recommendation

  // Advanced Metrics
  final_rank_score: number;      // 0 to 1 combining final_score and momentum
  momentum_score: number;        // 0 to 1 based on 12-month return
  stability_score: number;       // 0 to 1 based on earnings/FCF consistency
  market_regime: 'BULL' | 'BEAR' | 'SIDEWAYS';
  factor_exposure: {
    value: number;               // 0 to 1
    growth: number;              // 0 to 1
    quality: number;             // 0 to 1
  };

  explainability: ValuationExplainability;
  risk_profile: RiskProfile;
  sensitivity: SensitivityResult;
  data_quality: DataQualityReport | null;

  // Summary fields (legacy but kept for sorting if needed)
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

// ---- Backtest / Simulation Types ----

export interface BacktestMethodResult {
  /** Signal generated 1 year ago */
  signal: ValuationVal;
  /** Predicted fair value 1 year ago */
  fairValueThen: number | null;
  /** Stock price at signal date (1 year ago) */
  priceThen: number;
  /** Stock price today */
  priceNow: number;
  /** Actual return if bought at signal: (priceNow - priceThen) / priceThen */
  actualReturnPct: number;
  /** Did this method's Undervalued signal turn out correct (positive return)? */
  accurate: boolean | null;
}

export interface BacktestResult {
  symbol: string;
  priceThen: number;
  priceNow: number;
  dateOfSignal: string;
  actualReturnPct: number;
  methods: {
    piotroski: { scoreThen: number | null; signal: ValuationVal };
    meanReversion: BacktestMethodResult;
    dividendYield: BacktestMethodResult;
    graham: BacktestMethodResult;
    dcf: BacktestMethodResult;
  };
}

export interface BacktestPoint {
  date: string;
  strategy: number;
  benchmark: number;
  drawdown: number;
}

export interface BacktestPerformanceSummary {
  cagr: number;
  sharpe: number;
  maxDrawdown: number;
  winRate: number;
  alphaVsBenchmark: number;
}

export interface RollingBacktestWindowResult {
  windowLabel: string;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  rebalancing: 'MONTHLY' | 'QUARTERLY';
  selectedTopN: number;
  universeSize: number;
  equityCurve: BacktestPoint[];
  summary: BacktestPerformanceSummary;
}

export interface PortfolioBacktestResponse {
  benchmark: {
    symbol: string;
    name: string;
  };
  survivorshipMitigation: {
    usedSymbols: number;
    delistedCandidates: string[];
    unavailableSymbols: string[];
  };
  windows: RollingBacktestWindowResult[];
  aggregate: BacktestPerformanceSummary;
}

export type SortField = 'passingCount' | 'finalScore' | 'piotroski' | 'dcfUpside' | 'grahamUpside' | 'name';
export type SortOrder = 'asc' | 'desc';
export type FilterCategory = 'ALL' | 'UNDERVALUED' | 'FAIR_VALUE' | 'OVERVALUED';
