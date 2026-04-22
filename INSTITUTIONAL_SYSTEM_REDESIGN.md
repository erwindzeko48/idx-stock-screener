# Institutional Redesign Blueprint - IDX Stock Screener

Dokumen ini merangkum redesign sistem agar screener berpindah dari exploratory tool menjadi decision-support system yang robust, explainable, dan siap dipakai dalam proses investasi nyata.

## 1. Arsitektur Baru (Modular + Scalable)

### 1.1 Layering
1. Data Layer
- Yahoo Finance adapter (quote, quoteSummary, fundamentalsTimeSeries, chart)
- Alternative source checker (Stooq) untuk validasi silang harga
- Data quality scoring dan warning

2. Feature/Signal Layer
- Valuation engines: DCF, Graham, Mean Reversion, Dividend Yield, Piotroski
- Risk engines: base risk + advanced risk profile (cyclicality, stability, flags)
- Sensitivity engine: scenario & tornado analysis

3. Decision Layer
- Scoring engine (MOS, confidence, quality, risk penalty)
- Explainability engine (method contribution, confidence breakdown, reasoning, waterfall)

4. Validation Layer
- Rolling backtesting engine
- Strict out-of-sample train/test split
- Benchmarking vs IHSG

5. Presentation Layer
- Dashboard screening + data quality telemetry
- Detail page dengan explainability/risk/sensitivity
- Portfolio backtest page: equity curve, drawdown chart, summary table

### 1.2 File Map
- src/lib/engines/explainabilityEngine.ts
- src/lib/engines/advancedRiskEngine.ts
- src/lib/engines/sensitivityEngine.ts
- src/lib/engines/dataQualityEngine.ts
- src/lib/backtest/rollingBacktestEngine.ts
- src/app/api/portfolio-backtest/route.ts
- src/app/backtest-portfolio/page.tsx

## 2. Pseudocode / Flow Logic

### 2.1 Explainability Engine
```text
INPUT: method results (value, confidence, weight, reasoning), current price
FOR each method:
  effectiveWeight = weight * confidence^decay
  contributionPct = effectiveWeight / totalEffective
BUILD confidenceDetail:
  compositeConfidence
  modelCoverage (valid models / total models)
  methodConfidence[]
BUILD reasoning[] from signal + method reasoning
BUILD waterfall[] from current price + each intrinsic value
OUTPUT: explainability object
```

### 2.2 Advanced Risk Layer
```text
INPUT: StockFinancials, Piotroski, baseRiskScore
COMPUTE earnings CV and std dev from netIncome history
MAP sector -> base cyclicality score
COMBINE base cyclicality + earnings volatility -> cyclicalityScore
CLASSIFY cyclicality: Defensive / Cyclical / Highly Cyclical
BUILD industryRiskTags (commodity exposure, regulatory, disruption)
CHECK flags:
  - high leverage
  - weak Piotroski
  - unstable earnings
  - highly cyclical
  - profit-not-backed-by-cashflow (value trap potential)
COMPUTE riskScore (0-100)
OUTPUT: risk_profile
```

### 2.3 Sensitivity Engine
```text
INPUT: StockFinancials
ESTIMATE cash-per-share from FCF or adjusted NI fallback
DEFINE base assumptions: growth, WACC, margin
RUN scenarios:
  Bullish: growth up, WACC down, margin up
  Neutral: base
  Bearish: growth down, WACC up, margin down
RUN shock grid for range min-max
BUILD tornado impact magnitude for:
  growth +/-5%
  WACC +/-3%
  margin +/-5%
OUTPUT: base value, range, scenario values, tornado series
```

### 2.4 Data Quality Validation
```text
INPUT: StockFinancials
COMPUTE completenessScore from required key fields
FETCH alternative source price (Stooq)
COMPARE alt price vs yahoo price -> diff%
ASSIGN flag:
  HIGH_CONFIDENCE / MISSING_DATA / INCONSISTENT_DATA
BUILD warnings[]
OUTPUT: data_quality report
```

