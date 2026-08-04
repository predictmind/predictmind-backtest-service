/**
 * Walk-forward validation (E13 robustness). The single most honest test of a
 * strategy *system*: does our "pick the best in-sample candidate" process keep
 * working on data it has never seen, across MANY consecutive windows (bull, bear
 * and sideways)?
 *
 * How it works (anchored / expanding walk-forward):
 *   1. Reserve an initial training block (minTrainFraction of the history).
 *   2. Split the remaining history into `folds` consecutive out-of-sample windows.
 *   3. For each window k: train on everything BEFORE it, pick the best candidate
 *      (exactly like the generator does), then measure that pick on window k.
 *   4. Count how often the pick was profitable and how often it beat Buy & Hold.
 *
 * The result is a *success rate across regimes* — e.g. "beat Buy & Hold in 4 of
 * 5 windows (80%)". That is the meaningful, non-cherry-picked number, because we
 * never judge a strategy on data used to choose it, and we test every window in
 * turn instead of a single lucky slice.
 */

import { EngineOptions, runBacktest } from "../engine/backtest-engine";
import { computeMetrics, Metrics } from "../engine/metrics";
import { Candle, Signal } from "../engine/types";
import { buildCandidateSpecs } from "./candidate-space";
import { evaluate } from "./generator";

export interface WalkForwardOptions {
  folds?: number; // number of out-of-sample windows (default 5)
  minTrainFraction?: number; // initial train block before the first window (default 0.5)
  minTrades?: number; // min in-sample trades to trust a candidate (default 5)
  engine?: EngineOptions;
}

export interface FoldResult {
  fold: number;
  trainCandles: number;
  testCandles: number;
  selectedLabel: string | null; // null = nothing qualified, system stays in cash
  testNetProfitPct: number;
  testBuyHoldPct: number;
  testWinRate: number;
  testTrades: number;
  testMaxDrawdownPct: number;
  buyHoldMaxDrawdownPct: number;
  profitable: boolean; // net > 0
  beatsBuyHold: boolean; // net > Buy & Hold on the same window (raw return)
  /**
   * Risk-adjusted success (definition B): the strategy delivered a better
   * return-per-unit-of-pain than Buy & Hold — either a higher Sharpe, or (when it
   * stayed in cash through a crash) simply far less drawdown without losing money.
   * This is the fair metric for long-only spot, which cannot out-return a fully
   * invested Buy & Hold during a parabolic bull run but CAN sidestep its crashes.
   */
  beatsRiskAdjusted: boolean;
}

export interface WalkForwardResult {
  folds: number;
  windowsEvaluated: number;
  profitableWindows: number;
  beatBuyHoldWindows: number;
  beatRiskAdjustedWindows: number;
  profitableRatePct: number;
  beatBuyHoldRatePct: number;
  /** The headline for spot: how often we won on a risk-adjusted basis. */
  beatRiskAdjustedRatePct: number;
  avgOosReturnPct: number;
  avgBuyHoldPct: number;
  results: FoldResult[];
}

function buyHoldPct(candles: Candle[]): number {
  const first = candles[0]?.close ?? 0;
  const last = candles[candles.length - 1]?.close ?? 0;
  return first > 0 ? ((last - first) / first) * 100 : 0;
}

/** Buy & Hold metrics for a window: buy on the first candle, hold to the end. */
function buyHoldMetrics(candles: Candle[], timeframe: string): Metrics {
  const signals: Signal[] = candles.map((_, i) => (i === 0 ? "BUY" : "HOLD"));
  return computeMetrics(runBacktest(candles, signals, {}), candles, timeframe);
}

/**
 * Risk-adjusted verdict for one window. The strategy "wins" if it earns more
 * return per unit of risk than Buy & Hold. We use the Sharpe ratio (return vs
 * volatility); when the strategy sat in cash (no trades, sharpe 0) it still wins
 * if Buy & Hold's Sharpe was negative — i.e. it dodged a losing market.
 */
