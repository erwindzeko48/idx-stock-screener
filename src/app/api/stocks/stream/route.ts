import { IDX_STOCKS } from '@/lib/stocks-list';
import { fetchStockFinancials } from '@/lib/fetcher';
import { valuateStock } from '@/lib/valuation';
import { StockData } from '@/types/stock';
import { detectMarketRegime } from '@/lib/engines/marketRegimeEngine';

export const dynamic = 'force-dynamic';

const BATCH_SIZE = 3; // Smaller batches = less rate limiting

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

      // Process in small batches
      for (let i = 0; i < targetStocks.length; i += BATCH_SIZE) {
        const batch = targetStocks.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.allSettled(
          batch.map(async ([symbol, name, sector]) => {
            const financials = await fetchWithRetry(symbol, name, sector);
            if (!financials) return null;
            const valuation = valuateStock(financials, marketRegime);
            // No health check needed since Piotroski serves as health check inside valuation
            return { financials, valuation } as StockData;
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            send({ type: 'stock', data: result.value });
          }
        }

        // Polite delay between batches
        if (i + BATCH_SIZE < targetStocks.length) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

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
