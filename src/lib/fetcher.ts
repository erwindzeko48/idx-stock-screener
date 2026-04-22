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

function medianNum(values: number[]): number | null {
  if (values.length === 0) return null;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

function normalizeSector(raw: string | null | undefined): string {
  const s = String(raw || '').trim();
  if (!s) return 'default';

  const l = s.toLowerCase();
  if (l.includes('bank') || l.includes('financial')) return 'Banking';
  if (l.includes('telecom') || l.includes('communication')) return 'Telecommunications';
  if (l.includes('consumer defensive') || l.includes('consumer staples')) return 'Consumer Staples';
  if (l.includes('consumer cyclical') || l.includes('automotive')) return 'Automotive';
  if (l.includes('health')) return 'Healthcare';
  if (l.includes('energy') || l.includes('oil') || l.includes('gas')) return 'Energy';
  if (l.includes('mining') || l.includes('coal')) return 'Mining';
  if (l.includes('basic materials') || l.includes('materials') || l.includes('chemical')) return 'Materials';
  if (l.includes('real estate') || l.includes('property')) return 'Property';
  if (l.includes('industrial') || l.includes('infrastructure') || l.includes('utility')) return 'Infrastructure';
  if (l.includes('technology') || l.includes('software') || l.includes('internet')) return 'Technology';
  if (l.includes('agri') || l.includes('farm') || l.includes('plantation')) return 'Agriculture';
  if (l.includes('metal') || l.includes('steel')) return 'Metals';
  if (l.includes('retail')) return 'Retail';
  if (l.includes('media') || l.includes('entertainment')) return 'Media';
  if (l.includes('transport') || l.includes('logistics')) return 'Transportation';
  return 'default';
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
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'summaryProfile'],
      });
    } catch {
      // quoteSummary may partially fail
    }

    try {
      const datesRes = await yf.fundamentalsTimeSeries(symbol, {
        module: 'all',
        period1: '2021-01-01',
      });
      // Sort newest to oldest: index 0 = newest, index 1 = previous period
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
    const sp = s?.summaryProfile ?? {};
    const yahooSector = normalizeSector(sp?.sector);
    const resolvedSector = yahooSector !== 'default' ? yahooSector : normalizeSector(sector);

    const getTS = (key: string, index: number = 0) => {
      if (!ts || ts.length <= index) return null;
      return safeNum(ts[index][key]);
    };

    // ── Shares outstanding ────────────────────────────────────────────────────
    const sharesOutstanding =
      safeNum(ks?.sharesOutstanding) ??
      safeNum(ks?.impliedSharesOutstanding) ??
      getTS('ordinarySharesNumber', 0) ??
      getTS('shareIssued', 0);

    const prevSharesOutstanding =
      getTS('ordinarySharesNumber', 1) ??
      getTS('shareIssued', 1);

    // ── Momentum ─────────────────────────────────────────────────────────────
    const return12m = safeNum(ks?.['52WeekChange']);
    const twoHundredAvg = safeNum(sd?.twoHundredDayAverage);
    const return6m = (currentPrice && twoHundredAvg && twoHundredAvg > 0) 
      ? (currentPrice - twoHundredAvg) / twoHundredAvg 
      : null;

    // ── Revenue ───────────────────────────────────────────────────────────────
    const revenue =
      safeNum(fd?.totalRevenue) ??
      getTS('totalRevenue', 0) ??
      getTS('operatingRevenue', 0);

    const prevRevenue =
      getTS('totalRevenue', 1) ??
      getTS('operatingRevenue', 1);

    const revenueGrowth = safeNum(fd?.revenueGrowth);

    // ── Net income ────────────────────────────────────────────────────────────
    const netIncome =
      safeNum(fd?.netIncomeToCommon) ??
      getTS('netIncome', 0) ??
      getTS('netIncomeCommonStockholders', 0);

    const prevNetIncome =
      getTS('netIncome', 1) ??
      getTS('netIncomeCommonStockholders', 1);

    // ── EPS (CRITICAL: many Indonesian stocks lack trailingEps in Yahoo) ──────
    // Fallback chain: Yahoo EPS → derived from yearly net income / shares → quarterly annualised
    const eps: number | null = (() => {
      const fromYahoo = safeNum(ks?.trailingEps) ?? safeNum(q?.epsTrailingTwelveMonths);
      if (fromYahoo !== null) return fromYahoo;

      // Derive from net income / shares
      if (netIncome !== null && sharesOutstanding && sharesOutstanding > 0) {
        return netIncome / sharesOutstanding;
      }
      // Derive from time-series net income
      const tsNetIncome = getTS('netIncome', 0) ?? getTS('netIncomeCommonStockholders', 0);
      if (tsNetIncome !== null && sharesOutstanding && sharesOutstanding > 0) {
        return tsNetIncome / sharesOutstanding;
      }
      return null;
    })();

    const epsGrowth = safeNum(fd?.earningsGrowth);

    // ── Cash flow ─────────────────────────────────────────────────────────────
    const operatingCashFlow =
      safeNum(fd?.operatingCashflow) ??
      getTS('operatingCashFlow', 0);

    const prevOperatingCashFlow = getTS('operatingCashFlow', 1);

    const capex = getTS('capitalExpenditure', 0);

    // FCF: prefer direct Yahoo value, then calculate from OCF - CapEx
    // If OCF exists but CapEx is null (e.g., banks), use OCF directly as FCF proxy
    const freeCashFlow: number | null = (() => {
      const direct = safeNum(fd?.freeCashflow);
      if (direct !== null) return direct;
      if (operatingCashFlow !== null && capex !== null) {
        return operatingCashFlow - Math.abs(capex);
      }
      // For banks/financials: CapEx is negligible, OCF ≈ FCF
      if (operatingCashFlow !== null) return operatingCashFlow;
      return null;
    })();

    // ── Balance sheet ─────────────────────────────────────────────────────────
    const totalAssets = getTS('totalAssets', 0);
    const prevTotalAssets = getTS('totalAssets', 1);
    const totalDebt =
      safeNum(fd?.totalDebt) ??
      getTS('totalDebt', 0) ??
      getTS('longTermDebt', 0);
    const prevLongTermDebt =
      getTS('longTermDebt', 1) ??
      getTS('totalDebt', 1);

    // Book Value Per Share: Yahoo bookValue → derived from stockholders' equity / shares
    const bookValuePerShare: number | null = (() => {
      const fromYahoo = safeNum(ks?.bookValue);
      if (fromYahoo !== null && fromYahoo > 0) return fromYahoo;
      const equity =
        getTS('stockholdersEquity', 0) ??
        getTS('totalEquityGrossMinorityInterest', 0) ??
        getTS('commonStockEquity', 0);
      if (equity !== null && sharesOutstanding && sharesOutstanding > 0) {
        return equity / sharesOutstanding;
      }
      return null;
    })();

    const totalEquity: number | null =
      (bookValuePerShare && sharesOutstanding ? bookValuePerShare * sharesOutstanding : null) ??
      getTS('stockholdersEquity', 0) ??
      getTS('totalEquityGrossMinorityInterest', 0) ??
      getTS('commonStockEquity', 0);

    // ── ROA / ROE / Ratios ────────────────────────────────────────────────────
    const roa =
      safeNum(fd?.returnOnAssets) ??
      (netIncome && totalAssets && totalAssets > 0 ? netIncome / totalAssets : null);

    const prevRoa =
      prevNetIncome && prevTotalAssets && prevTotalAssets > 0
        ? prevNetIncome / prevTotalAssets
        : null;

    const roe = safeNum(fd?.returnOnEquity);

    const pe = safeNum(q?.trailingPE) ?? safeNum(sd?.trailingPE);
    const pb = safeNum(ks?.priceToBook) ?? safeNum(q?.priceToBook);

    // ── Current ratio ─────────────────────────────────────────────────────────
    const currentAssets = getTS('currentAssets', 0);
    const currentLiabilities = getTS('currentLiabilities', 0);
    const currentRatio =
      (currentAssets && currentLiabilities && currentLiabilities > 0
        ? currentAssets / currentLiabilities
        : null) ??
      safeNum(fd?.currentRatio);

    const prevCurrentAssets = getTS('currentAssets', 1);
    const prevCurrentLiabilities = getTS('currentLiabilities', 1);
    const prevCurrentRatio =
      prevCurrentAssets && prevCurrentLiabilities && prevCurrentLiabilities > 0
        ? prevCurrentAssets / prevCurrentLiabilities
        : null;

    // ── Gross margin & asset turnover ─────────────────────────────────────────
    const grossProfit = getTS('grossProfit', 0);
    const prevGrossProfit = getTS('grossProfit', 1);

    const grossMargin =
      safeNum(fd?.grossMargins) ??
      (grossProfit && revenue && revenue > 0 ? grossProfit / revenue : null);

    const prevGrossMargin =
      prevGrossProfit && prevRevenue && prevRevenue > 0
        ? prevGrossProfit / prevRevenue
        : null;

    const assetTurnover =
      revenue && totalAssets && totalAssets > 0 ? revenue / totalAssets : null;

    const prevAssetTurnover =
      prevRevenue && prevTotalAssets && prevTotalAssets > 0
        ? prevRevenue / prevTotalAssets
        : null;

    // ── Historical trailing PE (computed from time-series, not forwardPE) ────
    const historicalTrailingPE: number | null = (() => {
      const peReadings: number[] = [];

      for (let i = 0; i < Math.min(ts.length, 5); i++) {
        const tsNetIncome =
          safeNum(ts[i]?.netIncome) ?? safeNum(ts[i]?.netIncomeCommonStockholders);
        if (tsNetIncome && tsNetIncome > 0 && sharesOutstanding && sharesOutstanding > 0 && eps && eps > 0 && pe && pe > 0) {
          const tsEPS = tsNetIncome / sharesOutstanding;
          const implied = pe * (eps / tsEPS);
          if (implied > 0 && implied < 60) peReadings.push(implied);
        }
      }

      if (peReadings.length >= 2) {
        const med = medianNum(peReadings);
        if (med !== null) return Math.min(Math.max(med, 4), 35);
      }
      if (pe && pe > 0 && pe < 35) return pe;
      return null;
    })();

    // ── Dividend data ─────────────────────────────────────────────────────────
    // IMPORTANT: Yahoo sources differ in format:
    //   q.dividendYield          → PERCENTAGE (e.g. 5.15 means 5.15%)  ← must ÷100
    //   sd.dividendYield         → DECIMAL    (e.g. 0.0515 means 5.15%) ← use as-is
    //   sd.fiveYearAvgDividendYield → PERCENTAGE (e.g. 2.48 means 2.48%) ← must ÷100
    // We normalise everything to DECIMAL for internal storage.
    const dividendYield: number | null = (() => {
      const fromQuote = safeNum(q?.dividendYield);
      if (fromQuote !== null && fromQuote > 0) return fromQuote / 100; // pct → decimal
      const fromSD = safeNum(sd?.dividendYield);
      if (fromSD !== null && fromSD > 0) {
        return fromSD > 1 ? fromSD / 100 : fromSD;
      }
      return null;
    })();

    // historicalDividendYield: fiveYearAvgDividendYield is in PERCENTAGE form
    const historicalDividendYield: number | null = (() => {
      const fromYahoo = safeNum(sd?.fiveYearAvgDividendYield);
      if (fromYahoo !== null && fromYahoo > 0) return fromYahoo / 100; // pct → decimal

      // Compute from time-series: dividendsPerShare / estimated price at that period
      const yields: number[] = [];
      for (let i = 0; i < Math.min(ts.length, 5); i++) {
        const dps =
          safeNum(ts[i]?.commonStockDividendPaid) ??
          safeNum(ts[i]?.dividendsPayable);

        if (dps !== null && sharesOutstanding && sharesOutstanding > 0 && currentPrice > 0) {
          // dps here is total dividends paid (negative cash-flow field), convert to per-share
          const dpsPerShare = Math.abs(dps) / sharesOutstanding;
          // Approximate price at that period (rough: scale current price by earnings ratio)
          const tsNI = safeNum(ts[i]?.netIncome) ?? safeNum(ts[i]?.netIncomeCommonStockholders);
          const approxPrice = (tsNI && netIncome && netIncome !== 0)
            ? currentPrice * (tsNI / netIncome)
            : currentPrice;
          if (approxPrice > 0) {
            const y = dpsPerShare / approxPrice;
            if (y > 0 && y < 0.30) yields.push(y); // cap at 30% to filter outliers
          }
        }
      }

      if (yields.length >= 2) {
        return yields.reduce((a, b) => a + b, 0) / yields.length;
      }
      // Final fallback: if current yield exists, use it as proxy for historical average
      if (dividendYield && dividendYield > 0) return dividendYield;
      return null;
    })();

    const payoutRatio = (() => {
      const pr = safeNum(sd?.payoutRatio);
      if (pr === null || pr < 0) return null;
      return pr > 1 ? pr / 100 : pr;
    })();

    // ── Derived ratios ────────────────────────────────────────────────────────
    const debtToEquity: number | null =
      totalDebt && totalEquity && totalEquity > 0
        ? (totalDebt / totalEquity) * 100
        : null;

    const marketCap = safeNum(q?.marketCap) ?? safeNum(sd?.marketCap) ?? 0;
    const enterpriseValue = safeNum(ks?.enterpriseValue);
    const ebitda = safeNum(fd?.ebitda);

    // ── Extract Historical Arrays (0 = newest, 4 = oldest, up to 5 elements) ──
    const netIncomeHistory: (number | null)[] = [];
    const fcfHistory: (number | null)[] = [];
    const revenueHistory: (number | null)[] = [];
    const sharesHistory: (number | null)[] = [];
    const epsHistory: (number | null)[] = [];
    const dividendHistory: (number | null)[] = [];
    const grossMarginHistory: (number | null)[] = [];

    for (let i = 0; i < Math.min(ts.length, 5); i++) {
      const data = ts[i] || {};
      
      const tsNI = safeNum(data.netIncome) ?? safeNum(data.netIncomeCommonStockholders);
      netIncomeHistory.push(tsNI);

      const tsRev = safeNum(data.totalRevenue) ?? safeNum(data.operatingRevenue);
      revenueHistory.push(tsRev);

      const tsShares = safeNum(data.ordinarySharesNumber) ?? safeNum(data.shareIssued);
      sharesHistory.push(tsShares);

      if (tsNI !== null && tsShares && tsShares > 0) epsHistory.push(tsNI / tsShares);
      else epsHistory.push(null);

      const tsOcf = safeNum(data.operatingCashFlow);
      const tsCapex = safeNum(data.capitalExpenditure);
      if (tsOcf !== null && tsCapex !== null) fcfHistory.push(tsOcf - Math.abs(tsCapex));
      else if (tsOcf !== null) fcfHistory.push(tsOcf); // Fallback for banks
      else fcfHistory.push(null);

      const tsDiv = safeNum(data.commonStockDividendPaid) ?? safeNum(data.dividendsPayable);
      if (tsDiv !== null && tsShares && tsShares > 0) dividendHistory.push(Math.abs(tsDiv) / tsShares);
      else dividendHistory.push(null);

      const tsGross = safeNum(data.grossProfit);
      if (tsGross !== null && tsRev && tsRev > 0) grossMarginHistory.push(tsGross / tsRev);
      else grossMarginHistory.push(null);
    }

    return {
      symbol,
      name: q?.longName ?? q?.shortName ?? name,
      sector: resolvedSector,
      currentPrice,
      marketCap,
      pe,
      historicalTrailingPE,
      pb,
      roe,
      roa,
      debtToEquity,
      
      return12m,
      return6m,
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

      epsHistory,
      fcfHistory,
      netIncomeHistory,
      revenueHistory,
      dividendHistory,
      sharesHistory,
      grossMarginHistory,

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