function beatsRiskAdjusted(strategy: Metrics, bh: Metrics): boolean {
  if (strategy.tradesCount === 0) return bh.sharpe <= 0; // cash beats a losing market
  if (strategy.sharpe !== bh.sharpe) return strategy.sharpe > bh.sharpe;
  // Tie-break on pain: same Sharpe but a smaller drawdown is the better ride.
  return strategy.maxDrawdownPct < bh.maxDrawdownPct;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function round(v: number, dp = 4): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function walkForward(
  candles: Candle[],
  timeframe: string,
  options: WalkForwardOptions = {},
): WalkForwardResult {
  const folds = Math.max(2, Math.min(options.folds ?? 5, 12));
  const minTrainFraction = Math.min(Math.max(options.minTrainFraction ?? 0.5, 0.3), 0.8);
  const minTrades = options.minTrades ?? 5;
  const engine = options.engine ?? {};

  const n = candles.length;
  const start = Math.floor(n * minTrainFraction);
  const testSize = Math.floor((n - start) / folds);
  const candidates = buildCandidateSpecs();

  const results: FoldResult[] = [];

  for (let k = 0; k < folds; k++) {
    const trainEnd = start + k * testSize;
    const testStart = trainEnd;
    const testEnd = k === folds - 1 ? n : trainEnd + testSize;

    const train = candles.slice(0, trainEnd);
    const test = candles.slice(testStart, testEnd);
    if (test.length < 10 || train.length < 60) continue;

    // Pick the best candidate on the TRAIN slice (same rule as the generator:
    // enough trades, then rank by risk-adjusted return). Each candidate uses its
    // own risk preset (engine), merged over the request-level engine.
    const scored = candidates
      .map((c) => ({
        label: c.label,
        spec: c.spec,
        engine: { ...engine, ...c.engine },
        m: evaluate(c.spec, train, timeframe, { ...engine, ...c.engine }),
      }))
      .filter((c) => c.m.tradesCount >= minTrades)
      .sort((a, b) => b.m.sharpe - a.m.sharpe || b.m.netProfitPct - a.m.netProfitPct);

    const bh = buyHoldPct(test);
    const bhm = buyHoldMetrics(test, timeframe);

    if (scored.length === 0) {
      // Nothing qualified — the system would place no trades and sit in cash (0%).
      const cash: Metrics = { ...bhm, netProfitPct: 0, sharpe: 0, maxDrawdownPct: 0, tradesCount: 0 };
      results.push({
        fold: k + 1,
        trainCandles: train.length,
        testCandles: test.length,
        selectedLabel: null,
        testNetProfitPct: 0,
        testBuyHoldPct: round(bh),
        testWinRate: 0,
        testTrades: 0,
        testMaxDrawdownPct: 0,
        buyHoldMaxDrawdownPct: bhm.maxDrawdownPct,
        profitable: false,
        beatsBuyHold: 0 > bh,
        beatsRiskAdjusted: beatsRiskAdjusted(cash, bhm),
      });
      continue;
    }

    const pick = scored[0];
    const t = evaluate(pick.spec, test, timeframe, pick.engine);
    results.push({
      fold: k + 1,
      trainCandles: train.length,
      testCandles: test.length,
      selectedLabel: pick.label,
      testNetProfitPct: t.netProfitPct,
      testBuyHoldPct: t.buyHoldPct,
      testWinRate: t.winRate,
      testTrades: t.tradesCount,
      testMaxDrawdownPct: t.maxDrawdownPct,
      buyHoldMaxDrawdownPct: bhm.maxDrawdownPct,
      profitable: t.netProfitPct > 0,
      beatsBuyHold: t.netProfitPct > t.buyHoldPct,
      beatsRiskAdjusted: beatsRiskAdjusted(t, bhm),
    });
  }

  const windowsEvaluated = results.length;
  const profitableWindows = results.filter((r) => r.profitable).length;
  const beatBuyHoldWindows = results.filter((r) => r.beatsBuyHold).length;
  const beatRiskAdjustedWindows = results.filter((r) => r.beatsRiskAdjusted).length;

  return {
    folds,
    windowsEvaluated,
    profitableWindows,
    beatBuyHoldWindows,
    beatRiskAdjustedWindows,
    profitableRatePct: windowsEvaluated ? round((profitableWindows / windowsEvaluated) * 100, 2) : 0,
    beatBuyHoldRatePct: windowsEvaluated
      ? round((beatBuyHoldWindows / windowsEvaluated) * 100, 2)
      : 0,
    beatRiskAdjustedRatePct: windowsEvaluated
      ? round((beatRiskAdjustedWindows / windowsEvaluated) * 100, 2)
      : 0,
    avgOosReturnPct: round(mean(results.map((r) => r.testNetProfitPct)), 4),
    avgBuyHoldPct: round(mean(results.map((r) => r.testBuyHoldPct)), 4),
    results,
  };
}
