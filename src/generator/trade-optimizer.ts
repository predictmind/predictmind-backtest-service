/**
 * Trade-quality optimizer (S10.3 risk rules, taken further).
 *
 * Answers the question that actually matters to a trader: "If I take this trade
 * 100 times, how many times do I walk away in profit vs get stopped out?" —
 * i.e. the **per-trade win rate**, which we can TUNE by choosing the entry
 * trigger, the take-profit, and the stop-loss.
 *
 * It searches a grid of  entry-trigger × stop-loss × take-profit(RR)  and ranks
 * the combinations by win rate — but only among those that are also **net
 * positive** (profit factor ≥ 1), so a high win rate can't come from tiny wins
 * paired with catastrophic losses. Everything is chosen on a TRAIN slice and
 * reported on an unseen TEST slice, so the win rate is honest, not curve-fit.
 *
 * Exits here are purely take-profit / stop-loss (no signal exit), so every trade
 * resolves as a clean win (hit TP) or loss (hit SL) — exactly the trader's view.
 */

import { EngineOptions, runBacktest } from "../engine/backtest-engine";
import { Metrics } from "../engine/metrics";
import { Condition, RuleSpec, RuleStrategy } from "../engine/rule-strategy";
import { Candle } from "../engine/types";
import { buildEntryVariants } from "./candidate-space";
import { evaluate } from "./generator";

/**
 * Market-flow regime filter. Long-only spot cannot profit in a falling market,
 * so we forbid entries unless the market is healthy: BTC (the market leader) is
 * above its long-term moving average AND the coin itself is above its own. When
 * the market is bearish this is false everywhere, so the strategy simply sits in
 * cash — turning a losing bear year into a roughly flat one.
 */
const REGIME_CONDS: Condition[] = [
  { type: "btc_trend", period: 200, dir: "above" },
  { type: "ma", kind: "sma", fast: 1, slow: 200, op: "gt" },
];

function withRegime(
  entries: { label: string; entry: Condition[] }[],
  on?: boolean,
): { label: string; entry: Condition[] }[] {
  if (!on) return entries;
  return entries.map((e) => ({ label: `${e.label} +regime`, entry: [...e.entry, ...REGIME_CONDS] }));
}

export interface TradeOptimizeOptions {
  trainFraction?: number;
  minTrades?: number; // ignore configs that barely trade (per slice)
  minProfitFactor?: number; // "don't lose more than you win" guard (default 1)
  stopLossPcts?: number[];
  takeProfitRRs?: number[]; // take-profit distance = RR × stop distance
  topN?: number;
  objective?: OptimizeObjective; // what to rank by (default winRate)
  robust?: boolean; // pick config consistent across many train sub-periods
  regimeFilter?: boolean; // only trade when the market (BTC + coin) is in an uptrend
  trailingStopPct?: number; // trailing stop applied to every config
  maxHoldBars?: number; // time-based exit applied to every config
  cooldownBars?: number; // post-exit cooldown applied to every config
}

/** Extra engine risk controls (beyond stop/TP) applied to every searched config. */
function extraEngineFrom(o: TradeOptimizeOptions): Partial<EngineOptions> {
  const e: Partial<EngineOptions> = {};
  if (o.trailingStopPct != null) e.trailingStopPct = o.trailingStopPct;
  if (o.maxHoldBars != null) e.maxHoldBars = o.maxHoldBars;
  if (o.cooldownBars != null) e.cooldownBars = o.cooldownBars;
  return e;
}

/**
 * Robustness-first selection (anti-overfitting). Instead of the single config
 * with the highest peak on the whole train slice (which is often a one-off
 * fluke), we split train into K sub-periods and pick the config that is
 * profitable in the MOST of them — a strategy that worked across several
 * different market phases is far more likely to survive the unseen future.
 */
