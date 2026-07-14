/**
 * The search space for the strategy generator (S10.1 entry rules / S10.2 exit
 * rules). We combine well-known **base** entry/exit templates with optional
 * **signal filters** (BTC regime, order-flow, sentiment). The generator backtests
 * every combination and keeps the ones that beat the market out-of-sample.
 *
 * This is deliberately a transparent, rule-based search — not a black box — as
 * the methodology requires. Every generated strategy is a readable rule spec.
 */

import { Condition, RuleSpec } from "../engine/rule-strategy";

export interface Candidate {
  label: string;
  spec: RuleSpec;
}

interface Base {
  label: string;
  entry: Condition[];
  exit: Condition[];
}

/** Well-known base strategies (entry + exit), each fully readable. */
function bases(): Base[] {
  const out: Base[] = [];

  // RSI mean-reversion at a few thresholds.
  for (const [low, high] of [
    [30, 70],
    [25, 75],
    [35, 65],
  ]) {
    out.push({
      label: `rsi_reversion(${low}/${high})`,
      entry: [{ type: "indicator", name: "rsi", period: 14, op: "lt", value: low }],
      exit: [{ type: "indicator", name: "rsi", period: 14, op: "gt", value: high }],
    });
  }

  // EMA / SMA trend-following crossovers.
  for (const [fast, slow] of [
    [9, 21],
    [12, 26],
    [20, 50],
  ]) {
    out.push({
      label: `ema_cross(${fast}/${slow})`,
      entry: [{ type: "ma", kind: "ema", fast, slow, op: "gt" }],
      exit: [{ type: "ma", kind: "ema", fast, slow, op: "lt" }],
    });
  }
  for (const [fast, slow] of [
    [20, 50],
    [50, 200],
  ]) {
    out.push({
      label: `sma_cross(${fast}/${slow})`,
      entry: [{ type: "ma", kind: "sma", fast, slow, op: "gt" }],
      exit: [{ type: "ma", kind: "sma", fast, slow, op: "lt" }],
    });
  }

  // MACD momentum.
  out.push({
    label: "macd_cross",
    entry: [{ type: "macd", op: "gt" }],
    exit: [{ type: "macd", op: "lt" }],
  });

  // Bollinger mean-reversion.
  out.push({
    label: "bollinger_reversion",
    entry: [{ type: "bollinger", period: 20, mult: 2, side: "below_lower" }],
    exit: [{ type: "bollinger", period: 20, mult: 2, side: "above_upper" }],
  });

  return out;
}

/** Optional extra entry filters using the precision signals. */
function filters(): { label: string; cond: Condition | null }[] {
  return [
    { label: "", cond: null },
    { label: "btc_up", cond: { type: "btc_trend", period: 50, dir: "above" } },
    { label: "buy_pressure", cond: { type: "order_flow", period: 3, op: "gt", value: 0.52 } },
    { label: "fear", cond: { type: "fear_greed", op: "lt", value: 45 } },
  ];
}

/** Build every base × filter combination as a labelled rule spec. */
export function buildCandidateSpecs(): Candidate[] {
  const candidates: Candidate[] = [];
  for (const base of bases()) {
    for (const filter of filters()) {
      const entry: Condition[] = filter.cond ? [...base.entry, filter.cond] : [...base.entry];
      const label = filter.label ? `${base.label} + ${filter.label}` : base.label;
      const spec: RuleSpec = {
        entry: { mode: "all", conditions: entry },
        exit: { mode: "any", conditions: [...base.exit] },
      };
      candidates.push({ label, spec });
    }
  }
  return candidates;
}
