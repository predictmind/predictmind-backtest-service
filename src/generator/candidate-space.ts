/**
 * The search space for the strategy generator (S10.1 entry rules / S10.2 exit
 * rules). We combine well-known **base** entry/exit templates with optional
 * **regime/signal gates** AND **risk presets** (stop-loss / take-profit). The
 * generator backtests every combination and keeps the ones that beat the market
 * out-of-sample.
 *
 * This is deliberately a transparent, rule-based search — not a black box — as
 * the methodology requires. Every generated strategy is a readable rule spec plus
 * an explicit risk configuration.
 *
 * Refinement (E13, added later): to push the walk-forward "beat Buy & Hold" rate
 * up — especially in downtrends, where a long-only spot strategy must AVOID being
 * in the market — we added two extra dimensions:
 *   - **regime gates** (only enter when a trend is up), and
 *   - **risk presets** (a stop-loss to cut losers, a take-profit to bank winners).
 * Each candidate now carries its own EngineOptions so the search explores risk,
 * not just entry/exit rules.
 */

import { EngineOptions } from "../engine/backtest-engine";
import { Condition, RuleSpec } from "../engine/rule-strategy";

export interface Candidate {
  label: string;
  spec: RuleSpec;
  /** Risk controls this candidate runs with (stop-loss / take-profit / sizing). */
  engine?: EngineOptions;
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

  // Donchian breakouts (trend-following): buy new highs, exit on new lows. These
  // suit TRENDING coins where buying dips (mean reversion) keeps getting stopped.
  out.push({
    label: "breakout(20)",
    entry: [{ type: "breakout", period: 20, dir: "up" }],
    exit: [{ type: "breakout", period: 10, dir: "down" }],
  });
  out.push({
    label: "breakout(55)",
    entry: [{ type: "breakout", period: 55, dir: "up" }],
    exit: [{ type: "breakout", period: 20, dir: "down" }],
  });

  // Momentum: enter when price has risen enough over a lookback, exit when it
  // rolls over. Another trend-style family, distinct from mean reversion.
  out.push({
    label: "momentum(10)",
    entry: [{ type: "roc", period: 10, op: "gt", value: 3 }],
    exit: [{ type: "roc", period: 10, op: "lt", value: 0 }],
  });

  // Connors RSI-2 (Larry Connors): a famous HIGH-WIN-RATE mean reversion. Buy a
  // deeply oversold 2-period RSI, but ONLY while price is above its 200 SMA (a
  // long-term uptrend) — so we buy dips inside strength, not falling knives.
  // "close > SMA200" is expressed as an SMA(1) [= the close] above SMA(200).
  for (const thresh of [10, 5]) {
    out.push({
      label: `connors_rsi2(<${thresh})`,
      entry: [
        { type: "indicator", name: "rsi", period: 2, op: "lt", value: thresh },
        { type: "ma", kind: "sma", fast: 1, slow: 200, op: "gt" },
      ],
      exit: [{ type: "indicator", name: "rsi", period: 2, op: "gt", value: 70 }],
    });
  }

  // Supertrend trend-follow (Olivier Seban): ride the ATR-band uptrend, exit when
  // it flips down. A distinct, widely-used trend family for trending coins.
  for (const [p, m] of [
    [10, 3],
    [10, 2],
  ]) {
    out.push({
      label: `supertrend(${p},${m})`,
      entry: [{ type: "supertrend", period: p, mult: m, dir: "up" }],
      exit: [{ type: "supertrend", period: p, mult: m, dir: "down" }],
    });
  }

  return out;
}

/**
 * Optional extra entry gates. The first two are **regime** gates (only be long in
 * an uptrend) — the strongest lever for beating Buy & Hold, because they keep us
 * in cash during downtrends. The rest are precision-signal confirmations.
 */
function gates(): { label: string; cond: Condition | null }[] {
  return [
    { label: "", cond: null },
    // Regime: the coin's own short-term trend is up (EMA20 > EMA50).
    { label: "self_up", cond: { type: "ma", kind: "ema", fast: 20, slow: 50, op: "gt" } },
    // Regime: BTC (the market leader) is above its 50-period MA.
    { label: "btc_up", cond: { type: "btc_trend", period: 50, dir: "above" } },
    // Confirmation: aggressive buying (taker buy volume share).
    { label: "buy_pressure", cond: { type: "order_flow", period: 3, op: "gt", value: 0.52 } },
    // Confirmation: market in fear (contrarian entry).
    { label: "fear", cond: { type: "fear_greed", op: "lt", value: 45 } },
  ];
}

/** Risk configurations the search explores for every base × gate. */
function riskPresets(): { label: string; engine: EngineOptions }[] {
  return [
    // All-in / all-out, exit only on the strategy's own signal (original behaviour).
    { label: "", engine: {} },
    // Fixed 8% stop-loss + take-profit at 2x the risk.
    { label: "sl8/tp2", engine: { stopLossPct: 0.08, takeProfitRR: 2 } },
    // Volatility (ATR) stop at 2.5x ATR + take-profit at 2x the risk.
    { label: "atr2.5/tp2", engine: { atrMult: 2.5, atrPeriod: 14, takeProfitRR: 2 } },
  ];
}

export interface EntryVariant {
  label: string;
  entry: Condition[];
}

/**
 * Entry triggers only (base entry × gate), with no signal-based exit — used by
 * the trade-quality optimizer, which decides exits purely by take-profit /
 * stop-loss. This isolates "when to enter" from "when to exit", so we can search
 * the best TP/SL for each entry trigger.
 */
export function buildEntryVariants(): EntryVariant[] {
  const variants: EntryVariant[] = [];
  for (const base of bases()) {
    for (const gate of gates()) {
      const entry: Condition[] = gate.cond ? [...base.entry, gate.cond] : [...base.entry];
      const label = gate.label ? `${base.label} + ${gate.label}` : base.label;
      variants.push({ label, entry });
    }
  }
  return variants;
}

/** Build every base × gate × risk-preset combination as a labelled candidate. */
export function buildCandidateSpecs(): Candidate[] {
  const candidates: Candidate[] = [];
  for (const base of bases()) {
    for (const gate of gates()) {
      for (const risk of riskPresets()) {
        const entry: Condition[] = gate.cond ? [...base.entry, gate.cond] : [...base.entry];
        const parts = [base.label];
        if (gate.label) parts.push(`+ ${gate.label}`);
        const label = risk.label ? `${parts.join(" ")} [${risk.label}]` : parts.join(" ");
        const spec: RuleSpec = {
          entry: { mode: "all", conditions: entry },
          exit: { mode: "any", conditions: [...base.exit] },
        };
        candidates.push({ label, spec, engine: risk.engine });
      }
    }
  }
  return candidates;
}
