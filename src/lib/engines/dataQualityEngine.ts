import { DataQualityReport, StockFinancials } from '@/types/stock';

type AltPriceResult = {
  available: boolean;
  price: number | null;
};

function safeParseCsvPrice(csv: string): number | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const fields = lines[1].split(',');
  if (fields.length < 5) return null;
  const close = Number(fields[4]);
  return isFinite(close) && close > 0 ? close : null;
}

async function fetchStooqPrice(symbol: string): Promise<AltPriceResult> {
  try {
    // Stooq uses lowercase ticker and country suffixes, e.g. bbca.id
    const normalized = symbol.replace('.JK', '').toLowerCase();
    const url = `https://stooq.com/q/l/?s=${normalized}.id&i=d`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { available: false, price: null };
    const text = await res.text();
    const price = safeParseCsvPrice(text);
    return { available: price !== null, price };
  } catch {
    return { available: false, price: null };
  }
}

export async function buildDataQualityReport(f: StockFinancials): Promise<DataQualityReport> {
  const requiredChecks: Array<number | null> = [
    f.currentPrice,
    f.marketCap,
    f.pe,
    f.historicalTrailingPE,
    f.bookValuePerShare,
    f.netIncome,
    f.revenue,
    f.freeCashFlow,
    f.operatingCashFlow,
    f.debtToEquity,
    f.roe,
    f.eps,
  ];

  const availableCount = requiredChecks.filter((v) => typeof v === 'number' && isFinite(v)).length;
  const completenessScore = Math.round((availableCount / requiredChecks.length) * 100);

  const alt = await fetchStooqPrice(f.symbol);

  let priceConsistencyDiffPct: number | null = null;
  const warnings: string[] = [];

  if (alt.available && alt.price && f.currentPrice > 0) {
    priceConsistencyDiffPct = Math.abs((f.currentPrice - alt.price) / f.currentPrice) * 100;
    if (priceConsistencyDiffPct > 7.5) {
      warnings.push(`Cross-source price mismatch ${priceConsistencyDiffPct.toFixed(1)}%`);
    }
  } else {
    warnings.push('Alternative source unavailable (non-blocking).');
  }

  if (completenessScore < 60) {
    warnings.push('Fundamental fields are sparse, valuation confidence reduced.');
  }

  const confidenceRaw = Math.max(0,
    (completenessScore * 0.7) +
    ((priceConsistencyDiffPct === null ? 60 : Math.max(0, 100 - (priceConsistencyDiffPct * 8))) * 0.3)
  );
  const confidenceScore = Math.round(Math.min(100, confidenceRaw));

  let flag: DataQualityReport['flag'] = 'HIGH_CONFIDENCE';
  if (completenessScore < 60) {
    flag = 'MISSING_DATA';
  } else if ((priceConsistencyDiffPct ?? 0) > 7.5) {
    flag = 'INCONSISTENT_DATA';
  }

  return {
    sourceChecks: {
      yahoo: true,
      alternativeSource: alt.available,
      priceConsistencyDiffPct,
    },
    dataCompletenessScore: completenessScore,
    confidenceScore,
    flag,
    warnings,
  };
}
