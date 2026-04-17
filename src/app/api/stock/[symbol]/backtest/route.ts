import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { BacktestResult, BacktestMethodResult, StockFinancials, ValuationVal } from '@/types/stock';
import { SECTOR_AVG_PE } from '@/lib/stocks-list';
import {
  calculatePiotroski,
  calculateMeanReversion,
  calculateDividendYieldReversion,
  calculateGrahamNumber,
  calculateDCFModel,
} from '@/lib/valuation';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(val: any): number | null {
  if (val === null || val === undefined || typeof val === 'boolean') return null;
  const n = Number(val);
  return isFinite(n) && !isNaN(n) ? n : null;
}

export const revalidate = 7200;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);

  try {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // ── 1. Price history (2 years to get both "then" and "now") ──────────────
    const chartResult = await yf.chart(decodedSymbol, {
      period1: (() => {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 2);
        return d.toISOString().slice(0, 10);
      })(),
      interval: '1d',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allQuotes = (chartResult?.quotes ?? []).filter((q: any) => q.close > 0);
    if (allQuotes.length === 0) {
      return NextResponse.json({ error: 'No price history available' }, { status: 404 });
    }

    // Price today
    const priceNow =
      safeNum(allQuotes[allQuotes.length - 1].close) ?? 0;

    // Find the closest trading day to exactly 1 year ago
    const targetTs = oneYearAgo.getTime();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const closest = allQuotes.reduce((prev: any, cur: any) => {
      const prevDiff = Math.abs(new Date(prev.date).getTime() - targetTs);
      const curDiff = Math.abs(new Date(cur.date).getTime() - targetTs);
      return curDiff < prevDiff ? cur : prev;
    });
    const priceThen = safeNum(closest.close) ?? 0;
    const dateOfSignal = (closest.date instanceof Date ? closest.date : new Date(closest.date))
      .toISOString()
      .split('T')[0];

    if (priceThen <= 0) {
      return NextResponse.json({ error: 'Could not determine price 1 year ago' }, { status: 422 });
    }

    // ── 2. Fundamental time series ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ts: any[] = [];
    try {
      const tsRes = await yf.fundamentalsTimeSeries(decodedSymbol, {
        module: 'all',
        period1: '2020-01-01',
      });
      ts = Array.isArray(tsRes)
        ? tsRes.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        : [];
    } catch { /* ignore */ }

    // Find the time-series entry closest to 1 year ago
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tsThen: any = ts.reduce((best: any, cur: any) => {
      if (!cur.date) return best;
      const diff = Math.abs(new Date(cur.date).getTime() - targetTs);
      if (!best) return cur;
      const bestDiff = Math.abs(new Date(best.date).getTime() - targetTs);
      return diff < bestDiff ? cur : best;
    }, null);

    // ── 3. QuoteSummary for non-time-series fields ────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = null;
    try {
      [q, s] = await Promise.all([
        yf.quote(decodedSymbol),
        yf.quoteSummary(decodedSymbol, {
          modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
        }),
      ]);
    } catch { /* ignore */ }

    const fd = s?.financialData ?? {};
    const ks = s?.defaultKeyStatistics ?? {};
    const sd = s?.summaryDetail ?? {};

    // Build a StockFinancials snapshot for 1 year ago using historical TS data
    const get = (key: string) => safeNum(tsThen?.[key]);

    const sharesOutstanding = safeNum(ks?.sharesOutstanding) ?? safeNum(q?.sharesOutstanding) ?? get('ordinarySharesNumber');
    const bookValuePerShare = safeNum(ks?.bookValue);
    const sector = q?.sector ?? 'Unknown';

    // Reconstruct EPS from historical net income
    const netIncomeThen = get('netIncome') ?? get('netIncomeCommonStockholders');
    const epsThen = netIncomeThen && sharesOutstanding && sharesOutstanding > 0
      ? netIncomeThen / sharesOutstanding
      : null;

    // Historical PE — use the entry before tsThen as "previous" for Piotroski
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tsPrev: any = ts.find(
      (e) => e.date && new Date(e.date).getTime() < new Date(tsThen?.date || 0).getTime()
    ) ?? null;
    const getPrev = (key: string) => safeNum(tsPrev?.[key]);

    const totalAssetsThen = get('totalAssets');
    const prevTotalAssets = getPrev('totalAssets');
    const roaThen = netIncomeThen && totalAssetsThen && totalAssetsThen > 0
      ? netIncomeThen / totalAssetsThen
      : null;

    const currentAssetsThen = get('currentAssets');
    const currentLiabThen = get('currentLiabilities');
    const currentRatioThen = currentAssetsThen && currentLiabThen && currentLiabThen > 0
      ? currentAssetsThen / currentLiabThen
      : null;

    const prevCurrentAssets = getPrev('currentAssets');
    const prevCurrentLiab = getPrev('currentLiabilities');
    const prevCurrentRatio = prevCurrentAssets && prevCurrentLiab && prevCurrentLiab > 0
      ? prevCurrentAssets / prevCurrentLiab
      : null;

    const revenueThen = get('totalRevenue') ?? get('operatingRevenue');
    const grossProfitThen = get('grossProfit');
    const grossMarginThen = grossProfitThen && revenueThen && revenueThen > 0
      ? grossProfitThen / revenueThen : null;
    const prevRevenue = getPrev('totalRevenue') ?? getPrev('operatingRevenue');
    const prevGrossProfit = getPrev('grossProfit');
    const prevGrossMargin = prevGrossProfit && prevRevenue && prevRevenue > 0
      ? prevGrossProfit / prevRevenue : null;

    const assetTurnoverThen = revenueThen && totalAssetsThen && totalAssetsThen > 0
      ? revenueThen / totalAssetsThen : null;
    const prevAssetTurnover = prevRevenue && prevTotalAssets && prevTotalAssets > 0
      ? prevRevenue / prevTotalAssets : null;

    // Historical trailing PE average: derive from available ts data older than tsThen
    const historicalTrailingPE: number | null = (() => {
      const pe = safeNum(q?.trailingPE);
      const eps = safeNum(ks?.trailingEps);
      if (!pe || !eps) return SECTOR_AVG_PE[sector] ?? SECTOR_AVG_PE['default'];
      if (pe > 0 && pe < 80) return pe;
      return null;
    })();

    const dividendYieldThen = safeNum(q?.dividendYield) ?? safeNum(sd?.dividendYield);
    const historicalDividendYield = safeNum(sd?.fiveYearAvgDividendYield);

    // Adjust priceThen-based marketCap estimate
    const marketCapNow = safeNum(q?.marketCap) ?? 0;
    const marketCapThen = marketCapNow > 0 && priceNow > 0 ? marketCapNow * (priceThen / priceNow) : 0;

    const ocfThen = get('operatingCashFlow');
    const capexThen = get('capitalExpenditure');
    const fcfThen = ocfThen && capexThen ? ocfThen - Math.abs(capexThen) : ocfThen;

    const financialsThen: StockFinancials = {
      symbol: decodedSymbol,
      name: q?.longName ?? q?.shortName ?? decodedSymbol.replace('.JK', ''),
      sector,
      currentPrice: priceThen,   // ← "current" = 1 year ago price for this snapshot
      marketCap: marketCapThen,
      pe: null,
      historicalTrailingPE,
      pb: null,
      roe: null,
      roa: roaThen,
      debtToEquity: null,
      eps: epsThen,
      revenueGrowth: safeNum(fd?.revenueGrowth),
      epsGrowth: null,
      revenue: revenueThen,
      netIncome: netIncomeThen,
      ebitda: get('ebitda'),
      bookValuePerShare,
      totalDebt: get('totalDebt'),
      totalEquity: bookValuePerShare && sharesOutstanding ? bookValuePerShare * sharesOutstanding : get('stockholdersEquity'),
      freeCashFlow: fcfThen && fcfThen > 0 ? fcfThen : null,
      operatingCashFlow: ocfThen,
      enterpriseValue: null,
      dividendYield: dividendYieldThen,
      historicalDividendYield,
      payoutRatio: safeNum(sd?.payoutRatio),
      prevNetIncome: getPrev('netIncome') ?? getPrev('netIncomeCommonStockholders'),
      prevRoa: (() => {
        const pni = getPrev('netIncome') ?? getPrev('netIncomeCommonStockholders');
        return pni && prevTotalAssets && prevTotalAssets > 0 ? pni / prevTotalAssets : null;
      })(),
      prevOperatingCashFlow: getPrev('operatingCashFlow'),
      prevLongTermDebt: getPrev('longTermDebt') ?? getPrev('totalDebt'),
      currentRatio: currentRatioThen,
      prevCurrentRatio,
      prevSharesOutstanding: getPrev('ordinarySharesNumber') ?? getPrev('shareIssued'),
      sharesOutstanding,
      grossMargin: grossMarginThen,
      prevGrossMargin,
      assetTurnover: assetTurnoverThen,
      prevAssetTurnover,
      totalAssets: totalAssetsThen,
      prevTotalAssets,
    };

    // ── 4. Run all valuation models with 1-year-ago snapshot ─────────────────
    const piotroskiThen = calculatePiotroski(financialsThen);
    const meanReversionThen = calculateMeanReversion(financialsThen);
    const dividendYieldThen_ = calculateDividendYieldReversion(financialsThen);
    const grahamThen = calculateGrahamNumber(financialsThen);
    const dcfThen = calculateDCFModel(financialsThen);

    const actualReturnPct = priceNow > 0 && priceThen > 0
      ? ((priceNow - priceThen) / priceThen) * 100
      : 0;

    function buildMethodResult(
      signal: ValuationVal,
      fairValueThen: number | null
    ): BacktestMethodResult {
      const accurate = signal === 'UNDERVALUED' ? actualReturnPct > 0 :
        signal === 'OVERVALUED' ? actualReturnPct < 0 :
          null;
      return {
        signal,
        fairValueThen,
        priceThen,
        priceNow,
        actualReturnPct,
        accurate,
      };
    }

    const result: BacktestResult = {
      symbol: decodedSymbol,
      priceThen,
      priceNow,
      dateOfSignal,
      actualReturnPct,
      methods: {
        piotroski: { scoreThen: piotroskiThen.score, signal: piotroskiThen.category },
        meanReversion: buildMethodResult(meanReversionThen.category, meanReversionThen.value),
        dividendYield: buildMethodResult(dividendYieldThen_.category, dividendYieldThen_.value),
        graham: buildMethodResult(grahamThen.category, grahamThen.value),
        dcf: buildMethodResult(dcfThen.category, dcfThen.value),
      },
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=7200, stale-while-revalidate=14400' },
    });
  } catch (err) {
    console.error(`Backtest failed for ${decodedSymbol}:`, (err as Error).message);
    return NextResponse.json({ error: 'Backtest calculation failed' }, { status: 500 });
  }
}