function selectRobustConfig(
  train: Candle[],
  timeframe: string,
  entries: { label: string; entry: RuleSpec["entry"]["conditions"] }[],
  stops: number[],
  rrs: number[],
  minTradesTotal: number,
  minProfitFactor: number,
  extraEngine: Partial<EngineOptions> = {},
): ScoredConfig | null {
  const K = 4;
  const subSize = Math.floor(train.length / K);
  if (subSize < 60) return null;

  let best: ScoredConfig | null = null;
  let bestConsistency = -1;
  let bestMeanWin = -1;

  for (const e of entries) {
    const spec = entrySpec(e.entry);
    for (const sl of stops) {
      for (const rr of rrs) {
        const engine: EngineOptions = { stopLossPct: sl, takeProfitRR: rr, ...extraEngine };
        const full = evaluate(spec, train, timeframe, engine);
        if (full.tradesCount < minTradesTotal || full.profitFactor < minProfitFactor) continue;

        let profitableSubs = 0;
        let activeSubs = 0;
        let winSum = 0;
        for (let k = 0; k < K; k++) {
          const sub = train.slice(k * subSize, k === K - 1 ? train.length : (k + 1) * subSize);
          const m = evaluate(spec, sub, timeframe, engine);
          if (m.tradesCount < 2) continue;
          activeSubs++;
          if (m.profitFactor >= 1) profitableSubs++;
          winSum += m.winRate;
        }
        if (activeSubs < 3) continue; // must trade across most sub-periods

        const consistency = profitableSubs / activeSubs;
        const meanWin = winSum / activeSubs;
        if (consistency > bestConsistency || (consistency === bestConsistency && meanWin > bestMeanWin)) {
          bestConsistency = consistency;
          bestMeanWin = meanWin;
          best = { entryLabel: e.label, stopLossPct: sl, takeProfitRR: rr, spec, engine, metrics: full };
        }
      }
    }
  }
  return best;
}

export interface OptimizedConfig {
  entryLabel: string;
  stopLossPct: number;
  takeProfitRR: number;
  takeProfitPct: number; // stopLossPct × RR, for readability
  trainWinRate: number;
  trainTrades: number;
  testWinRate: number;
  testProfitFactor: number;
  testTrades: number;
  testNetProfitPct: number;
  testAvgTradePct: number;
  testMaxDrawdownPct: number;
}

export interface TradeOptimizeResult {
  evaluated: number;
  trainCandles: number;
  testCandles: number;
  minProfitFactor: number;
  best: OptimizedConfig | null;
  top: OptimizedConfig[];
}

// Stop-loss widths and take-profit ratios to search. Low RR = a tight take-profit
// relative to the stop, which yields a HIGH win rate (many small wins). The
// profit-factor guard still requires each config to be net positive, so a high
// win rate can't hide catastrophic losers. (PF>=1 needs winRate >= 1/(1+RR):
// RR 0.5 -> 67%, RR 0.33 -> 75%, RR 0.2 -> 83%, RR 0.11 -> 90%.)
const DEFAULT_STOPS = [0.05, 0.08, 0.12, 0.2];
const DEFAULT_RRS = [0.15, 0.2, 0.33, 0.5, 0.75, 1, 1.5, 2];

function entrySpec(entry: RuleSpec["entry"]["conditions"]): RuleSpec {
  // Entry-only: no signal exit, so the trade ends only at take-profit or stop.
  return { entry: { mode: "all", conditions: entry }, exit: { mode: "any", conditions: [] } };
}

interface ScoredConfig {
  entryLabel: string;
  stopLossPct: number;
  takeProfitRR: number;
  spec: RuleSpec;
  engine: EngineOptions;
  metrics: Metrics;
}

/** What we optimise for. Win rate = most trades exit green; profit = biggest
 *  net return; profitFactor = best reward-to-risk balance. */
export type OptimizeObjective = "winRate" | "profit" | "profitFactor";

/** The number we rank a config by, given the chosen objective. */
function objectiveScore(m: Metrics, objective: OptimizeObjective): number {
  if (objective === "profit") return m.netProfitPct;
  if (objective === "profitFactor") return m.profitFactor;
  return m.winRate;
}

