import YahooFinance from 'yahoo-finance2';
import { IDX_STOCKS } from '@/lib/stocks-list';
import {
  BacktestPerformanceSummary,
  BacktestPoint,
  PortfolioBacktestResponse,
  RollingBacktestWindowResult,
  StockFinancials,
} from '@/types/stock';
import { valuateStock } from '@/lib/valuation';
import { MethodWeightSet, ModelProfile } from '@/lib/engines/modelProfileEngine';

type Rebalancing = 'MONTHLY' | 'QUARTERLY';

type EngineOptions = {
  rebalancing: Rebalancing;
  universeSize: number;
  maxWindows: number;
  modelProfile?: ModelProfile;
  overrideMethodWeights?: Partial<MethodWeightSet>;
};

type AssetBundle = {
  symbol: string;
  name: string;
  sector: string;
  quotes: Array<{ date: Date; close: number }>;
  ts: Array<{ date?: string | Date }>;
};

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

const DELISTED_CANDIDATES = ['TRAM.JK', 'BTEL.JK', 'BORN.JK', 'SUGI.JK'];

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || typeof v === 'boolean') return null;
  const n = Number(v);
  return isFinite(n) && !isNaN(n) ? n : null;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function findQuoteAtOrBefore(bundle: AssetBundle, target: Date): number | null {
  for (let i = bundle.quotes.length - 1; i >= 0; i--) {
    if (bundle.quotes[i].date.getTime() <= target.getTime()) {
      return bundle.quotes[i].close;
    }
  }
  return null;
}

function findClosestTsIndex(ts: AssetBundle['ts'], target: Date): number {
  let bestIdx = -1;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ts.length; i++) {
    const rawDate = ts[i].date;
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (!isFinite(d.getTime())) continue;
    const diff = Math.abs(target.getTime() - d.getTime());
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function buildHistoryArray(ts: AssetBundle['ts'], startIdx: number, keyA: string, keyB?: string): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = startIdx; i < Math.min(startIdx + 5, ts.length); i++) {
    const row = ts[i] as Record<string, unknown>;
    const v = toNum(row[keyA]);
    if (v !== null) {
      out.push(v);
      continue;
    }
    if (keyB) {
      out.push(toNum(row[keyB]));
    } else {
      out.push(null);
    }
  }
  while (out.length < 5) out.push(null);
  return out;
}

