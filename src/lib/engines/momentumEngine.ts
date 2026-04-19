import { StockFinancials } from '@/types/stock';

/**
 * Momentum Engine calculates a score 0-1 based on 6-month and 12-month returns.
 */
export function momentumEngine(f: StockFinancials): number {
  const return12m = f.return12m;
  const return6m = f.return6m; // Derived from Price vs 200DMA

  // If no momentum data is available, return neutral 0.5
  if (return12m === null && return6m === null) return 0.5;

  const mapReturnToScore = (ret: number) => {
    if (ret >= 0.5) return 1.0;
    if (ret >= 0.15) return 0.75;
    if (ret >= 0) return 0.5 + (ret / 0.15) * 0.25;
    if (ret >= -0.2) return 0.5 - (Math.abs(ret) / 0.2) * 0.25;
    if (ret >= -0.4) return 0.25 - ((Math.abs(ret) - 0.2) / 0.2) * 0.25;
    return 0.0;
  };

  const score12m = return12m !== null ? mapReturnToScore(return12m) : null;
  const score6m = return6m !== null ? mapReturnToScore(return6m) : null;

  if (score12m !== null && score6m !== null) {
    // Weight recent momentum slightly higher
    return (score6m * 0.6) + (score12m * 0.4);
  }

  // Fallbacks
  if (score12m !== null) return score12m;
  if (score6m !== null) return score6m;

  return 0.5;
}
