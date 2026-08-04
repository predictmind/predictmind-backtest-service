/**
 * The strategy generator (E10). It searches the candidate space, backtests each
 * on an **in-sample (train)** slice, ranks the best, then reports their
 * **out-of-sample (test)** performance — and flags which ones actually beat
 * Buy & Hold on data they were NOT tuned on. This is the core defence against
 * overfitting (methodology §16.5: success is measured out-of-sample).
 */

import { EngineOptions, runBacktest } from "../engine/backtest-engine";
import { computeMetrics, Metrics } from "../engine/metrics";
import { predictScore, PredictScoreResult } from "../engine/predict-score";
import { RuleSpec, RuleStrategy } from "../engine/rule-strategy";
import { Candle } from "../engine/types";
import { buildCandidateSpecs } from "./candidate-space";

export interface GeneratorOptions {
  trainFraction?: number; // portion of candles used for the in-sample search
  minTrades?: number; // ignore candidates that barely trade
  topN?: number; // how many finalists to report
  engine?: EngineOptions; // risk controls applied to every candidate
}

export interface GeneratedStrategy {
  label: string;
  spec: RuleSpec;
  train: Metrics;
  test: Metrics;
  beatsBuyHoldOutOfSample: boolean;
  /** PredictScore computed on the out-of-sample (test) metrics (E11). */
  predictScore: PredictScoreResult;
}

export interface GeneratorResult {
  evaluated: number;
  trainCandles: number;
  testCandles: number;
  strategies: GeneratedStrategy[];
}

export function evaluate(
  spec: RuleSpec,
  candles: Candle[],
  timeframe: string,
  engine: EngineOptions,
): Metrics {
  const signals = new RuleStrategy(spec).generate(candles);
  const run = runBacktest(candles, signals, engine);
  return computeMetrics(run, candles, timeframe);
}

export function generateAndRank(
  candles: Candle[],
  timeframe: string,
  options: GeneratorOptions = {},
): GeneratorResult {
  const trainFraction = options.trainFraction ?? 0.7;
  const minTrades = options.minTrades ?? 5;
  const topN = options.topN ?? 5;
  const engine = options.engine ?? {};

  const split = Math.floor(candles.length * trainFraction);
  const train = candles.slice(0, split);
  const test = candles.slice(split);

  const candidates = buildCandidateSpecs();

  // 1) Evaluate every candidate in-sample; keep ones that trade enough.
  //    Each candidate carries its own risk preset (engine); merge it over the
  //    request-level engine so a candidate's stop-loss/take-profit is honoured.
  const scored = candidates
    .map((c) => ({ ...c, train: evaluate(c.spec, train, timeframe, { ...engine, ...c.engine }) }))
    .filter((c) => c.train.tradesCount >= minTrades);

  // 2) Rank by risk-adjusted return (Sharpe), tie-break on net profit.
  scored.sort(
    (a, b) => b.train.sharpe - a.train.sharpe || b.train.netProfitPct - a.train.netProfitPct,
  );

  // 3) Take the finalists, measure them out-of-sample, and PredictScore them.
  const strategies: GeneratedStrategy[] = scored.slice(0, topN).map((c) => {
    const testMetrics = evaluate(c.spec, candles.slice(split), timeframe, { ...engine, ...c.engine });
    return {
      label: c.label,
      spec: c.spec,
      train: c.train,
      test: testMetrics,
      beatsBuyHoldOutOfSample:
        testMetrics.netProfitPct > testMetrics.buyHoldPct && testMetrics.netProfitPct > 0,
      // Score on the honest out-of-sample metrics; confidence uses the in/out gap.
      predictScore: predictScore(testMetrics, {
        oosGap: c.train.netProfitPct - testMetrics.netProfitPct,
      }),
    };
  });

  // 4) Final ranking is by PredictScore (out-of-sample quality), best first.
  strategies.sort((a, b) => b.predictScore.score - a.predictScore.score);

  return {
    evaluated: candidates.length,
    trainCandles: train.length,
    testCandles: test.length,
    strategies,
  };
}
