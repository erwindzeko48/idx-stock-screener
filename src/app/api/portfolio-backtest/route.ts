import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { IDX_STOCKS } from '@/lib/stocks-list';
import { StockFinancials } from '@/types/stock';
import { valuateStock } from '@/lib/valuation';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';

function safeNum(val: any): number | null {
  if (val === null || val === undefined || typeof val === 'boolean') return null;
  const n = Number(val);
  return isFinite(n) && !isNaN(n) ? n : null;
}

const ERAS = [
  { name: 'Era 2018-2020', start: '2018-01-01', end: '2020-01-01' },
  { name: 'Era 2020-2022', start: '2020-01-01', end: '2022-01-01' },
  { name: 'Era 2022-2024', start: '2022-01-01', end: '2024-01-01' },
];

export async function GET(req: NextRequest) {
  // Grab a tight sample to avoid Vercel timeout (Max 15 for deep rolling)
  const sampleStocks = ['BBCA.JK', 'TLKM.JK', 'ASII.JK', 'BMRI.JK', 'UNVR.JK', 'BBNI.JK', 'ICBP.JK', 'ADRO.JK', 'GOTO.JK', 'PGAS.JK', 'ITMG.JK', 'UNTR.JK', 'KLBF.JK', 'PTBA.JK', 'AKRA.JK'];

  try {
    const resultsByEra: any = {};

    for (const era of ERAS) {
      const eraStocks = await Promise.all(
        sampleStocks.map(async (symbol) => {
          try {
            // Get full history roughly between start - 1 year to end
            const startEpoch = new Date(era.start).getTime();
            const endEpoch = new Date(era.end).getTime();

            const p1 = new Date(startEpoch - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            
            const chart = await yf.chart(symbol, { period1: p1, period2: era.end, interval: '1mo' });
            if (!chart.quotes || chart.quotes.length < 12) return null;

            // Find point closest to Start
            let indexStart = chart.quotes.findIndex(q => new Date(q.date).getTime() >= startEpoch);
            if (indexStart === -1) indexStart = Math.max(0, chart.quotes.length - 24);
            
            const priceThen = chart.quotes[indexStart].close || 0;
            const priceEnd = chart.quotes[chart.quotes.length - 1].close || priceThen;

            // Use simplified static mocked financials due to timeout restrictions, 
            // since Yahoo API limits historical TS to ~3 requests per sec without proxy.
            // Ideally, we fetch TS module here. For the simulator, we calculate rank using Price Momentum proxy
            
            const f = {
              symbol,
              currentPrice: priceThen,
              eps: priceThen / 15, // Mock historical baseline
              bookValuePerShare: priceThen / 2,
              revenue: priceThen * 10000000,
              marketCap: priceThen * 100000000,
              pe: 15,
              totalEquity: 500000000,
              roa: 0.05,
              debtToEquity: 50,
              dividendYield: 0.03,
              freeCashFlow: 100000000,
              epsHistory: [priceThen/15, priceThen/16, priceThen/17],
              fcfHistory: [10000, 9000, 8000],
              netIncomeHistory: [5000, 4500, 4000],
              revenueHistory: [100000, 90000, 80000],
              return12m: (priceThen - chart.quotes[Math.max(0, indexStart - 12)].close!) / chart.quotes[Math.max(0, indexStart - 12)].close!,
              return6m: (priceThen - chart.quotes[Math.max(0, indexStart - 6)].close!) / chart.quotes[Math.max(0, indexStart - 6)].close!,
            } as unknown as StockFinancials;

            // Evaluate past signal purely with quantitative scoring
            const valuation = valuateStock(f, 'SIDEWAYS');

            return {
              symbol,
              score: valuation.final_rank_score,
              priceThen,
              priceEnd,
              monthlyQuotes: chart.quotes.slice(indexStart).map(q => q.close || priceThen),
              group: 'Avoid'
            };
          } catch (e) {
            return null;
          }
        })
      );

      const validStocks = eraStocks.filter((s): s is NonNullable<typeof s> => s !== null);
      validStocks.sort((a, b) => b.score - a.score);
      const total = validStocks.length;
      
      validStocks.forEach((v, i) => {
        if (i < 3) v.group = 'Strong Buy';
        else if (i < 6) v.group = 'Buy';
        else if (i < 10) v.group = 'Hold';
        else v.group = 'Avoid';
      });

      const summarizeGroup = (groupName: string) => {
        const gStocks = validStocks.filter(v => v.group === groupName);
        if (gStocks.length === 0) return { group: groupName, count: 0, cagr: 0, hitRatio: 0, maxDrawdown: 0, sharpe: 0 };
        
        let hits = 0;
        let totalReturn = 0;
        let maxDrawdown = 0;
        let volatilityAccum = 0;

        gStocks.forEach(s => {
          const ret = (s.priceEnd - s.priceThen) / s.priceThen;
          totalReturn += ret;
          if (ret > 0) hits++;

          let peak = s.monthlyQuotes[0];
          let dd = 0;
          let variance = 0;
          for (let m = 1; m < s.monthlyQuotes.length; m++) {
            if (s.monthlyQuotes[m] > peak) peak = s.monthlyQuotes[m];
            const drop = (s.monthlyQuotes[m] - peak) / peak;
            if (drop < dd) dd = drop;
            variance += Math.pow((s.monthlyQuotes[m] - s.monthlyQuotes[m-1])/s.monthlyQuotes[m-1], 2);
          }
          if (dd < maxDrawdown) maxDrawdown = dd;
          volatilityAccum += Math.sqrt(variance / s.monthlyQuotes.length) * Math.sqrt(12); // Annualized volatility
        });

        const avgReturn = totalReturn / gStocks.length;
        const avgVolatility = (volatilityAccum / gStocks.length) || 0.15;
        const sharpe = (avgReturn - 0.05) / avgVolatility;

        return {
          group: groupName,
          count: gStocks.length,
          cagr: avgReturn * 100, // 2 year return / 2 technically, but we keep it absolute 2-year for standard view
          hitRatio: (hits / gStocks.length) * 100,
          maxDrawdown: Math.abs(maxDrawdown * 100),
          sharpe: sharpe
        };
      };

      resultsByEra[era.name] = [
        summarizeGroup('Strong Buy'),
        summarizeGroup('Buy'),
        summarizeGroup('Hold'),
        summarizeGroup('Avoid'),
      ];
    }

    return NextResponse.json({
      eras: ERAS.map(e => e.name),
      totalProcessed: sampleStocks.length,
      results: resultsByEra,
    });
  } catch (error) {
    console.error('Backtest Engine Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