function buildSnapshot(bundle: AssetBundle, asOf: Date): StockFinancials | null {
  const currentPrice = findQuoteAtOrBefore(bundle, asOf);
  if (!currentPrice || currentPrice <= 0) return null;

  const idx = findClosestTsIndex(bundle.ts, asOf);
  if (idx < 0) return null;

  const cur = bundle.ts[idx] as Record<string, unknown>;
  const prev = bundle.ts[idx + 1] as Record<string, unknown> | undefined;

  const sharesOutstanding =
    toNum(cur.ordinarySharesNumber) ??
    toNum(cur.shareIssued) ??
    toNum(prev?.ordinarySharesNumber) ??
    null;

  const netIncome = toNum(cur.netIncome) ?? toNum(cur.netIncomeCommonStockholders);
  const prevNetIncome = toNum(prev?.netIncome) ?? toNum(prev?.netIncomeCommonStockholders);
  const totalAssets = toNum(cur.totalAssets);
  const prevTotalAssets = toNum(prev?.totalAssets);

  const revenue = toNum(cur.totalRevenue) ?? toNum(cur.operatingRevenue);
  const prevRevenue = toNum(prev?.totalRevenue) ?? toNum(prev?.operatingRevenue);

  const grossProfit = toNum(cur.grossProfit);
  const prevGrossProfit = toNum(prev?.grossProfit);

  const operatingCashFlow = toNum(cur.operatingCashFlow);
  const prevOperatingCashFlow = toNum(prev?.operatingCashFlow);

  const capex = toNum(cur.capitalExpenditure);
  const freeCashFlow = operatingCashFlow !== null
    ? (capex !== null ? operatingCashFlow - Math.abs(capex) : operatingCashFlow)
    : null;

  const totalDebt = toNum(cur.totalDebt) ?? toNum(cur.longTermDebt);
  const prevLongTermDebt = toNum(prev?.longTermDebt) ?? toNum(prev?.totalDebt);

  const bookEquity = toNum(cur.stockholdersEquity) ?? toNum(cur.commonStockEquity);
  const totalEquity = bookEquity;
  const bookValuePerShare = (bookEquity !== null && sharesOutstanding && sharesOutstanding > 0)
    ? (bookEquity / sharesOutstanding)
    : null;

  const eps = (netIncome !== null && sharesOutstanding && sharesOutstanding > 0)
    ? netIncome / sharesOutstanding
    : null;

  const prevEps = (prevNetIncome !== null && sharesOutstanding && sharesOutstanding > 0)
    ? prevNetIncome / sharesOutstanding
    : null;

  const pe = (eps !== null && eps > 0) ? currentPrice / eps : null;

  const revenueGrowth = (revenue !== null && prevRevenue !== null && prevRevenue !== 0)
    ? (revenue - prevRevenue) / Math.abs(prevRevenue)
    : null;

  const epsGrowth = (eps !== null && prevEps !== null && prevEps !== 0)
    ? (eps - prevEps) / Math.abs(prevEps)
    : null;

  const roa = (netIncome !== null && totalAssets !== null && totalAssets > 0)
    ? netIncome / totalAssets
    : null;

  const prevRoa = (prevNetIncome !== null && prevTotalAssets !== null && prevTotalAssets > 0)
    ? prevNetIncome / prevTotalAssets
    : null;

  const debtToEquity = (totalDebt !== null && totalEquity !== null && totalEquity > 0)
    ? (totalDebt / totalEquity) * 100
    : null;

  const currentAssets = toNum(cur.currentAssets);
  const currentLiabilities = toNum(cur.currentLiabilities);
  const currentRatio = (currentAssets !== null && currentLiabilities !== null && currentLiabilities > 0)
    ? currentAssets / currentLiabilities
    : null;

  const prevCurrentAssets = toNum(prev?.currentAssets);
  const prevCurrentLiabilities = toNum(prev?.currentLiabilities);
  const prevCurrentRatio = (prevCurrentAssets !== null && prevCurrentLiabilities !== null && prevCurrentLiabilities > 0)
    ? prevCurrentAssets / prevCurrentLiabilities
    : null;

  const grossMargin = (grossProfit !== null && revenue !== null && revenue > 0)
    ? grossProfit / revenue
    : null;

  const prevGrossMargin = (prevGrossProfit !== null && prevRevenue !== null && prevRevenue > 0)
    ? prevGrossProfit / prevRevenue
    : null;

  const assetTurnover = (revenue !== null && totalAssets !== null && totalAssets > 0)
    ? revenue / totalAssets
    : null;

  const prevAssetTurnover = (prevRevenue !== null && prevTotalAssets !== null && prevTotalAssets > 0)
    ? prevRevenue / prevTotalAssets
    : null;

  const netIncomeHistory = buildHistoryArray(bundle.ts, idx, 'netIncome', 'netIncomeCommonStockholders');
  const revenueHistory = buildHistoryArray(bundle.ts, idx, 'totalRevenue', 'operatingRevenue');
  const sharesHistory = buildHistoryArray(bundle.ts, idx, 'ordinarySharesNumber', 'shareIssued');
  const epsHistory = netIncomeHistory.map((ni, i) => {
    const sh = sharesHistory[i];
    if (ni === null || sh === null || sh <= 0) return null;
    return ni / sh;
  });

  const fcfHistory = bundle.ts.slice(idx, idx + 5).map((row) => {
    const ocf = toNum((row as Record<string, unknown>).operatingCashFlow);
    const cpx = toNum((row as Record<string, unknown>).capitalExpenditure);
    if (ocf === null) return null;
    return cpx === null ? ocf : ocf - Math.abs(cpx);
  });
  while (fcfHistory.length < 5) fcfHistory.push(null);

  const grossMarginHistory = bundle.ts.slice(idx, idx + 5).map((row) => {
    const gp = toNum((row as Record<string, unknown>).grossProfit);
    const rev = toNum((row as Record<string, unknown>).totalRevenue) ?? toNum((row as Record<string, unknown>).operatingRevenue);
    if (gp === null || rev === null || rev <= 0) return null;
    return gp / rev;
  });
  while (grossMarginHistory.length < 5) grossMarginHistory.push(null);

  const trailingReturns = (() => {
    const nowPrice = currentPrice;
    const sixMonthPrice = findQuoteAtOrBefore(bundle, addMonths(asOf, -6));
    const twelveMonthPrice = findQuoteAtOrBefore(bundle, addMonths(asOf, -12));

    const return6m = sixMonthPrice && sixMonthPrice > 0 ? (nowPrice - sixMonthPrice) / sixMonthPrice : null;
    const return12m = twelveMonthPrice && twelveMonthPrice > 0 ? (nowPrice - twelveMonthPrice) / twelveMonthPrice : null;

    return { return6m, return12m };
  })();

  const dividendHistory = buildHistoryArray(bundle.ts, idx, 'commonStockDividendPaid', 'dividendsPayable').map((v, i) => {
    const sh = sharesHistory[i];
    if (v === null || sh === null || sh <= 0) return null;
    return Math.abs(v) / sh;
  });

  const currentDividend = dividendHistory[0] ?? null;
  const historicalDividend = dividendHistory.filter((v): v is number => typeof v === 'number' && v > 0);
  const historicalDividendYield = historicalDividend.length > 0
    ? historicalDividend.reduce((acc, v) => acc + (v / currentPrice), 0) / historicalDividend.length
    : null;

  const marketCap = sharesOutstanding && sharesOutstanding > 0 ? sharesOutstanding * currentPrice : 0;

  return {
    symbol: bundle.symbol,
    name: bundle.name,
    sector: bundle.sector,
    currentPrice,
    marketCap,
    pe,
    historicalTrailingPE: pe,
    pb: (bookValuePerShare && bookValuePerShare > 0) ? currentPrice / bookValuePerShare : null,
    roe: (netIncome !== null && totalEquity !== null && totalEquity > 0) ? netIncome / totalEquity : null,
    roa,
    debtToEquity,
    return12m: trailingReturns.return12m,
    return6m: trailingReturns.return6m,
    epsHistory,
    fcfHistory,
    netIncomeHistory,
    revenueHistory,
    dividendHistory,
    sharesHistory,
    eps,
    revenueGrowth,
    epsGrowth,
    revenue,
    netIncome,
    ebitda: toNum(cur.ebitda),
    bookValuePerShare,
    totalDebt,
    totalEquity,
    freeCashFlow,
    operatingCashFlow,
    enterpriseValue: null,
    dividendYield: currentDividend !== null ? currentDividend / currentPrice : null,
    historicalDividendYield,
    payoutRatio: null,
    prevNetIncome,
    prevRoa,
    prevOperatingCashFlow,
    prevLongTermDebt,
    currentRatio,
    prevCurrentRatio,
    prevSharesOutstanding: toNum(prev?.ordinarySharesNumber) ?? toNum(prev?.shareIssued),
    sharesOutstanding,
    grossMargin,
    prevGrossMargin,
    assetTurnover,
    prevAssetTurnover,
    totalAssets,
    prevTotalAssets,
    grossMarginHistory,
  };
}