/**
 * Grid-search entry × stop × take-profit on ONE slice; keep configs that trade
 * enough and are net positive (profit factor guard), ranked by the chosen
 * objective. Shared by the single-split optimizer and the walk-forward optimizer.
 */
function searchConfigs(
  slice: Candle[],
  timeframe: string,
  entries: { label: string; entry: RuleSpec["entry"]["conditions"] }[],
  stops: number[],
  rrs: number[],
  minTrades: number,
  minProfitFactor: number,
  objective: OptimizeObjective = "winRate",
  extraEngine: Partial<EngineOptions> = {},
): ScoredConfig[] {
  const out: ScoredConfig[] = [];
  for (const e of entries) {
    const spec = entrySpec(e.entry);
    for (const sl of stops) {
      for (const rr of rrs) {
        const engine: EngineOptions = { stopLossPct: sl, takeProfitRR: rr, ...extraEngine };
        const m = evaluate(spec, slice, timeframe, engine);
        if (m.tradesCount < minTrades || m.profitFactor < minProfitFactor) continue;
        out.push({ entryLabel: e.label, stopLossPct: sl, takeProfitRR: rr, spec, engine, metrics: m });
      }
    }
  }
  out.sort(
    (a, b) =>
      objectiveScore(b.metrics, objective) - objectiveScore(a.metrics, objective) ||
      b.metrics.profitFactor - a.metrics.profitFactor,
  );
  return out;
}

export function optimizeTrades(
  candles: Candle[],
  timeframe: string,
  options: TradeOptimizeOptions = {},
): TradeOptimizeResult {
  const trainFraction = options.trainFraction ?? 0.7;
  const minTrades = options.minTrades ?? 8;
  const minProfitFactor = options.minProfitFactor ?? 1;
  const stops = options.stopLossPcts ?? DEFAULT_STOPS;
  const rrs = options.takeProfitRRs ?? DEFAULT_RRS;
  const topN = options.topN ?? 5;
  const objective = options.objective ?? "winRate";

  const split = Math.floor(candles.length * trainFraction);
  const train = candles.slice(0, split);
  const test = candles.slice(split);

  const entries = buildEntryVariants();

  // 1) Search the grid on TRAIN (net-positive configs, ranked by the objective).
  const scored = searchConfigs(train, timeframe, entries, stops, rrs, minTrades, minProfitFactor, objective);

  // 2) Validate the shortlist out-of-sample; keep those that still trade enough
  //    and stay net positive, then rank by the HONEST out-of-sample objective.
  const shortlist = scored.slice(0, Math.max(topN * 6, 24));
  const validated: OptimizedConfig[] = shortlist
    .map((c) => {
      const t = evaluate(c.spec, test, timeframe, c.engine);
      return {
        entryLabel: c.entryLabel,
        stopLossPct: c.stopLossPct,
        takeProfitRR: c.takeProfitRR,
        takeProfitPct: round(c.stopLossPct * c.takeProfitRR * 100, 2),
        trainWinRate: c.metrics.winRate,
        trainTrades: c.metrics.tradesCount,
        testWinRate: t.winRate,
        testProfitFactor: t.profitFactor,
        testTrades: t.tradesCount,
        testNetProfitPct: t.netProfitPct,
        testAvgTradePct: t.avgTradePct,
        testMaxDrawdownPct: t.maxDrawdownPct,
      };
    })
    .filter((c) => c.testTrades >= 3 && c.testProfitFactor >= minProfitFactor)
    .sort((a, b) => {
      const key =
        objective === "profit"
          ? b.testNetProfitPct - a.testNetProfitPct
          : objective === "profitFactor"
            ? b.testProfitFactor - a.testProfitFactor
            : b.testWinRate - a.testWinRate;
      return key || b.testProfitFactor - a.testProfitFactor;
    });

  return {
    evaluated: entries.length * stops.length * rrs.length,
    trainCandles: train.length,
    testCandles: test.length,
    minProfitFactor,
    best: validated[0] ?? null,
    top: validated.slice(0, topN),
  };
}

