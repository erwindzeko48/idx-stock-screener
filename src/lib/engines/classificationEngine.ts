import { StockFinancials } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';

export type StockClass = 'BANK' | 'DIVIDEND' | 'GROWTH' | 'ASSET_HEAVY' | 'CYCLICAL' | 'GENERAL';

/**
 * Determines the core behavior/category of a stock
 */
export function classificationEngine(f: StockFinancials): StockClass {
  if (f.sector === 'Banking' || f.sector.includes('Finance') || f.sector.includes('Bank')) {
    return 'BANK';
  }

  // Growth: high revenue or EPS growth consistently
  const isGrowth = (f.revenueGrowth !== null && f.revenueGrowth > 0.15) || 
                   (f.epsGrowth !== null && f.epsGrowth > 0.15);
  
  // Dividend: high yield and consistent payment history
  const divConsistency = f.dividendHistory.filter(d => (d ?? 0) > 0).length;
  const isDividend = (f.dividendYield ?? 0) > 0.04 && divConsistency >= 3;

  // Asset Heavy: low ROE but trades way below book
  const isAssetHeavy = (f.pb ?? 10) < 1.0 && (f.roe ?? 1) < 0.08;

  // Cyclical: Materials, Energy, Mining, erratic earnings
  const cyclicalSectors = ['Mining', 'Energy', 'Materials', 'Basic Industry'];
  const isCyclical = cyclicalSectors.includes(f.sector);

  if (isGrowth) return 'GROWTH';
  if (isDividend) return 'DIVIDEND';
  if (isAssetHeavy) return 'ASSET_HEAVY';
  if (isCyclical) return 'CYCLICAL';
  
  return 'GENERAL';
}

/**
 * Grabs adaptive weights based on stock class.
 */
export function getAdaptiveWeights(cls: StockClass): { pe: number, graham: number, div: number, dcf: number } {
  return ValuationConfig.TYPE_WEIGHTS[cls] ?? ValuationConfig.TYPE_WEIGHTS.GENERAL;
}
