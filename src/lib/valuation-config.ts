// Configuration layer for valuation engine tuning

export const ValuationConfig = {
  // Global Settings
  TERMINAL_GROWTH_BASE: 0.04, // 4% nominal GDP growth (Emerging Market proxy)
  PROJECTION_YEARS: 5,
  GRAHAM_MULTIPLIER: 22.5,
  CONFIDENCE_THRESHOLD: 0.3, // Methods below this confidence get 0 weight

  // Final Score Formula Weights (Default / SIDEWAYS)
  SCORE_WEIGHTS: {
    MOS: 0.35,
    CONFIDENCE: 0.25,
    QUALITY: 0.20,
    RISK_PENALTY: 0.20,
  },

  // Regime Context Weight Adjustments
  REGIME_WEIGHT_ADJUSTMENTS: {
    BULL: { MOS: 0.40, CONFIDENCE: 0.25, QUALITY: 0.20, RISK_PENALTY: 0.15 },
    BEAR: { MOS: 0.25, CONFIDENCE: 0.25, QUALITY: 0.20, RISK_PENALTY: 0.30 },
    SIDEWAYS: { MOS: 0.35, CONFIDENCE: 0.25, QUALITY: 0.20, RISK_PENALTY: 0.20 },
  },
  
  // Scoring Parameters
  CONFIDENCE_DECAY_EXPONENT: 1.5,
  STABILITY_SCORE_BONUS: 0.10, // added to FinalScore
  RANK_SCORE_WEIGHTS: {
    VALUATION: 0.7,
    MOMENTUM: 0.3
  },

  EARNINGS_SPIKE_THRESHOLDS: {
    RECENT_GROWTH_MIN: 1.0, // 100%
    LONG_TERM_MAX_AVG: 0.1, // 10%
    RISK_PENALTY: 0.25
  },

  // Target Weights per Stock Classification
  // [PE, Graham, Dividend, DCF]
  TYPE_WEIGHTS: {
    BANK: { pe: 0.6, graham: 0.0, div: 0.4, dcf: 0.0 },
    DIVIDEND: { pe: 0.3, graham: 0.1, div: 0.4, dcf: 0.2 },
    GROWTH: { pe: 0.2, graham: 0.0, div: 0.0, dcf: 0.8 },
    ASSET_HEAVY: { pe: 0.4, graham: 0.4, div: 0.1, dcf: 0.1 },
    CYCLICAL: { pe: 0.4, graham: 0.2, div: 0.2, dcf: 0.2 },
    GENERAL: { pe: 0.3, graham: 0.2, div: 0.2, dcf: 0.3 }
  },

  // Base Sector WACCs
  SECTOR_WACC: {
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
  } as Record<string, number>,
};