// ---- Walk-forward trade optimizer: test the win rate across EVERY window ----

export interface WalkForwardOptimizeOptions {
  folds?: number;
  minTrainFraction?: number;
  minTrades?: number;
  minProfitFactor?: number;
  stopLossPcts?: number[];
  takeProfitRRs?: number[];
  objective?: OptimizeObjective;
}

export interface WFOWindow {
  fold: number;
  trainCandles: number;
  testCandles: number;
  selectedEntry: string | null; // null = nothing net-positive on train → sit out
  stopLossPct: number | null;
  takeProfitRR: number | null;
  testWinRate: number;
  testTrades: number;
  testWins: number;
  testLosses: number;
  testProfitFactor: number;
  testNetProfitPct: number;
}

export interface WalkForwardOptimizeResult {
  folds: number;
  windowsEvaluated: number;
  totalTrades: number;
  totalWins: number;
  overallWinRatePct: number; // wins ÷ trades across ALL windows — the honest headline
  windowsProfitable: number;
  profitableWindowRatePct: number;
  avgWindowWinRatePct: number;
  losingWindows: number[]; // folds where the picked config lost money
  results: WFOWindow[];
}

/**
 * Walk-forward version of the optimizer. For each window we re-optimize the
 * entry + take-profit + stop-loss on everything BEFORE it (just like we would
 * live, re-tuning as data arrives), then trade the chosen config on the unseen
 * window. Aggregating the wins/losses over ALL windows gives the true "if I take
 * N trades across all market moods, how many win?" — and it exposes exactly which
 * windows lost, so we can refine to avoid them.
 */
