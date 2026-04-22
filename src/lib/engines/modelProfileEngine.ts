import { StockFinancials } from '@/types/stock';

export type ModelProfile = 'MINIMAL' | 'BALANCED' | 'FULL';

export type MethodWeightSet = {
  pe: number;
  graham: number;
  div: number;
  dcf: number;
};

export type SignalCategory = 'INTRINSIC_VALUE' | 'RELATIVE_VALUATION' | 'INCOME_SIGNAL' | 'QUALITY_SIGNAL';

export const SIGNAL_DECOMPOSITION_MAP: Record<string, SignalCategory> = {
  DCF: 'INTRINSIC_VALUE',
  GRAHAM: 'INTRINSIC_VALUE',
  MEAN_REVERSION_PE: 'RELATIVE_VALUATION',
  DIVIDEND_YIELD: 'INCOME_SIGNAL',
  PIOTROSKI_F_SCORE: 'QUALITY_SIGNAL',
};

export const MODEL_BLUEPRINTS = {
  MINIMAL: {
    title: 'Minimal Model (2-3 komponen)',
    components: ['Core valuation (dynamic: DCF/PE/Yield)', 'Piotroski quality filter', 'Optional supporting signal'],
    scoringLogic: '70% core valuation, 30% quality/risk gate.',
  },
  BALANCED: {
    title: 'Balanced Model (3-4 komponen)',
    components: ['DCF', 'Mean Reversion PE', 'Piotroski quality', 'Optional Graham/Dividend'],
    scoringLogic: 'Diversified valuation signals with dynamic sector tilt and anti-redundancy weights.',
  },
  FULL: {
    title: 'Full Model (5 metode)',
    components: ['DCF', 'Graham', 'Mean Reversion', 'Dividend Yield', 'Piotroski'],
    scoringLogic: 'Semua sinyal aktif sebagai baseline pembanding.',
  },
} as const;

export const DYNAMIC_MODEL_SELECTION_RULES = [
  {
    condition: 'Perusahaan stabil (FCF positif, earnings stabil)',
    activeModel: 'DCF-led',
    activeSignals: ['DCF', 'Piotroski', 'Mean Reversion (light)'],
  },
  {
    condition: 'Perusahaan cyclical (earnings volatility tinggi / sektor komoditas)',
    activeModel: 'Relative-led',
    activeSignals: ['Mean Reversion', 'Piotroski', 'DCF (light)'],
  },
  {
    condition: 'Dividend stock (yield konsisten)',
    activeModel: 'Income-led',
    activeSignals: ['Dividend Yield', 'DCF', 'Piotroski'],
  },
  {
    condition: 'Financial/Banking',
    activeModel: 'PE+Yield blend',
    activeSignals: ['Mean Reversion', 'Dividend Yield', 'Piotroski'],
  },
] as const;

function normalizeWeights(weights: MethodWeightSet): MethodWeightSet {
  const total = weights.pe + weights.graham + weights.div + weights.dcf;
  if (total <= 0) return { pe: 0.35, graham: 0.1, div: 0.1, dcf: 0.45 };

  return {
    pe: weights.pe / total,
    graham: weights.graham / total,
    div: weights.div / total,
    dcf: weights.dcf / total,
  };
}

function calculateCV(values: (number | null)[]): number {
  const valid = values.filter((v): v is number => typeof v === 'number' && isFinite(v));
  if (valid.length < 3) return 1;
  const mean = valid.reduce((acc, v) => acc + v, 0) / valid.length;
  if (mean === 0) return 1;
  const variance = valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / valid.length;
  return Math.abs(Math.sqrt(variance) / mean);
}

function isCyclicalStock(f: StockFinancials): boolean {
  const s = f.sector.toLowerCase();
  const cyclicalSector = s.includes('mining') || s.includes('energy') || s.includes('materials') || s.includes('metal') || s.includes('property');
  const earningsVolatile = calculateCV(f.netIncomeHistory) > 1.1;
  return cyclicalSector || earningsVolatile;
}

function isDividendStock(f: StockFinancials): boolean {
  const divConsistency = f.dividendHistory.filter((d) => (d ?? 0) > 0).length;
  return (f.dividendYield ?? 0) >= 0.03 && divConsistency >= 3;
}

function isStableCashGenerator(f: StockFinancials): boolean {
  return (f.freeCashFlow ?? 0) > 0 && calculateCV(f.netIncomeHistory) < 0.7;
}

