import YahooFinance from 'yahoo-finance2';
import { StockFinancials, PricePoint } from '@/types/stock';

// v3: must instantiate with new YahooFinance()
const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey', 'ripHistorical'],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeNum(val: any): number | null {
  if (val === null || val === undefined || typeof val === 'boolean') return null;
  const n = Number(val);
  return isFinite(n) && !isNaN(n) ? n : null;
}

export async function fetchStockFinancials(
  symbol: string,
  name: string,
  sector: string
): Promise<StockFinancials | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let s: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ts: any[] = [];

    try {
      q = await yf.quote(symbol);
    } catch {
      // quote may fail for some symbols
    }

    try {
      s = await yf.quoteSummary(symbol, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
      });
    } catch {
      // quoteSummary may partially fail
    }

    try {
      const datesRes = await yf.fundamentalsTimeSeries(symbol, {
        module: 'all',
        period1: '2021-01-01',
      });
      // Sort newest to oldest so index 0 = newest, index 1 = previous year
      ts = Array.isArray(datesRes)
        ? datesRes.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        : [];
    } catch {
      // fundamentalsTimeSeries may fail
    }

    const currentPrice =
      safeNum(q?.regularMarketPrice) ??
      safeNum(s?.financialData?.currentPrice) ??
      0;

    if (!currentPrice) return null;

    const fd = s?.financialData ?? {};
    const ks = s?.defaultKeyStatistics ?? {};
    const sd = s?.summaryDetail ?? {};

    const getTS = (key: string, index: number = 0) => {
      if (!ts || ts.length <= index) return null;
      return safeNum(ts[index][key]);
    };

    // Revenue & growth
    const revenue = safeNum(fd?.totalRevenue) ?? getTS('totalRevenue', 0) ?? getTS('operatingRevenue', 0);
    const revenueGrowth = safeNum(fd?.revenueGrowth); // YoY from Yahoo

    // Profitability
    const netIncome = safeNum(fd?.netIncomeToCommon) ?? getTS('netIncome', 0) ?? getTS('netIncomeCommonStockholders', 0);
    const prevNetIncome = getTS('netIncome', 1) ?? getTS('netIncomeCommonStockholders', 1);

    const eps = safeNum(ks?.trailingEps) ?? safeNum(q?.epsTrailingTwelveMonths);
    const epsGrowth = safeNum(fd?.earningsGrowth); // YoY EPS growth from Yahoo

    // Cash flow
    const operatingCashFlow = safeNum(fd?.operatingCashflow) ?? getTS('operatingCashFlow', 0);
    const prevOperatingCashFlow = getTS('operatingCashFlow', 1);

    const capex = getTS('capitalExpenditure', 0);
    const freeCashFlow = safeNum(fd?.freeCashflow) ?? (operatingCashFlow && capex ? operatingCashFlow - Math.abs(capex) : operatingCashFlow);

    // Balance sheet
    const totalDebt = safeNum(fd?.totalDebt) ?? getTS('totalDebt', 0);
    const prevLongTermDebt = getTS('longTermDebt', 1) ?? getTS('totalDebt', 1);

    // Shares
    const sharesOutstanding = safeNum(ks?.sharesOutstanding) ?? safeNum(q?.sharesOutstanding) ?? getTS('ordinarySharesNumber', 0);
    const prevSharesOutstanding = getTS('ordinarySharesNumber', 1) ?? getTS('shareIssued', 1);

    const bookValuePerShare = safeNum(ks?.bookValue);
    const totalEquity = bookValuePerShare && sharesOutstanding ? bookValuePerShare * sharesOutstanding : getTS('stockholdersEquity', 0);

    // Piotroski required fields
    const totalAssets = getTS('totalAssets', 0);
    const prevTotalAssets = getTS('totalAssets', 1);

    const roa = safeNum(fd?.returnOnAssets) ?? (netIncome && totalAssets && totalAssets > 0 ? netIncome / totalAssets : null);
    const prevRoa = prevNetIncome && prevTotalAssets && prevTotalAssets > 0 ? prevNetIncome / prevTotalAssets : null;

    const currentAssets = getTS('currentAssets', 0);
    const currentLiabilities = getTS('currentLiabilities', 0);
    const currentRatio = currentAssets && currentLiabilities && currentLiabilities !== 0
      ? currentAssets / currentLiabilities
      : safeNum(fd?.currentRatio);

    const prevCurrentAssets = getTS('currentAssets', 1);
    const prevCurrentLiabilities = getTS('currentLiabilities', 1);
    const prevCurrentRatio = prevCurrentAssets && prevCurrentLiabilities && prevCurrentLiabilities !== 0
      ? prevCurrentAssets / prevCurrentLiabilities
      : null;

    const grossProfit = getTS('grossProfit', 0);
    const prevGrossProfit = getTS('grossProfit', 1);
    const grossMargin = safeNum(fd?.grossMargins) ?? (grossProfit && revenue && revenue > 0 ? grossProfit / revenue : null);
    const prevRevenue = getTS('totalRevenue', 1) ?? getTS('operatingRevenue', 1);
    const prevGrossMargin = prevGrossProfit && prevRevenue && prevRevenue > 0 ? prevGrossProfit / prevRevenue : null;

    const assetTurnover = revenue && totalAssets && totalAssets > 0 ? revenue / totalAssets : null;
    const prevAssetTurnover = prevRevenue && prevTotalAssets && prevTotalAssets > 0 ? prevRevenue / prevTotalAssets : null;

    // Ratios
    const pe = safeNum(q?.trailingPE) ?? safeNum(sd?.trailingPE);
    const pb = safeNum(ks?.priceToBook) ?? safeNum(q?.priceToBook);
    const roe = safeNum(fd?.returnOnEquity);

    // ---- Historical Trailing PE (calculated from time series, NOT forwardPE) ----
    // Formula: market cap at each period / net income at each period, average across years
    // Fallback: sector average
    const historicalTrailingPE = (() => {
      const peReadings: number[] = [];
      // We have up to 5 entries in ts; compute PE for each period from market cap & net income
      for (let i = 0; i < Math.min(ts.length, 5); i++) {
        const tsNetIncome = safeNum(ts[i]?.netIncome) ?? safeNum(ts[i]?.netIncomeCommonStockholders);
        const tsMktCap = safeNum(ts[i]?.marketCap); // may not exist in fundamentalsTimeSeries
        if (tsNetIncome && tsNetIncome > 0 && sharesOutstanding && sharesOutstanding > 0) {
          // Estimate historical EPS from time-series net income
          const tsEPS = tsNetIncome / sharesOutstanding;
          // Estimate historical price from time-series (approx: we don't have daily price here,
          // but we can calculate implied PE from current PE weight or skip if no price data)
          // Best available: use current PE as a "starting point" and only if we have multiple data points
          // For robustness, compute from the netIncome trajectory relative to current EPS
          if (eps && eps > 0 && pe && pe > 0) {
            // Implied PE = currentPE * (currentEPS / historicalEPS)
            const impliedHistoricalPE = pe * (eps / tsEPS);
            // Only accept reasonable PE values
            if (impliedHistoricalPE > 0 && impliedHistoricalPE < 100) {
              peReadings.push(impliedHistoricalPE);
            }
          }
        }
        // If tsMktCap is available (rare in fundamentalTS but try anyway)
        if (tsNetIncome && tsNetIncome > 0 && tsMktCap && tsMktCap > 0) {
          const tsTrailingPE = tsMktCap / tsNetIncome;
          if (tsTrailingPE > 0 && tsTrailingPE < 100) {
            peReadings.push(tsTrailingPE);
          }
        }
      }

      if (peReadings.length >= 2) {
        // Average, then bound to reasonable range
        const avg = peReadings.reduce((a, b) => a + b, 0) / peReadings.length;
        return Math.min(Math.max(avg, 4), 80);
      }

      // Fallback: use trailing PE itself if available
      if (pe && pe > 0 && pe < 80) return pe;
      return null;
    })();

    // Dividend
    const dividendYield = safeNum(q?.dividendYield) ?? safeNum(sd?.dividendYield);
    const historicalDividendYield = safeNum(sd?.fiveYearAvgDividendYield);
    const payoutRatio = safeNum(sd?.payoutRatio);

    const debtToEquity: number | null = (() => {
      if (!totalDebt || !totalEquity || totalEquity === 0) return null;
      return (totalDebt / totalEquity) * 100;
    })();

    const marketCap = safeNum(q?.marketCap) ?? safeNum(sd?.marketCap) ?? 0;
    const enterpriseValue = safeNum(ks?.enterpriseValue);
    const ebitda = safeNum(fd?.ebitda);

    return {
      symbol,
      name: q?.longName ?? q?.shortName ?? name,
      sector,
      currentPrice,
      marketCap,
      pe,
      historicalTrailingPE,
      pb,
      roe,
      roa,
      debtToEquity,
      eps,
      revenueGrowth,
      epsGrowth,
      revenue,
      netIncome,
      ebitda,
      bookValuePerShare,
      totalDebt,
      totalEquity,
      freeCashFlow,
      operatingCashFlow,
      enterpriseValue,
      dividendYield,
      historicalDividendYield,
      payoutRatio,

      prevNetIncome,
      prevRoa,
      prevOperatingCashFlow,
      prevLongTermDebt,
      currentRatio,
      prevCurrentRatio,
      prevSharesOutstanding,
      sharesOutstanding,
      grossMargin,
      prevGrossMargin,
      assetTurnover,
      prevAssetTurnover,
      totalAssets,
      prevTotalAssets,
    };
  } catch (err) {
    console.error(`fetchStockFinancials failed for ${symbol}:`, (err as Error).message);
    return null;
  }
}

export async function fetchPriceHistory(
  symbol: string,
  range: '3mo' | '6mo' | '1y' | '2y' = '1y'
): Promise<PricePoint[]> {
  try {
    const months = range === '3mo' ? 3 : range === '6mo' ? 6 : range === '2y' ? 24 : 12;
    const period1 = new Date();
    period1.setMonth(period1.getMonth() - months);

    // Use chart() — historical() is deprecated in v3
    const result = await yf.chart(symbol, {
      period1: period1.toISOString().slice(0, 10),
      interval: '1d',
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: any[] = result?.quotes ?? [];
    return quotes
      .map((q) => ({
        date: (q.date instanceof Date ? q.date : new Date(q.date)).toISOString().split('T')[0],
        close: safeNum(q.close) ?? 0,
        open: safeNum(q.open) ?? 0,
        high: safeNum(q.high) ?? 0,
        low: safeNum(q.low) ?? 0,
        volume: safeNum(q.volume) ?? 0,
      }))
      .filter((p) => p.close > 0);
  } catch (err) {
    console.error(`fetchPriceHistory failed for ${symbol}:`, (err as Error).message);
    return [];
  }
}
