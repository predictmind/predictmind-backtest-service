/**
 * The strategy generator (E10). It searches the candidate space, backtests each
 * on an **in-sample (train)** slice, ranks the best, then reports their
 * **out-of-sample (test)** performance — and flags which ones actually beat
 * Buy & Hold on data they were NOT tuned on. This is the core defence against
 * overfitting (methodology §16.5: success is measured out-of-sample).
 */

import { runBacktest } from "../engine/backtest-engine";
import { computeMetrics, Metrics } from "../engine/metrics";
import { RuleSpec, RuleStrategy } from "../engine/rule-strategy";
import { Candle } from "../engine/types";
import { buildCandidateSpecs } from "./candidate-space";

export interface GeneratorOptions {
  trainFraction?: number; // portion of candles used for the in-sample search
  minTrades?: number; // ignore candidates that barely trade
  topN?: number; // how many finalists to report
}

export interface GeneratedStrategy {
  label: string;
  spec: RuleSpec;
  train: Metrics;
  test: Metrics;
  beatsBuyHoldOutOfSample: boolean;
}

export interface GeneratorResult {
  evaluated: number;
  trainCandles: number;
  testCandles: number;
  strategies: GeneratedStrategy[];
}

function evaluate(spec: RuleSpec, candles: Candle[], timeframe: string): Metrics {
  const signals = new RuleStrategy(spec).generate(candles);
  const run = runBacktest(candles, signals);
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

  const split = Math.floor(candles.length * trainFraction);
  const train = candles.slice(0, split);
  const test = candles.slice(split);

  const candidates = buildCandidateSpecs();

  // 1) Evaluate every candidate in-sample; keep ones that trade enough.
  const scored = candidates
    .map((c) => ({ ...c, train: evaluate(c.spec, train, timeframe) }))
    .filter((c) => c.train.tradesCount >= minTrades);

  // 2) Rank by risk-adjusted return (Sharpe), tie-break on net profit.
  scored.sort(
    (a, b) => b.train.sharpe - a.train.sharpe || b.train.netProfitPct - a.train.netProfitPct,
  );

  // 3) Take the finalists and measure them out-of-sample (the honest test).
  const strategies: GeneratedStrategy[] = scored.slice(0, topN).map((c) => {
    const test = evaluate(c.spec, candles.slice(split), timeframe);
    return {
      label: c.label,
      spec: c.spec,
      train: c.train,
      test,
      beatsBuyHoldOutOfSample:
        test.netProfitPct > test.buyHoldPct && test.netProfitPct > 0,
    };
  });

  return {
    evaluated: candidates.length,
    trainCandles: train.length,
    testCandles: test.length,
    strategies,
  };
}