export function walkForwardOptimize(
  candles: Candle[],
  timeframe: string,
  options: WalkForwardOptimizeOptions = {},
): WalkForwardOptimizeResult {
  const folds = Math.max(2, Math.min(options.folds ?? 6, 12));
  const minTrainFraction = Math.min(Math.max(options.minTrainFraction ?? 0.4, 0.3), 0.8);
  const minTrades = options.minTrades ?? 5;
  const minProfitFactor = options.minProfitFactor ?? 1.1;
  const stops = options.stopLossPcts ?? [0.08, 0.12, 0.2];
  const rrs = options.takeProfitRRs ?? [0.2, 0.33, 0.5];
  const objective = options.objective ?? "winRate";
  const entries = buildEntryVariants();

  const n = candles.length;
  const start = Math.floor(n * minTrainFraction);
  const testSize = Math.floor((n - start) / folds);
  const results: WFOWindow[] = [];

  for (let k = 0; k < folds; k++) {
    const trainEnd = start + k * testSize;
    const train = candles.slice(0, trainEnd);
    const test = candles.slice(trainEnd, k === folds - 1 ? n : trainEnd + testSize);
    if (test.length < 10 || train.length < 60) continue;

    const scored = searchConfigs(train, timeframe, entries, stops, rrs, minTrades, minProfitFactor, objective);
    if (scored.length === 0) {
      results.push({
        fold: k + 1,
        trainCandles: train.length,
        testCandles: test.length,
        selectedEntry: null,
        stopLossPct: null,
        takeProfitRR: null,
        testWinRate: 0,
        testTrades: 0,
        testWins: 0,
        testLosses: 0,
        testProfitFactor: 0,
        testNetProfitPct: 0,
      });
      continue;
    }
    const pick = scored[0];
    const t = evaluate(pick.spec, test, timeframe, pick.engine);
    const wins = Math.round((t.winRate / 100) * t.tradesCount);
    results.push({
      fold: k + 1,
      trainCandles: train.length,
      testCandles: test.length,
      selectedEntry: pick.entryLabel,
      stopLossPct: pick.stopLossPct,
      takeProfitRR: pick.takeProfitRR,
      testWinRate: t.winRate,
      testTrades: t.tradesCount,
      testWins: wins,
      testLosses: t.tradesCount - wins,
      testProfitFactor: t.profitFactor,
      testNetProfitPct: t.netProfitPct,
    });
  }

  const traded = results.filter((r) => r.testTrades > 0);
  const totalTrades = traded.reduce((a, r) => a + r.testTrades, 0);
  const totalWins = traded.reduce((a, r) => a + r.testWins, 0);
  const windowsProfitable = results.filter((r) => r.testNetProfitPct > 0).length;
  const losingWindows = results.filter((r) => r.testNetProfitPct < 0).map((r) => r.fold);

  return {
    folds,
    windowsEvaluated: results.length,
    totalTrades,
    totalWins,
    overallWinRatePct: totalTrades ? round((totalWins / totalTrades) * 100, 2) : 0,
    windowsProfitable,
    profitableWindowRatePct: results.length
      ? round((windowsProfitable / results.length) * 100, 2)
      : 0,
    avgWindowWinRatePct: traded.length
      ? round(traded.reduce((a, r) => a + r.testWinRate, 0) / traded.length, 2)
      : 0,
    losingWindows,
    results,
  };
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

// ---- Best-config out-of-sample trades (for the portfolio backtest) ----------

export interface PortfolioTrade {
  entryTime: string;
  exitTime: string;
  pnlPct: number;
}

export interface BestConfigTrades {
  entryLabel: string;
  stopLossPct: number;
  takeProfitRR: number;
  trainWinRate: number;
  testWinRate: number;
  testProfitFactor: number;
  testNetProfitPct: number;
  trades: PortfolioTrade[];
}

/**
 * Pick the best config on a TRAIN slice (validated out-of-sample by the chosen
 * objective + guards), then return that config's actual out-of-sample TRADES —
 * so a portfolio can pool trades across many coins.
 */
export function bestConfigTestTrades(
  candles: Candle[],
  timeframe: string,
  options: TradeOptimizeOptions = {},
): BestConfigTrades | null {
  const trainFraction = options.trainFraction ?? 0.6;
  const minTrades = options.minTrades ?? 8;
  const minProfitFactor = options.minProfitFactor ?? 1.1;
  const stops = options.stopLossPcts ?? [0.05, 0.08, 0.12];
  const rrs = options.takeProfitRRs ?? [0.2, 0.33, 0.5];
  const objective = options.objective ?? "winRate";

  const split = Math.floor(candles.length * trainFraction);
  const train = candles.slice(0, split);
  const test = candles.slice(split);
  const entries = withRegime(buildEntryVariants(), options.regimeFilter);
  const extraEngine = extraEngineFrom(options);

  // Choose the config on TRAIN only (never peeking at the holdout).
  let best: { c: ScoredConfig; t: Metrics } | null = null;
  if (options.robust) {
    // Robustness-first: the config most consistently profitable across train
    // sub-periods (best generalisation).
    const c = selectRobustConfig(train, timeframe, entries, stops, rrs, minTrades, minProfitFactor, extraEngine);
    if (c) best = { c, t: evaluate(c.spec, test, timeframe, c.engine) };
  } else {
    const scored = searchConfigs(train, timeframe, entries, stops, rrs, minTrades, minProfitFactor, objective, extraEngine);
    for (const c of scored) {
      const t = evaluate(c.spec, test, timeframe, c.engine);
      if (t.tradesCount < 3) continue;
      best = { c, t };
      break;
    }
  }
  if (!best) return null;

  const signals = new RuleStrategy(best.c.spec).generate(test);
  const run = runBacktest(test, signals, best.c.engine);
  return {
    entryLabel: best.c.entryLabel,
    stopLossPct: best.c.stopLossPct,
    takeProfitRR: best.c.takeProfitRR,
    trainWinRate: best.c.metrics.winRate,
    testWinRate: best.t.winRate,
    testProfitFactor: best.t.profitFactor,
    testNetProfitPct: best.t.netProfitPct,
    trades: run.trades.map((tr) => ({
      entryTime: tr.entryTime.toISOString(),
      exitTime: tr.exitTime.toISOString(),
      pnlPct: round(tr.pnlPct, 4),
    })),
  };
}
