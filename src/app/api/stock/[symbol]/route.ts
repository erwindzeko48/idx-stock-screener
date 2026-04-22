import { NextResponse } from 'next/server';
import { fetchStockFinancials, fetchPriceHistory } from '@/lib/fetcher';
import { valuateStock } from '@/lib/valuation';
import { IDX_STOCKS } from '@/lib/stocks-list';
import { buildDataQualityReport } from '@/lib/engines/dataQualityEngine';

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);

  const stockMeta = IDX_STOCKS.find(
    (s) => s[0].toLowerCase() === decodedSymbol.toLowerCase()
  );
  const name = stockMeta?.[1] ?? decodedSymbol.replace('.JK', '');
  const sector = stockMeta?.[2] ?? 'Unknown';

  const [financials, priceHistory] = await Promise.all([
    fetchStockFinancials(decodedSymbol, name, sector),
    fetchPriceHistory(decodedSymbol, '1y'),
  ]);

  if (!financials) {
    return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
  }

  const valuation = valuateStock(financials);
  const dataQuality = await buildDataQualityReport(financials);

  valuation.data_quality = dataQuality;
  if (dataQuality.flag !== 'HIGH_CONFIDENCE') {
    valuation.warnings.push(`Data quality: ${dataQuality.flag}`);
  }

  return NextResponse.json(
    { financials, valuation, priceHistory },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    }
  );
}