function isFinancialStock(f: StockFinancials): boolean {
  const s = f.sector.toLowerCase();
  return s.includes('bank') || s.includes('financial') || s.includes('finance');
}

function identifyArchetype(f: StockFinancials): 'STABLE' | 'CYCLICAL' | 'DIVIDEND' | 'FINANCIAL' | 'GENERAL' {
  if (isFinancialStock(f)) return 'FINANCIAL';
  if (isDividendStock(f)) return 'DIVIDEND';
  if (isCyclicalStock(f)) return 'CYCLICAL';
  if (isStableCashGenerator(f)) return 'STABLE';
  return 'GENERAL';
}

export function applyModelProfileSelection(
  f: StockFinancials,
  baseWeights: MethodWeightSet,
  profile: ModelProfile,
  overrideWeights?: Partial<MethodWeightSet>,
): { weights: MethodWeightSet; notes: string[]; activeSignals: string[]; archetype: string } {
  const notes: string[] = [];
  const archetype = identifyArchetype(f);

  let weights: MethodWeightSet;

  if (profile === 'FULL') {
    weights = { ...baseWeights };
    notes.push('Full profile: semua sinyal valuasi aktif.');
  } else if (profile === 'MINIMAL') {
    weights = { pe: 0, graham: 0, div: 0, dcf: 1 };
    notes.push('Minimal profile: satu core valuation + quality gate.');

    if (archetype === 'CYCLICAL') {
      weights = { pe: 0.85, graham: 0, div: 0, dcf: 0.15 };
      notes.push('Rule: cyclical stock -> PE Mean Reversion jadi sinyal utama.');
    } else if (archetype === 'DIVIDEND') {
      weights = { pe: 0, graham: 0, div: 0.6, dcf: 0.4 };
      notes.push('Rule: dividend stock -> Dividend Yield jadi sinyal utama.');
    } else if (archetype === 'FINANCIAL') {
      weights = { pe: 0.7, graham: 0, div: 0.3, dcf: 0 };
      notes.push('Rule: financial stock -> DCF tidak dijadikan core signal.');
    }
  } else {
    weights = {
      pe: (baseWeights.pe + 0.35) / 2,
      graham: (baseWeights.graham + 0.1) / 2,
      div: (baseWeights.div + 0.1) / 2,
      dcf: (baseWeights.dcf + 0.45) / 2,
    };
    notes.push('Balanced profile: kombinasi 3-4 sinyal dengan anti-redundancy tilt.');

    if (archetype === 'CYCLICAL') {
      weights.pe += 0.2;
      weights.dcf -= 0.15;
      weights.graham -= 0.05;
      notes.push('Rule: cyclical stock -> bobot PE diperbesar, DCF diperkecil.');
    } else if (archetype === 'DIVIDEND') {
      weights.div += 0.15;
      weights.dcf -= 0.1;
      weights.pe -= 0.05;
      notes.push('Rule: dividend stock -> bobot yield diperbesar.');
    } else if (archetype === 'FINANCIAL') {
      weights.pe += 0.15;
      weights.div += 0.1;
      weights.dcf = Math.max(0, weights.dcf - 0.25);
      notes.push('Rule: financial stock -> PE + yield lebih dominan dari DCF.');
    } else if (archetype === 'STABLE') {
      weights.dcf += 0.1;
      notes.push('Rule: stable cash generator -> DCF diperkuat.');
    }

    if ((f.freeCashFlow ?? 0) <= 0) {
      weights.dcf = Math.max(0, weights.dcf - 0.1);
      weights.pe += 0.05;
      notes.push('Rule: FCF non-positive -> DCF diturunkan.');
    }
  }

  if (overrideWeights) {
    weights = {
      pe: overrideWeights.pe ?? weights.pe,
      graham: overrideWeights.graham ?? weights.graham,
      div: overrideWeights.div ?? weights.div,
      dcf: overrideWeights.dcf ?? weights.dcf,
    };
    notes.push('Applied custom override weights for optimization run.');
  }

  const normalized = normalizeWeights(weights);
  const activeSignals = [
    normalized.dcf > 0.05 ? 'DCF' : null,
    normalized.pe > 0.05 ? 'Mean Reversion PE' : null,
    normalized.div > 0.05 ? 'Dividend Yield' : null,
    normalized.graham > 0.05 ? 'Graham Number' : null,
    'Piotroski Quality Filter',
  ].filter((v): v is string => !!v);

  return {
    weights: normalized,
    notes,
    activeSignals,
    archetype,
  };
}
