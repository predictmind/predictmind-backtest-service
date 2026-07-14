/**
 * PredictScore (E11 S11.1): a single 0-100 quality score for a strategy, plus a
 * letter grade and a confidence measure (S11.2). It turns the raw backtest
 * metrics into one comparable number so strategies can be ranked.
 *
 * Weights follow docs/07-ai-strategy-engine §9 — five data factors (90%) plus an
 * OPTIONAL sentiment-alignment factor (10%). When sentiment isn't supplied the
 * other weights are renormalised, so a strategy is always scored on its data
 * merit first (data-first principle).
 *
 * Pure functions only — score depends solely on the metrics passed in.
 */

import { Metrics } from "./metrics";

export type Grade = "A+" | "A" | "B" | "C" | "D";

export interface PredictScoreResult {
  score: number; // 0-100
  grade: Grade;
  confidence: number; // 0-100, how much to trust the score
  factors: {
    profitability: number;
    winRate: number;
    drawdown: number;
    consistency: number;
    marketFit: number;
    sentiment?: number;
  };
}

const clamp = (x: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, x));
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Map a raw metric onto a 0-100 sub-score. */
function subScores(m: Metrics): Omit<PredictScoreResult["factors"], "sentiment"> {
  return {
    // +33% net -> 100, -33% -> 0, flat -> 50.
    profitability: clamp(50 + m.netProfitPct * 1.5),
    // Win rate is already 0-100.
    winRate: clamp(m.winRate),
    // 0% drawdown -> 100, 50%+ -> 0 (smaller pain scores higher).
    drawdown: clamp(100 - m.maxDrawdownPct * 2),
    // Sharpe 2 -> 100, -2 -> 0 (risk-adjusted consistency).
    consistency: clamp(50 + m.sharpe * 25),
    // Beating Buy & Hold by 25% -> 100; matching it -> 50.
    marketFit: clamp(50 + (m.netProfitPct - m.buyHoldPct) * 2),
  };
}

function toGrade(score: number): Grade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

/**
 * Confidence (S11.2): how much to trust the score. More trades and a smaller
 * in/out-of-sample gap => higher confidence. `oosGap` is the drop from in-sample
 * to out-of-sample net profit (large gap = overfit = less trustworthy).
 */
function confidenceScore(m: Metrics, oosGap?: number): number {
  const trades = clamp(m.tradesCount * 6, 0, 60); // up to 60 pts from sample size
  const gapPenalty = oosGap != null ? clamp(Math.abs(oosGap) * 1.5, 0, 40) : 0;
  const base = oosGap != null ? 40 : 30; // a bit less certain if we can't check OOS gap
  return round1(clamp(base + trades - gapPenalty));
}

export interface PredictScoreOptions {
  /** Optional sentiment-alignment sub-score (0-100). Omit to score data-only. */
  sentiment?: number;
  /** In-sample minus out-of-sample net profit %, for the confidence measure. */
  oosGap?: number;
}

export function predictScore(m: Metrics, options: PredictScoreOptions = {}): PredictScoreResult {
  const subs = subScores(m);

  const weights: Record<string, number> = {
    profitability: 0.3,
    winRate: 0.15,
    drawdown: 0.2,
    consistency: 0.15,
    marketFit: 0.1,
    sentiment: 0.1,
  };

  const factors: PredictScoreResult["factors"] = { ...subs };
  if (options.sentiment != null) {
    factors.sentiment = clamp(options.sentiment);
  } else {
    // Drop sentiment and renormalise the remaining weights to sum to 1.
    delete weights.sentiment;
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(weights)) weights[key] /= total;
  }

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    score += (factors as Record<string, number>)[key] * weight;
  }

  return {
    score: round1(clamp(score)),
    grade: toGrade(score),
    confidence: confidenceScore(m, options.oosGap),
    factors: {
      profitability: round1(subs.profitability),
      winRate: round1(subs.winRate),
      drawdown: round1(subs.drawdown),
      consistency: round1(subs.consistency),
      marketFit: round1(subs.marketFit),
      ...(factors.sentiment != null ? { sentiment: round1(factors.sentiment) } : {}),
    },
  };
}