async function loadAssetBundle(symbol: string, name: string, sector: string, fromDate: string): Promise<AssetBundle | null> {
  try {
    const [chartRes, tsRes] = await Promise.all([
      yf.chart(symbol, {
        period1: fromDate,
        interval: '1mo',
      }),
      yf.fundamentalsTimeSeries(symbol, {
        module: 'all',
        period1: fromDate,
      }).catch(() => []),
    ]);

    const quotes = (chartRes?.quotes ?? [])
      .map((q) => ({
        date: q.date instanceof Date ? q.date : new Date(q.date),
        close: toNum(q.close) ?? 0,
      }))
      .filter((q) => q.close > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const ts = Array.isArray(tsRes)
      ? tsRes
        .filter((row) => !!row?.date)
        .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
      : [];

    if (quotes.length < 36 || ts.length < 2) return null;

    return {
      symbol,
      name,
      sector,
      quotes,
      ts,
    };
  } catch {
    return null;
  }
}

function computeSummary(points: BacktestPoint[]): BacktestPerformanceSummary {
  if (points.length < 2) {
    return { cagr: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, alphaVsBenchmark: 0 };
  }

  const first = points[0];
  const last = points[points.length - 1];

  const years = Math.max(1 / 12, (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 3600 * 1000));
  const strategyReturn = last.strategy / first.strategy;
  const benchReturn = last.benchmark / first.benchmark;

  const cagr = Math.pow(strategyReturn, 1 / years) - 1;
  const benchmarkCagr = Math.pow(benchReturn, 1 / years) - 1;

  const periodReturns: number[] = [];
  const excessReturns: number[] = [];
  let wins = 0;

  for (let i = 1; i < points.length; i++) {
    const r = (points[i].strategy - points[i - 1].strategy) / points[i - 1].strategy;
    const rb = (points[i].benchmark - points[i - 1].benchmark) / points[i - 1].benchmark;
    periodReturns.push(r);
    excessReturns.push(r - rb);
    if (r > rb) wins += 1;
  }

  const avg = periodReturns.reduce((acc, v) => acc + v, 0) / periodReturns.length;
  const variance = periodReturns.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / periodReturns.length;
  const stdev = Math.sqrt(variance);
  const annualizer = Math.sqrt(12);

  const sharpe = stdev > 0 ? ((avg * 12) - 0.04) / (stdev * annualizer) : 0;

  const maxDrawdown = Math.min(...points.map((p) => p.drawdown));
  const alphaVsBenchmark = cagr - benchmarkCagr;
  const winRate = wins / Math.max(1, periodReturns.length);

  return {
    cagr,
    sharpe,
    maxDrawdown,
    winRate,
    alphaVsBenchmark,
  };
}

function buildRebalanceSchedule(start: Date, end: Date, rebalancing: Rebalancing): Date[] {
  const months = rebalancing === 'MONTHLY' ? 1 : 3;
  const dates: Date[] = [];
  let cur = startOfMonth(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur = addMonths(cur, months);
  }
  return dates;
}

function pickTopNByTraining(
  bundles: AssetBundle[],
  benchmarkBundle: AssetBundle,
  trainStart: Date,
  trainEnd: Date,
  rebalancing: Rebalancing,
  modelProfile: ModelProfile,
  overrideMethodWeights?: Partial<MethodWeightSet>,
): number {
  const candidates = [5, 8, 12];
  let bestTopN = 8;
  let bestSharpe = Number.NEGATIVE_INFINITY;

  for (const topN of candidates) {
    const sim = simulatePeriod(
      bundles,
      benchmarkBundle,
      trainStart,
      trainEnd,
      rebalancing,
      topN,
      modelProfile,
      overrideMethodWeights,
    );
    if (sim.summary.sharpe > bestSharpe) {
      bestSharpe = sim.summary.sharpe;
      bestTopN = topN;
    }
  }

  return bestTopN;
}

function simulatePeriod(
  bundles: AssetBundle[],
  benchmarkBundle: AssetBundle,
  periodStart: Date,
  periodEnd: Date,
  rebalancing: Rebalancing,
  topN: number,
  modelProfile: ModelProfile,
  overrideMethodWeights?: Partial<MethodWeightSet>,
): { points: BacktestPoint[]; summary: BacktestPerformanceSummary } {
  const schedule = buildRebalanceSchedule(periodStart, periodEnd, rebalancing);
  if (schedule.length < 2) {
    return {
      points: [{ date: periodStart.toISOString().slice(0, 10), strategy: 100, benchmark: 100, drawdown: 0 }],
      summary: { cagr: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, alphaVsBenchmark: 0 },
    };
  }

  const points: BacktestPoint[] = [{
    date: schedule[0].toISOString().slice(0, 10),
    strategy: 100,
    benchmark: 100,
    drawdown: 0,
  }];

  let strategyNav = 100;
  let benchmarkNav = 100;
  let peak = 100;

  for (let i = 0; i < schedule.length - 1; i++) {
    const rebalanceDate = schedule[i];
    const nextDate = schedule[i + 1] > periodEnd ? periodEnd : schedule[i + 1];

    const scored = bundles
      .map((bundle) => {
        const snapshot = buildSnapshot(bundle, rebalanceDate);
        if (!snapshot) return null;
        const valuation = valuateStock(snapshot, 'SIDEWAYS', {
          modelProfile,
          overrideMethodWeights,
        });
        const startPrice = findQuoteAtOrBefore(bundle, rebalanceDate);
        const endPrice = findQuoteAtOrBefore(bundle, nextDate);
        if (!startPrice || !endPrice || startPrice <= 0) return null;
        return {
          symbol: bundle.symbol,
          score: valuation.final_rank_score,
          ret: (endPrice - startPrice) / startPrice,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score);

    const chosen = scored.slice(0, Math.min(topN, scored.length));
    const strategyRet = chosen.length > 0
      ? chosen.reduce((acc, row) => acc + row.ret, 0) / chosen.length
      : 0;

    const benchmarkStart = findQuoteAtOrBefore(benchmarkBundle, rebalanceDate);
    const benchmarkEnd = findQuoteAtOrBefore(benchmarkBundle, nextDate);
    const benchmarkRet = benchmarkStart && benchmarkEnd && benchmarkStart > 0
      ? (benchmarkEnd - benchmarkStart) / benchmarkStart
      : 0;

    strategyNav *= (1 + strategyRet);
    benchmarkNav *= (1 + benchmarkRet);
    peak = Math.max(peak, strategyNav);

    points.push({
      date: nextDate.toISOString().slice(0, 10),
      strategy: strategyNav,
      benchmark: benchmarkNav,
      drawdown: peak > 0 ? (strategyNav - peak) / peak : 0,
    });
  }

  return {
    points,
    summary: computeSummary(points),
  };
}

function aggregateSummary(summaries: BacktestPerformanceSummary[]): BacktestPerformanceSummary {
  if (summaries.length === 0) {
    return { cagr: 0, sharpe: 0, maxDrawdown: 0, winRate: 0, alphaVsBenchmark: 0 };
  }

  const avg = (selector: (s: BacktestPerformanceSummary) => number) =>
    summaries.reduce((acc, s) => acc + selector(s), 0) / summaries.length;

  return {
    cagr: avg((s) => s.cagr),
    sharpe: avg((s) => s.sharpe),
    maxDrawdown: Math.min(...summaries.map((s) => s.maxDrawdown)),
    winRate: avg((s) => s.winRate),
    alphaVsBenchmark: avg((s) => s.alphaVsBenchmark),
  };
}

export async function runRollingBacktest(options: EngineOptions): Promise<PortfolioBacktestResponse> {
  const modelProfile = options.modelProfile ?? 'BALANCED';
  const now = new Date();
  const earliestNeeded = new Date(Date.UTC(now.getUTCFullYear() - 9, now.getUTCMonth(), 1));
  const fromDate = earliestNeeded.toISOString().slice(0, 10);

  const universe = IDX_STOCKS.slice(0, Math.max(10, Math.min(options.universeSize, 40)));

  const symbolsToLoad = [
    ...universe,
    ...DELISTED_CANDIDATES.map((s) => [s, s.replace('.JK', ''), 'Unknown'] as [string, string, string]),
  ];

  const bundleResults = await Promise.all(
    symbolsToLoad.map(([symbol, name, sector]) => loadAssetBundle(symbol, name, sector, fromDate)),
  );

  const bundles = bundleResults.filter((b): b is AssetBundle => b !== null);
  const unavailableSymbols = symbolsToLoad
    .map(([symbol]) => symbol)
    .filter((s) => !bundles.find((b) => b.symbol === s));

  const benchmarkRaw = await yf.chart('^JKSE', {
    period1: fromDate,
    interval: '1mo',
  });

  const benchmarkBundle: AssetBundle = {
    symbol: '^JKSE',
    name: 'IHSG',
    sector: 'Benchmark',
    quotes: (benchmarkRaw.quotes ?? [])
      .map((q) => ({
        date: q.date instanceof Date ? q.date : new Date(q.date),
        close: toNum(q.close) ?? 0,
      }))
      .filter((q) => q.close > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    ts: [],
  };

  const latestMonth = startOfMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  const windows: RollingBacktestWindowResult[] = [];
  let cursorTestEnd = latestMonth;

  for (let i = 0; i < options.maxWindows; i++) {
    const testStart = addYears(cursorTestEnd, -1);
    const trainEnd = addMonths(testStart, -1);
    const trainStart = addYears(trainEnd, -5);

    if (trainStart < earliestNeeded) break;
    
    const topNOptimized = pickTopNByTraining(
      bundles,
      benchmarkBundle,
      trainStart,
      trainEnd,
      options.rebalancing,
      modelProfile,
      options.overrideMethodWeights,
    );

    const simulated = simulatePeriod(
      bundles,
      benchmarkBundle,
      testStart,
      cursorTestEnd,
      options.rebalancing,
      topNOptimized,
      modelProfile,
      options.overrideMethodWeights,
    );

    windows.unshift({
      windowLabel: `W${options.maxWindows - i}`,
      trainStart: trainStart.toISOString().slice(0, 10),
      trainEnd: trainEnd.toISOString().slice(0, 10),
      testStart: testStart.toISOString().slice(0, 10),
      testEnd: cursorTestEnd.toISOString().slice(0, 10),
      rebalancing: options.rebalancing,
      selectedTopN: topNOptimized,
      universeSize: bundles.length,
      equityCurve: simulated.points,
      summary: simulated.summary,
    });

    cursorTestEnd = addYears(cursorTestEnd, -1);
  }

  const aggregate = aggregateSummary(windows.map((w) => w.summary));

  return {
    benchmark: {
      symbol: '^JKSE',
      name: 'IHSG',
    },
    survivorshipMitigation: {
      usedSymbols: bundles.length,
      delistedCandidates: DELISTED_CANDIDATES,
      unavailableSymbols,
    },
    windows,
    aggregate,
  };
}
