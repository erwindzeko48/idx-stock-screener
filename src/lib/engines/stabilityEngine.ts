import { StockFinancials } from '@/types/stock';

/**
 * Calculates a stability score from 0 to 1 based on earnings and free cash flow consistency.
 * 1 = Highly stable (consistent positive returns)
 * 0 = Highly volatile (erratic jumps or losses)
 */
export function stabilityEngine(financials: StockFinancials): number {
  let score = 0.5; // Base average stability

  const { netIncomeHistory, fcfHistory, revenueHistory } = financials;

  // Filter out nulls
  const validNI = netIncomeHistory.filter((v): v is number => v !== null);
  const validFCF = fcfHistory.filter((v): v is number => v !== null);
  const validRev = revenueHistory.filter((v): v is number => v !== null);

  const calculateCV = (arr: number[]) => {
    if (arr.length < 3) return null;
    const mean = arr.reduce((sum, v) => sum + v, 0) / arr.length;
    if (mean <= 0) return 1; // High penalty for negative average
    const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / mean; // Coefficient of Variation
  };

  const niCV = calculateCV(validNI);
  const fcfCV = calculateCV(validFCF);
  const revCV = calculateCV(validRev);

  // Evaluate Net Income Stability
  if (niCV !== null) {
    if (niCV < 0.2) score += 0.15;
    else if (niCV < 0.5) score += 0.05;
    else if (niCV > 1) score -= 0.15;
  }

  // Evaluate FCF Stability
  if (fcfCV !== null) {
    if (fcfCV < 0.3) score += 0.15;
    else if (fcfCV < 0.6) score += 0.05;
    else if (fcfCV > 1) score -= 0.15;
  }

  // Evaluate Revenue Stability
  if (revCV !== null) {
    if (revCV < 0.1) score += 0.1;
    else if (revCV < 0.3) score += 0.05;
    else if (revCV > 0.5) score -= 0.1;
  }

  // Cap between 0 and 1
  return Math.max(0, Math.min(1, score));
}
