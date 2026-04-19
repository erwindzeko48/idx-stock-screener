import { StockFinancials } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';

/** Compute coefficient of variation (CV = stdev / mean) to measure volatility */
export function calculateCV(arr: (number | null)[]): number {
  const valid = arr.filter((n): n is number => typeof n === 'number' && !isNaN(n) && isFinite(n));
  if (valid.length < 2) return 1.0; // Assume high volatility if not enough data
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (mean === 0) return 1.0;
  const variance = valid.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / valid.length;
  const stdev = Math.sqrt(variance);
  return Math.abs(stdev / mean);
}

/** Check if array values are generally trending negative */
export function hasNegativeTrend(arr: (number | null)[]): boolean {
  const valid = arr.filter((n): n is number => typeof n === 'number' && !isNaN(n) && isFinite(n));
  if (valid.length < 3) return false;
  // If the 2 most recent are negative, flag it
  return valid[0] < 0 && valid[1] < 0;
}

/**
 * Calculates a standalone risk score and flags dangerous conditions.
 */
export function riskEngine(f: StockFinancials, piotroskiScore: number | null): { riskScore: number, warnings: string[] } {
  let riskAccumulation = 0;
  const warnings: string[] = [];

  // 1. Leverage Risk
  if ((f.debtToEquity ?? 0) > 200) {
    warnings.push('High Leverage (D/E > 2x)');
    riskAccumulation += 0.3;
  }

  // 2. Earnings Instability Risk
  if (calculateCV(f.netIncomeHistory) > 1.5) {
    warnings.push('Earnings highly volatile');
    riskAccumulation += 0.2;
  }

  // 3. Persistent Negative FCF
  if (hasNegativeTrend(f.fcfHistory)) {
    if (f.sector !== 'Banking') {
      warnings.push('Persistent Negative FCF');
      riskAccumulation += 0.3;
    }
  }

  // 4. Dilution Risk
  if (f.sharesOutstanding && f.prevSharesOutstanding) {
    if (f.sharesOutstanding > f.prevSharesOutstanding * 1.05) {
      warnings.push('High Share Dilution (>5%)');
      riskAccumulation += 0.2;
    }
  }
  
  // 5. Earnings Spike Detector (Cyclical Trap)
  const thresh = ValuationConfig.EARNINGS_SPIKE_THRESHOLDS;
  const recentGrowth = f.epsGrowth ?? f.revenueGrowth;
  if (recentGrowth && recentGrowth > thresh.RECENT_GROWTH_MIN) {
     const validH = f.epsHistory.filter((v): v is number => v !== null);
     if (validH.length >= 3) {
       // calculate long term avg growth roughly
       let totalG = 0, count = 0;
       for (let i = 0; i < validH.length - 1; i++) {
         if (validH[i+1] > 0) {
            totalG += (validH[i] - validH[i+1]) / validH[i+1];
            count++;
         }
       }
       const avgGrowth = count > 0 ? totalG / count : 0;
       if (avgGrowth < thresh.LONG_TERM_MAX_AVG) {
         warnings.push('Earnings Spike Trap (>100% recent, <10% avg)');
         riskAccumulation += thresh.RISK_PENALTY;
       }
     }
  }

  // 6. Weak Fundamentals Backup
  if (piotroskiScore !== null && piotroskiScore <= 3) {
    warnings.push('Weak Fundamentals (Piotroski ≤ 3)');
    riskAccumulation += 0.2;
  }

  const finalRisk = Math.min(riskAccumulation, 1.0);
  return { riskScore: finalRisk, warnings };
}
