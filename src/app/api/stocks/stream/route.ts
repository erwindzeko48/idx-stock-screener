import { IDX_STOCKS } from '@/lib/stocks-list';
import { fetchStockFinancials } from '@/lib/fetcher';
import { valuateStock } from '@/lib/valuation';
import { StockData } from '@/types/stock';
import { detectMarketRegime } from '@/lib/engines/marketRegimeEngine';
import { buildDataQualityReport } from '@/lib/engines/dataQualityEngine';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 3; // Smaller batches = less rate limiting

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function summarizeUpside(values: number[]) {
  if (values.length === 0) {
    return { count: 0, p50: 0, p90: 0, p99: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.50),
    p90: percentile(sorted, 0.90),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
  };
}

async function fetchWithRetry(symbol: string, name: string, sector: string) {
  let financials = await fetchStockFinancials(symbol, name, sector);
  if (financials) return financials;

  await new Promise((r) => setTimeout(r, 250));
  financials = await fetchStockFinancials(symbol, name, sector);
  return financials;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const targetStocks = IDX_STOCKS.slice(startIndex, endIndex);

  const marketRegime = await detectMarketRegime();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      };

      // Send meta information
      send({ type: 'meta', total: IDX_STOCKS.length, returned: targetStocks.length });

      let successCount = 0;
      let failedCount = 0;
      const upsideBuckets: Record<string, number[]> = {
        meanReversion: [],
        graham: [],
        dcf: [],
        dividendYield: [],
        mos: [],
      };
      const qualityBuckets = {
        high: 0,
        missing: 0,
        inconsistent: 0,
      };

      const collectUpside = (key: string, value: number | null) => {
        if (typeof value !== 'number' || !isFinite(value)) return;
        if (value < -1) return;
        if (value > 3) return;
        upsideBuckets[key].push(value);
      };

      // Process in small batches
      for (let i = 0; i < targetStocks.length; i += BATCH_SIZE) {
        const batch = targetStocks.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async ([symbol, name, sector]) => {
            const financials = await fetchWithRetry(symbol, name, sector);
            if (!financials) return null;
            const valuation = valuateStock(financials, marketRegime);
            const dataQuality = await buildDataQualityReport(financials);
            valuation.data_quality = dataQuality;
            if (dataQuality.flag !== 'HIGH_CONFIDENCE') {
              valuation.warnings.push(`Data quality: ${dataQuality.flag}`);
            }
            // No health check needed since Piotroski serves as health check inside valuation
            return { financials, valuation } as StockData;
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            successCount++;
            collectUpside('meanReversion', result.value.valuation.meanReversion.upside);
            collectUpside('graham', result.value.valuation.graham.upside);
            collectUpside('dcf', result.value.valuation.dcf.upside);
            collectUpside('dividendYield', result.value.valuation.dividendYield.upside);
            collectUpside('mos', result.value.valuation.mos);

            const qualityFlag = result.value.valuation.data_quality?.flag;
            if (qualityFlag === 'HIGH_CONFIDENCE') qualityBuckets.high += 1;
            if (qualityFlag === 'MISSING_DATA') qualityBuckets.missing += 1;
            if (qualityFlag === 'INCONSISTENT_DATA') qualityBuckets.inconsistent += 1;

            send({ type: 'stock', data: result.value });
          } else {
            failedCount++;
          }
        }

        // Polite delay between batches
        if (i + BATCH_SIZE < targetStocks.length) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      send({
        type: 'stats',
        data: {
          processed: targetStocks.length,
          success: successCount,
          failed: failedCount,
          successRate: targetStocks.length > 0 ? successCount / targetStocks.length : 0,
          upside: {
            meanReversion: summarizeUpside(upsideBuckets.meanReversion),
            graham: summarizeUpside(upsideBuckets.graham),
            dcf: summarizeUpside(upsideBuckets.dcf),
            dividendYield: summarizeUpside(upsideBuckets.dividendYield),
            mos: summarizeUpside(upsideBuckets.mos),
          },
          dataQuality: qualityBuckets,
        },
      });

      send({ type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache, no-store',
    },
  });
}
