import { RiskProfile, StockFinancials } from '@/types/stock';

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeTo100(value: number, low: number, high: number): number {
  if (high <= low) return 50;
  const clamped = Math.max(low, Math.min(high, value));
  return ((clamped - low) / (high - low)) * 100;
}

function sectorBaseCyclicality(sector: string): number {
  const s = sector.toLowerCase();
  if (s.includes('bank') || s.includes('consumer staples') || s.includes('health')) return 30;
  if (s.includes('telecom') || s.includes('infrastructure') || s.includes('utility')) return 45;
  if (s.includes('industrial') || s.includes('property') || s.includes('technology')) return 60;
  if (s.includes('energy') || s.includes('mining') || s.includes('materials') || s.includes('metal')) return 75;
  return 55;
}

function industryRiskTags(sector: string): string[] {
  const s = sector.toLowerCase();
  const tags: string[] = [];

  if (s.includes('energy') || s.includes('mining') || s.includes('materials') || s.includes('agri')) {
    tags.push('Commodity Exposure');
  }
  if (s.includes('bank') || s.includes('telecom') || s.includes('health') || s.includes('utility')) {
    tags.push('Regulatory Risk');
  }
  if (s.includes('media') || s.includes('retail') || s.includes('technology')) {
    tags.push('Disruption Risk');
  }
  if (s.includes('property')) {
    tags.push('Rate Sensitive Industry');
  }

  return tags;
}

export function buildAdvancedRiskProfile(
  f: StockFinancials,
  piotroskiScore: number | null,
  baseRiskScore01: number,
): RiskProfile {
  const niHistory = f.netIncomeHistory.filter((v): v is number => typeof v === 'number' && isFinite(v));
  const earningsStabilityStdDev = stdDev(niHistory);

  const avgNi = niHistory.length > 0
    ? niHistory.reduce((acc, v) => acc + v, 0) / niHistory.length
    : 0;

  const coeffVar = avgNi !== 0 ? Math.abs(earningsStabilityStdDev / avgNi) : 2;
  const earningsConsistencyScore = 100 - normalizeTo100(coeffVar, 0.1, 1.5);

  const baseCyclicality = sectorBaseCyclicality(f.sector);
  const volatilityCyclicality = normalizeTo100(coeffVar, 0.1, 1.8);
  const cyclicalityScore = Math.round((baseCyclicality * 0.55) + (volatilityCyclicality * 0.45));

  const cyclicalityClass = cyclicalityScore >= 75
    ? 'HIGHLY_CYCLICAL'
    : cyclicalityScore >= 50
      ? 'CYCLICAL'
      : 'DEFENSIVE';

  const tags = industryRiskTags(f.sector);
  const flags: string[] = [];

  const leverage = f.debtToEquity ?? 0;
  if (leverage > 200) flags.push('⚠️ High Risk: Leverage very high');
  if ((piotroskiScore ?? 0) <= 3) flags.push('⚠️ Value Trap Potential: Weak Piotroski');
  if (earningsConsistencyScore < 35) flags.push('⚠️ High Risk: Earnings instability');
  if (cyclicalityClass === 'HIGHLY_CYCLICAL') flags.push('⚠️ High Risk: Highly cyclical earnings');
  if ((f.freeCashFlow ?? 0) <= 0 && (f.netIncome ?? 0) > 0) {
    flags.push('⚠️ Value Trap Potential: Accounting profit not backed by cash flow');
  }

  const riskScore = Math.round(Math.max(0, Math.min(100,
    (baseRiskScore01 * 100 * 0.4) +
    ((100 - earningsConsistencyScore) * 0.25) +
    (cyclicalityScore * 0.2) +
    (Math.min(100, leverage / 3) * 0.15)
  )));

  return {
    riskScore,
    cyclicalityScore,
    cyclicalityClass,
    industryRiskTags: tags,
    earningsStabilityStdDev,
    earningsConsistencyScore: Math.round(Math.max(0, Math.min(100, earningsConsistencyScore))),
    flags,
  };
}