### 2.5 Rolling Backtest Engine (Critical)
```text
INPUT: rebalancing (monthly/quarterly), universe size, max windows
LOAD universe symbols + delisted candidates (survivorship mitigation)
FETCH per symbol:
  monthly chart history
  fundamentals time series
FETCH benchmark chart: ^JKSE
FOR each rolling window:
  TRAIN period = 5Y
  TEST period = 1Y (strict OOS)
  ON TRAIN: optimize topN from candidate [5,8,12] using Sharpe
  ON TEST:
    rebalance each period
    snapshot fundamentals at rebalance date
    run valuation score
    select topN
    hold until next rebalance
    update strategy NAV and benchmark NAV
    record drawdown
  compute metrics:
    CAGR, Sharpe, Max DD, Win Rate, Alpha vs benchmark
AGGREGATE all windows
OUTPUT: windows[], equity curve, drawdown, summary, survivorship metadata
```

## 3. Struktur Data & API Design

### 3.1 Core New Objects
- ValuationExplainability
- RiskProfile
- SensitivityResult
- DataQualityReport
- PortfolioBacktestResponse (rolling windows)

### 3.2 Endpoint
1. GET /api/stock/[symbol]
- Tambahan payload: valuation.explainability, valuation.risk_profile, valuation.sensitivity, valuation.data_quality

2. GET /api/stocks/stream
- Tambahan telemetry: stats.dataQuality (high/missing/inconsistent)

3. GET /api/portfolio-backtest?rebalancing=MONTHLY|QUARTERLY&windows=1..4&universe=10..40
- Return rolling windows dengan:
  - train/test boundaries
  - selectedTopN
  - equityCurve[]
  - summary metrics
  - aggregate summary
  - survivorship metadata

## 4. UI/UX Improvements (Implemented)

1. Detail saham
- Explainability panel:
  - contribution bar per method
  - composite confidence + model coverage
- Waterfall intrinsic panel
- Advanced risk panel:
  - risk score 0-100
  - cyclicality class
  - value trap/high risk flags
- Sensitivity panel:
  - bullish/neutral/bearish
  - intrinsic range min-max
  - tornado impact bars
- Data quality panel:
  - completeness score
  - confidence score
  - quality flag + warnings

2. Dashboard screener
- Tambahan data quality telemetry realtime
- Risk/data quality tags langsung di baris tabel emiten

3. Portfolio backtest page
- Input controls (rebalancing/window/universe)
- Equity curve chart
- Drawdown chart
- Window-by-window performance summary table
- Aggregate metrics + survivorship notes

## 5. Contoh Output (1 Saham)

Contoh ringkas output evaluasi emiten:

```json
{
  "symbol": "BBCA.JK",
  "recommendation": "Buy",
  "intrinsic_value": 11250,
  "mos": 0.18,
  "explainability": {
    "contributions": [
      { "method": "DCF", "contributionPct": 42.1 },
      { "method": "MEAN_REVERSION", "contributionPct": 28.7 },
      { "method": "GRAHAM", "contributionPct": 16.8 },
      { "method": "DIVIDEND_YIELD", "contributionPct": 12.4 }
    ],
    "confidenceDetail": {
      "compositeConfidence": 0.71,
      "modelCoverage": 1.0
    }
  },
  "risk_profile": {
    "riskScore": 38,
    "cyclicalityClass": "DEFENSIVE",
    "flags": []
  },
  "sensitivity": {
    "valueRange": { "min": 9600, "max": 12600 },
    "scenarios": { "bearish": 9800, "neutral": 11250, "bullish": 12450 }
  },
  "data_quality": {
    "flag": "HIGH_CONFIDENCE",
    "dataCompletenessScore": 89,
    "confidenceScore": 84
  }
}
```

## 6. Constraint Alignment

1. Hindari overfitting
- Rolling window + strict OOS
- TopN optimization hanya di data training
- Test period tidak dipakai saat calibration

2. Prioritaskan interpretability
- Kontribusi metode eksplisit
- Confidence breakdown transparan
- Reasoning + risk flags dapat ditelusuri

3. Better approximately right than precisely wrong
- Data quality gating
- Outlier capping
- Scenario ranges menggantikan single-point certainty

## 7. Next Validation Checklist

1. Run backtest 2x:
- Monthly rebalancing
- Quarterly rebalancing
Bandingkan stabilitas alpha dan drawdown.

2. Audit kualitas data:
- Cek proporsi MISSING_DATA / INCONSISTENT_DATA
- Kurangi exposure emiten flag merah pada ranking final.

3. Investor communication:
- Gunakan panel explainability + risk flags sebagai bahan komite investasi.
