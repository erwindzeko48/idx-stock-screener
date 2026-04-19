import { StockFinancials, ValuationResult } from '@/types/stock';
import { classificationEngine, getAdaptiveWeights } from './engines/classificationEngine';
import { riskEngine } from './engines/riskEngine';
import { scoringEngine } from './engines/scoringEngine';
import { staticDecisionEngine } from './engines/decisionEngine';
import { MarketRegime } from './engines/marketRegimeEngine';
import { stabilityEngine } from './engines/stabilityEngine';
import { momentumEngine } from './engines/momentumEngine';
import { ValuationConfig } from './valuation-config';
import {
  calculatePiotroski,
  calculateMeanReversion,
  calculateGrahamNumber,
  calculateDividendYieldReversion,
  calculateDCFModel
} from './engines/valuationEngine';

export {
  classificationEngine, getAdaptiveWeights, riskEngine, scoringEngine, staticDecisionEngine,
  calculatePiotroski, calculateMeanReversion, calculateGrahamNumber, calculateDividendYieldReversion, calculateDCFModel, stabilityEngine, momentumEngine
};

export function valuateStock(f: StockFinancials, marketRegime: MarketRegime = 'SIDEWAYS'): ValuationResult {
  // 1. Classification & Weighting
  const stockType = classificationEngine(f);
  const baseWeights = getAdaptiveWeights(stockType);

  // 2. Fundamental Quality
  const piotroski = calculatePiotroski(f);

  // 3. Stability & Momentum
  const stabilityScore = stabilityEngine(f);
  const momentumScore = momentumEngine(f);

  // 4. Risk Engine
  const { riskScore, warnings } = riskEngine(f, piotroski.score);

  // 5. Valuation Models 
  const meanReversion = calculateMeanReversion(f, baseWeights.pe);
  const graham = calculateGrahamNumber(f, baseWeights.graham);
  const dividendYield = calculateDividendYieldReversion(f, baseWeights.div);
  const dcf = calculateDCFModel(f, baseWeights.dcf);

  const methodArray = [meanReversion, graham, dividendYield, dcf];

  // 6. Composite Scoring Engine
  const scoreResult = scoringEngine(f.currentPrice, methodArray, piotroski.score, riskScore, stabilityScore, marketRegime);

  // 7. Factor Exposure Tracking
  const valueEx = f.pe && f.pe > 0 ? Math.max(0, 1 - (f.pe / 30)) : 0.5; // proxy
  const growthEx = f.epsGrowth ? Math.max(0, Math.min(1, f.epsGrowth * 2)) : 0.5;
  const qualityEx = piotroski.score !== null ? piotroski.score / 9 : 0.5;

  // 8. Advanced Final Rank Score
  const rankWeights = ValuationConfig.RANK_SCORE_WEIGHTS;
  const finalRankScore = (rankWeights.VALUATION * scoreResult.finalScore) + (rankWeights.MOMENTUM * momentumScore);

  // 9. Static Decision Engine
  let recommendation = staticDecisionEngine(finalRankScore);

  // Build Explanations & High Level Overrides
  const explanation: string[] = [];
  
  if ((f.totalEquity ?? 0) <= 0) {
    recommendation = 'Avoid';
    warnings.push('NEGATIVE EQUITY (Delisting Risk)');
  }

  if (recommendation !== 'Avoid' && scoreResult.confidenceScore < 0.40) {
    if (recommendation === 'Strong Buy') recommendation = 'Buy';
    else if (recommendation === 'Buy') recommendation = 'Hold';
    explanation.push('Downgraded 1 level due to low composite confidence (<40%).');
  }

  if (recommendation !== 'Strong Buy' && (piotroski.score ?? 0) >= 8 && riskScore < 0.3 && (scoreResult.mos ?? 0) > 0.1) {
    if (recommendation === 'Buy') recommendation = 'Strong Buy';
    else if (recommendation === 'Hold') recommendation = 'Buy';
    explanation.push('Upgraded 1 level due to outstanding fundamentals (Piotroski >= 8, Low Risk).');
  }

  if (scoreResult.finalScore <= 0.5 && riskScore > 0.8) {
    explanation.push('Final Score capped severely due to Risk Escalation Rule (Risk > 0.8).');
  }

  if (marketRegime === 'BULL') {
    explanation.push('Regime: BULL. Boosted MOS Weight.');
  } else if (marketRegime === 'BEAR') {
    explanation.push('Regime: BEAR. Boosted Risk Penalty.');
  }

  const passingMethodsCount = methodArray.filter(m => m.category === 'UNDERVALUED').length;

  return {
    piotroski,
    meanReversion,
    dividendYield,
    graham,
    dcf,
    intrinsic_value: scoreResult.intrinsicValue,
    mos: scoreResult.mos,
    mos_normalized: scoreResult.mosNormalized,
    confidence: scoreResult.confidenceScore,
    quality: scoreResult.qualityScore,
    risk: riskScore,
    final_score: scoreResult.finalScore,
    recommendation,
    type: stockType,
    top_methods: scoreResult.topMethods,
    warnings,
    explanation,
    passingMethodsCount, // Kept for backwards-compat sorting
    
    final_rank_score: finalRankScore,
    momentum_score: momentumScore,
    stability_score: stabilityScore,
    market_regime: marketRegime,
    factor_exposure: {
      value: valueEx,
      growth: growthEx,
      quality: qualityEx,
    }
  };
}
