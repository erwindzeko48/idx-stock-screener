import { MethodResult } from '@/types/stock';
import { ValuationConfig } from '../valuation-config';
import { MarketRegime } from './marketRegimeEngine';

export function normalizeMOS(mos: number): number {
  if (mos <= 0) return 0;
  if (mos <= 0.2) return mos * 2;
  if (mos <= 0.5) return 0.4 + (mos - 0.2) * 1.333;
  if (mos <= 1) return 0.8 + (mos - 0.5) * 0.4;
  return 1;
}

export function scoringEngine(
  price: number,
  methods: MethodResult[],
  piotroskiScore: number | null,
  riskScore: number,
  stabilityScore: number,
  marketRegime: MarketRegime,
): {
  intrinsicValue: number | null;
  mos: number | null;
  mosNormalized: number;
  confidenceScore: number;
  qualityScore: number;
  finalScore: number;
  topMethods: string[];
} {
  let totalValueValue = 0;
  let totalWeight = 0;
  let totalWeightedConfidence = 0;
  let validMethods = 0;
  const methodValues: { name: string; value: number; weight: number }[] = [];

  const names = ['Mean Reversion', 'Graham Number', 'Dividend Yield', 'DCF Model'];

  const validMethodItems: { index: number; value: number; weight: number; confidence: number }[] = [];
  
  methods.forEach((m, idx) => {
    // Soft confidence weighting
    // Hard cutoff if confidence < configured threshold
    if (m.value !== null && m.confidence >= ValuationConfig.CONFIDENCE_THRESHOLD && m.weight > 0) {
      validMethodItems.push({ index: idx, value: m.value, weight: m.weight, confidence: m.confidence });
    }
  });

  if (validMethodItems.length === 0) {
    return {
      intrinsicValue: null,
      mos: null,
      mosNormalized: 0,
      confidenceScore: 0,
      qualityScore: piotroskiScore ? piotroskiScore / 9 : 0.5,
      finalScore: 0,
      topMethods: []
    };
  }

  // Calculate Median Value for Outlier Control
  const sortedValues = [...validMethodItems].map(v => v.value).sort((a, b) => a - b);
  const mid = Math.floor(sortedValues.length / 2);
  const medianValue = sortedValues.length % 2 !== 0 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  const outlierCap = medianValue * 3;

  validMethodItems.forEach((m) => {
    // Outlier Control Cap
    const cappedValue = Math.min(m.value, outlierCap, price * 4);

    // effective_weight = base_weight * (confidence ^ 1.5)
    const confidenceMultiplier = Math.pow(m.confidence, ValuationConfig.CONFIDENCE_DECAY_EXPONENT);
    const effectiveWeight = m.weight * confidenceMultiplier;
    
    totalValueValue += cappedValue * effectiveWeight;
    totalWeight += effectiveWeight;
    totalWeightedConfidence += m.confidence * effectiveWeight;
    validMethods++;
    methodValues.push({ name: names[m.index], value: cappedValue, weight: m.weight });
  });

  if (totalWeight === 0) {
    return {
      intrinsicValue: null,
      mos: null,
      mosNormalized: 0,
      confidenceScore: 0,
      qualityScore: piotroskiScore ? piotroskiScore / 9 : 0.5,
      finalScore: 0,
      topMethods: []
    };
  }

  const intrinsicValue = totalValueValue / totalWeight;
  const confidenceScore = totalWeight > 0 ? (totalWeightedConfidence / totalWeight) : 0;
  const mos = intrinsicValue > 0 ? (intrinsicValue - price) / intrinsicValue : null;
  const mosNormalized = mos ? normalizeMOS(mos) : 0;
  const qualityScore = piotroskiScore !== null ? piotroskiScore / 9 : 0.5;

  // Identify top generating methods
  methodValues.sort((a, b) => b.weight - a.weight);
  const topMethods = methodValues.slice(0, 2).map(m => m.name);

  // Final Formula with Regime Adjusted Weights
  const weights = ValuationConfig.REGIME_WEIGHT_ADJUSTMENTS[marketRegime] || ValuationConfig.SCORE_WEIGHTS;

  let finalScore = 
    (weights.MOS * mosNormalized) +
    (weights.CONFIDENCE * confidenceScore) +
    (weights.QUALITY * qualityScore) -
    (weights.RISK_PENALTY * riskScore) +
    (ValuationConfig.STABILITY_SCORE_BONUS * stabilityScore);

  finalScore = Math.max(0, Math.min(1, finalScore)); // Clamp 0-1

  // Risk Escalation Rule
  if (riskScore > 0.8) {
    finalScore = Math.min(finalScore, 0.5);
  }

  return {
    intrinsicValue,
    mos,
    mosNormalized,
    confidenceScore,
    qualityScore,
    finalScore,
    topMethods
  };
}
