import { StockData } from '@/types/stock';

export type Recommendation = 'Strong Buy' | 'Buy' | 'Hold' | 'Avoid';

export function staticDecisionEngine(finalScore: number): Recommendation {
  if (finalScore >= 0.75) return 'Strong Buy';
  if (finalScore >= 0.60) return 'Buy';
  if (finalScore >= 0.40) return 'Hold';
  return 'Avoid';
}

/**
 * Apply Dynamic Percentile Thresholds
 * 
 * Ranks all stocks by FinalScore:
 * Top 15% -> Strong Buy (if >= 0.60)
 * Next 20% -> Buy (if >= 0.50)
 * Middle 40% -> Hold
 * Bottom 25% -> Avoid
 */
export function applyDynamicThresholds(stocks: StockData[]): void {
  // Sort descending by final_score
  stocks.sort((a, b) => b.valuation.final_score - a.valuation.final_score);
  
  const total = stocks.length;
  if (total === 0) return;

  const cut15 = Math.floor(total * 0.15);
  const cut35 = Math.floor(total * 0.35); // 15% + 20%
  const cut75 = Math.floor(total * 0.75); // 35% + 40%

  for (let i = 0; i < total; i++) {
    const v = stocks[i].valuation;
    const s = v.final_score;

    if (i < cut15 && s >= 0.60) {
      v.recommendation = 'Strong Buy';
    } else if (i < cut35 && s >= 0.50) {
      v.recommendation = 'Buy';
    } else if (i < cut75 && s >= 0.30) {
      v.recommendation = 'Hold';
    } else {
      v.recommendation = 'Avoid';
    }
  }
}
