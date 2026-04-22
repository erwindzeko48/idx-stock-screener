import { runRollingBacktest } from '@/lib/backtest/rollingBacktestEngine';
import { fetchStockFinancials } from '@/lib/fetcher';
import { DYNAMIC_MODEL_SELECTION_RULES, MODEL_BLUEPRINTS, MethodWeightSet, SIGNAL_DECOMPOSITION_MAP } from '@/lib/engines/modelProfileEngine';
import { IDX_STOCKS } from '@/lib/stocks-list';
import { valuateStock } from '@/lib/valuation';

type SignalKey = 'DCF' | 'GRAHAM' | 'MEAN_REVERSION_PE' | 'DIVIDEND_YIELD' | 'PIOTROSKI_F_SCORE';

type SignalObservation = Record<SignalKey, number | null> & {
  proxyReturn: number | null;
};

function pearson(a: number[], b: number[]): number | null {
  if (a.length < 3 || b.length < 3 || a.length !== b.length) return null;

  const meanA = a.reduce((acc, v) => acc + v, 0) / a.length;
  const meanB = b.reduce((acc, v) => acc + v, 0) / b.length;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

function pairwiseCorrelation(observations: SignalObservation[], keyA: SignalKey, keyB: SignalKey): number | null {
  const x: number[] = [];
  const y: number[] = [];

  observations.forEach((obs) => {
    const a = obs[keyA];
    const b = obs[keyB];
    if (typeof a === 'number' && isFinite(a) && typeof b === 'number' && isFinite(b)) {
      x.push(a);
      y.push(b);
    }
  });

  return pearson(x, y);
}

function signalCoverage(observations: SignalObservation[], key: SignalKey): number {
  if (observations.length === 0) return 0;
  const valid = observations.filter((obs) => typeof obs[key] === 'number' && isFinite(obs[key] as number)).length;
  return valid / observations.length;
}

function signalIC(observations: SignalObservation[], key: SignalKey): number | null {
  const x: number[] = [];
  const y: number[] = [];

  observations.forEach((obs) => {
    const s = obs[key];
    const r = obs.proxyReturn;
    if (typeof s === 'number' && isFinite(s) && typeof r === 'number' && isFinite(r)) {
      x.push(s);
      y.push(r);
    }
  });

  return pearson(x, y);
}

async function collectSignalObservations(sampleSize = 14): Promise<SignalObservation[]> {
  const sample = IDX_STOCKS.slice(0, sampleSize);

  const rows = await Promise.all(sample.map(async ([symbol, name, sector]) => {
    const f = await fetchStockFinancials(symbol, name, sector);
    if (!f) return null;

    const val = valuateStock(f, 'SIDEWAYS', { modelProfile: 'FULL' });

    return {
      DCF: val.dcf.upside,
      GRAHAM: val.graham.upside,
      MEAN_REVERSION_PE: val.meanReversion.upside,
      DIVIDEND_YIELD: val.dividendYield.upside,
      PIOTROSKI_F_SCORE: val.piotroski.score !== null ? val.piotroski.score / 9 : null,
      proxyReturn: f.return6m,
    } as SignalObservation;
  }));

  return rows.filter((row): row is SignalObservation => row !== null);
}

function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export async function runModelOptimizationReport() {
  const signalKeys: SignalKey[] = ['DCF', 'GRAHAM', 'MEAN_REVERSION_PE', 'DIVIDEND_YIELD', 'PIOTROSKI_F_SCORE'];

  // 1) Signal decomposition and overlap map
  const overlapPairs = [
    {
      pair: ['DCF', 'GRAHAM'],
      reason: 'Sama-sama earnings anchored (intrinsic) sehingga bisa double count jika bobot terlalu tinggi bersamaan.',
    },
    {
      pair: ['DCF', 'MEAN_REVERSION_PE'],
      reason: 'Keduanya sensitif terhadap EPS normalization, berpotensi memberi confidence berlebih pada saham cyclical.',
    },
    {
      pair: ['DIVIDEND_YIELD', 'GRAHAM'],
      reason: 'Pada saham mature, keduanya bisa memotret sinyal defensif yang mirip.',
    },
  ];

  // 2) Redundancy analysis
  const observations = await collectSignalObservations();

  const correlationMatrix: Record<string, Record<string, number | null>> = {};
  signalKeys.forEach((a) => {
    correlationMatrix[a] = {};
    signalKeys.forEach((b) => {
      correlationMatrix[a][b] = a === b ? 1 : pairwiseCorrelation(observations, a, b);
    });
  });

  const highlyCorrelatedPairs: Array<{ a: SignalKey; b: SignalKey; corr: number }> = [];
  for (let i = 0; i < signalKeys.length; i++) {
    for (let j = i + 1; j < signalKeys.length; j++) {
      const a = signalKeys[i];
      const b = signalKeys[j];
      const corr = correlationMatrix[a][b];
      if (typeof corr === 'number' && Math.abs(corr) >= 0.7) {
        highlyCorrelatedPairs.push({ a, b, corr });
      }
    }
  }

  const signalStrength = signalKeys.map((key) => ({
    signal: key,
    ic: signalIC(observations, key),
    coverage: signalCoverage(observations, key),
  }));

  const weakSignals = signalStrength.filter((s) => (s.coverage < 0.45) || (Math.abs(s.ic ?? 0) < 0.05));

  const redundantCandidates = new Set<string>();
  highlyCorrelatedPairs.forEach(({ a, b }) => {
    const ia = Math.abs(signalStrength.find((s) => s.signal === a)?.ic ?? 0);
    const ib = Math.abs(signalStrength.find((s) => s.signal === b)?.ic ?? 0);
    redundantCandidates.add(ia <= ib ? a : b);
  });

  // 3 + 4) Model simplification and OOS backtest comparison
  const [modelA, modelB, modelC] = await Promise.all([
    runRollingBacktest({ rebalancing: 'MONTHLY', universeSize: 20, maxWindows: 2, modelProfile: 'MINIMAL' }),
    runRollingBacktest({ rebalancing: 'MONTHLY', universeSize: 20, maxWindows: 2, modelProfile: 'BALANCED' }),
    runRollingBacktest({ rebalancing: 'MONTHLY', universeSize: 20, maxWindows: 2, modelProfile: 'FULL' }),
  ]);

  const comparisonRows = [
    { model: 'A_MINIMAL', ...modelA.aggregate },
    { model: 'B_BALANCED', ...modelB.aggregate },
    { model: 'C_FULL', ...modelC.aggregate },
  ];

  const bestBySharpe = [...comparisonRows].sort((a, b) => b.sharpe - a.sharpe)[0];
  const fullVsBalancedSharpe = comparisonRows.find((r) => r.model === 'C_FULL')!.sharpe - comparisonRows.find((r) => r.model === 'B_BALANCED')!.sharpe;

  const backtestInsights = [
    `Model dengan Sharpe terbaik: ${bestBySharpe.model}.`,
    fullVsBalancedSharpe > 0.05
      ? 'Model Full memberi uplift Sharpe material vs Balanced.'
      : 'Menambah semua model tidak memberi uplift Sharpe material vs Balanced (indikasi diminishing return).',
    comparisonRows.find((r) => r.model === 'B_BALANCED')!.alphaVsBenchmark >= comparisonRows.find((r) => r.model === 'C_FULL')!.alphaVsBenchmark
      ? 'Balanced menghasilkan alpha yang setara/lebih baik dengan kompleksitas lebih rendah.'
      : 'Full model memberi alpha lebih tinggi, tetapi perlu cek kestabilan agar tidak overfit.',
  ];

  // 6) Weight optimization with constrained scenarios (BALANCED profile)
  const weightScenarios: Array<{ name: string; weights: MethodWeightSet }> = [
    { name: 'Baseline', weights: { dcf: 0.45, pe: 0.35, graham: 0.1, div: 0.1 } },
    { name: 'Value Tilt', weights: { dcf: 0.55, pe: 0.3, graham: 0.1, div: 0.05 } },
    { name: 'Relative Tilt', weights: { dcf: 0.3, pe: 0.55, graham: 0.1, div: 0.05 } },
    { name: 'Income Tilt', weights: { dcf: 0.35, pe: 0.25, graham: 0.1, div: 0.3 } },
    { name: 'Defensive Mix', weights: { dcf: 0.4, pe: 0.3, graham: 0.2, div: 0.1 } },
  ];

  const weightResults = [] as Array<{
    scenario: string;
    weights: MethodWeightSet;
    cagr: number;
    sharpe: number;
    maxDrawdown: number;
    winRate: number;
    alphaVsBenchmark: number;
    windowSharpeStd: number;
  }>;

  for (const scenario of weightScenarios) {
    const res = await runRollingBacktest({
      rebalancing: 'MONTHLY',
      universeSize: 16,
      maxWindows: 2,
      modelProfile: 'BALANCED',
      overrideMethodWeights: scenario.weights,
    });

    const windowSharpes = res.windows.map((w) => w.summary.sharpe);

    weightResults.push({
      scenario: scenario.name,
      weights: scenario.weights,
      cagr: res.aggregate.cagr,
      sharpe: res.aggregate.sharpe,
      maxDrawdown: res.aggregate.maxDrawdown,
      winRate: res.aggregate.winRate,
      alphaVsBenchmark: res.aggregate.alphaVsBenchmark,
      windowSharpeStd: std(windowSharpes),
    });
  }

  const bestWeightResult = [...weightResults].sort((a, b) => {
    const scoreA = a.sharpe + (a.alphaVsBenchmark * 1.5) - Math.abs(a.maxDrawdown * 0.2) - (a.windowSharpeStd * 0.1);
    const scoreB = b.sharpe + (b.alphaVsBenchmark * 1.5) - Math.abs(b.maxDrawdown * 0.2) - (b.windowSharpeStd * 0.1);
    return scoreB - scoreA;
  })[0];

  // 7) Final recommendation
  const recommendationModel = bestBySharpe.model === 'A_MINIMAL'
    ? 'MINIMAL'
    : bestBySharpe.model === 'B_BALANCED'
      ? 'BALANCED'
      : 'FULL';

  const finalSelectedMethods = recommendationModel === 'MINIMAL'
    ? ['Core Valuation (dynamic DCF/PE/Yield)', 'Piotroski Quality Filter']
    : recommendationModel === 'BALANCED'
      ? ['DCF', 'Mean Reversion PE', 'Piotroski', 'Optional Graham/Dividend']
      : ['DCF', 'Graham', 'Mean Reversion', 'Dividend Yield', 'Piotroski'];

  const finalRecommendation = {
    idealMethodCount: recommendationModel === 'MINIMAL' ? 2 : recommendationModel === 'BALANCED' ? 4 : 5,
    selectedMethods: finalSelectedMethods,
    chosenModel: recommendationModel,
    rationale: [
      'Metode dipilih berdasarkan trade-off alpha vs complexity dari OOS rolling backtest.',
      'Sinyal berkorelasi tinggi tidak dibobot berlebihan untuk mencegah false confidence.',
      'Quality signal (Piotroski) dipertahankan sebagai risk gate lintas model.',
    ],
    tradeOffs: [
      'Model lebih simpel meningkatkan interpretability, tetapi bisa kehilangan edge pada niche regime.',
      'Model full lebih kaya sinyal namun lebih rentan redundancy dan calibration drift.',
    ],
  };

  return {
    signalDecomposition: {
      categoryMap: SIGNAL_DECOMPOSITION_MAP,
      overlapPairs,
      redundantCandidates: Array.from(redundantCandidates),
    },
    redundancyAnalysis: {
      sampleSize: observations.length,
      correlationMatrix,
      highlyCorrelatedPairs,
      signalStrength,
      weakSignals,
      recommendations: [
        'Pertahankan Piotroski sebagai quality gate, bukan alpha source utama.',
        'Jika DCF-Graham berkorelasi tinggi, prioritaskan DCF untuk stable cashflow dan turunkan bobot Graham.',
        'Gunakan Dividend Yield hanya untuk saham income/mature agar tidak menambah noise.',
      ],
    },
    modelSimplification: {
      A: MODEL_BLUEPRINTS.MINIMAL,
      B: MODEL_BLUEPRINTS.BALANCED,
      C: MODEL_BLUEPRINTS.FULL,
    },
    backtestComparison: {
      benchmark: 'IHSG (^JKSE)',
      rollingSetup: '5Y train -> 1Y test, monthly rebalance, OOS strict',
      rows: comparisonRows,
      insights: backtestInsights,
    },
    dynamicModelSelection: {
      decisionTree: DYNAMIC_MODEL_SELECTION_RULES,
      conditionToActiveModel: DYNAMIC_MODEL_SELECTION_RULES.map((r) => ({
        condition: r.condition,
        activeModel: r.activeModel,
        activeSignals: r.activeSignals,
      })),
    },
    weightOptimization: {
      optimalWeights: bestWeightResult.weights,
      bestScenario: bestWeightResult.scenario,
      sensitivity: weightResults,
      stability: {
        windowSharpeStd: bestWeightResult.windowSharpeStd,
        interpretation: bestWeightResult.windowSharpeStd < 0.3
          ? 'Stabil antar window.'
          : 'Variasi tinggi antar window, hindari tuning agresif.',
      },
    },
    finalRecommendation,
  };
}
