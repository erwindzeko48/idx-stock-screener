import { ConfidenceBreakdown, MethodContribution, MethodResult, ValuationExplainability, ValuationVal, WaterfallStep } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';

const METHOD_NAMES: MethodContribution['method'][] = ['MEAN_REVERSION', 'GRAHAM', 'DIVIDEND_YIELD', 'DCF'];

function effectiveWeight(method: MethodResult): number {
  if (method.value === null || method.weight <= 0 || method.confidence < ValuationConfig.CONFIDENCE_THRESHOLD) return 0;
  return method.weight * Math.pow(method.confidence, ValuationConfig.CONFIDENCE_DECAY_EXPONENT);
}

function toReason(method: MethodContribution['method'], signal: ValuationVal, rawReasoning: string): string {
  if (signal === 'INSUFFICIENT_DATA') return `${method}: data tidak cukup untuk memberi sinyal yang kredibel.`;

  const baseline = method === 'MEAN_REVERSION'
    ? 'Mean Reversion menilai PE relatif ke sejarah.'
    : method === 'GRAHAM'
      ? 'Graham Number mengecek margin keamanan dari EPS dan BVPS.'
      : method === 'DIVIDEND_YIELD'
        ? 'Dividend model mengecek dukungan yield terhadap harga.'
        : 'DCF memproyeksikan arus kas terdiskonto.';

  const signalText = signal === 'UNDERVALUED'
    ? 'Sinyal undervalued.'
    : signal === 'FAIR_VALUE'
      ? 'Sinyal fair value.'
      : 'Sinyal overvalued.';

  return `${baseline} ${signalText} ${rawReasoning}`.trim();
}

function buildWaterfall(currentPrice: number, methods: MethodResult[]): WaterfallStep[] {
  const steps: WaterfallStep[] = [{ label: 'Current Price', value: currentPrice }];
  methods.forEach((m, idx) => {
    if (m.value !== null) {
      steps.push({
        label: METHOD_NAMES[idx],
        value: m.value,
      });
    }
  });
  return steps;
}

export function buildExplainability(
  currentPrice: number,
  methods: MethodResult[],
  compositeConfidence: number,
): ValuationExplainability {
  const effective = methods.map((m) => effectiveWeight(m));
  const totalEffective = effective.reduce((acc, v) => acc + v, 0);

  const contributions: MethodContribution[] = methods.map((m, idx) => {
    const eff = effective[idx];
    return {
      method: METHOD_NAMES[idx],
      contributionPct: totalEffective > 0 ? (eff / totalEffective) * 100 : 0,
      effectiveWeight: eff,
      intrinsicValue: m.value,
      confidence: m.confidence,
      signal: m.category,
    };
  });

  const validCount = methods.filter((m) => m.value !== null).length;
  const coverage = methods.length > 0 ? validCount / methods.length : 0;

  const confidenceDetail: ConfidenceBreakdown = {
    compositeConfidence,
    modelCoverage: coverage,
    methodConfidence: methods.map((m, idx) => ({
      method: METHOD_NAMES[idx],
      confidence: m.confidence,
      passedThreshold: m.confidence >= ValuationConfig.CONFIDENCE_THRESHOLD,
    })),
  };

  const reasoning = methods.map((m, idx) => toReason(METHOD_NAMES[idx], m.category, m.reasoning));
  const waterfall = buildWaterfall(currentPrice, methods);

  return {
    contributions,
    confidenceDetail,
    reasoning,
    waterfall,
  };
}
