import YahooFinance from 'yahoo-finance2';

export type MarketRegime = 'BULL' | 'BEAR' | 'SIDEWAYS';

let cachedRegime: { regime: MarketRegime; timestamp: number } | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });

export async function detectMarketRegime(targetDateStr?: string): Promise<MarketRegime> {
  // Use cache if real-time (no target date)
  if (!targetDateStr && cachedRegime && Date.now() - cachedRegime.timestamp < CACHE_DURATION_MS) {
    return cachedRegime.regime;
  }

  try {
    const period1 = new Date();
    if (targetDateStr) {
      period1.setTime(new Date(targetDateStr).getTime());
    }
    // Go back approximately 250 trading days (1 year)
    period1.setDate(period1.getDate() - 365);
    
    // Fetch ^JKSE index (Jakarta Composite Index)
    const result = await yf.chart('^JKSE', {
      period1: period1.toISOString().slice(0, 10),
      period2: targetDateStr ? new Date(targetDateStr).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      interval: '1d',
    });

    const quotes = result.quotes.filter((q) => q.close !== null);
    if (quotes.length < 50) return 'SIDEWAYS'; // Not enough data, default safe

    const closes = quotes.map((q) => q.close as number);
    const latest = closes[closes.length - 1];
    
    // Simple 50-day average
    const ma50 = closes.slice(-50).reduce((sum, val) => sum + val, 0) / 50;
    
    // 200-day average if available, else use whatever max we have
    const maLimit = Math.min(closes.length, 200);
    const ma200 = closes.slice(-maLimit).reduce((sum, val) => sum + val, 0) / maLimit;

    let regime: MarketRegime = 'SIDEWAYS';

    // Trend Logic
    if (latest > ma50 && ma50 > ma200) {
      regime = 'BULL';
    } else if (latest < ma50 && ma50 < ma200) {
      regime = 'BEAR';
    } else {
      regime = 'SIDEWAYS';
    }

    if (!targetDateStr) {
      cachedRegime = { regime, timestamp: Date.now() };
    }

    return regime;
  } catch (err) {
    console.error('Failed to detect market regime:', err);
    return 'SIDEWAYS'; // Default fallback
  }
}
