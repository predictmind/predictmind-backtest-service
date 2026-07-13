/**
 * A generic, data-driven strategy defined by a JSON rule spec that combines
 * indicators AND candlestick patterns. This is the bridge to the AI Strategy
 * Generator (E10): the generator will produce these specs, and this class turns
 * any spec into BUY/SELL/HOLD signals the backtest engine can evaluate.
 *
 * Signals are stateless (BUY when entry conditions hold, SELL when exit
 * conditions hold); the engine enforces the actual position logic (only buys
 * when flat, only sells when holding).
 */

import { bollinger, ema, macd, rsi, sma, stochasticK } from "./indicators";
import { detectPattern } from "./patterns";
import { Candle, Signal, Strategy } from "./types";

type Comparator = "lt" | "lte" | "gt" | "gte";

export type Condition =
  | { type: "indicator"; name: "rsi" | "stoch_k"; period?: number; op: Comparator; value: number }
  | { type: "ma"; kind: "sma" | "ema"; fast: number; slow: number; op: "gt" | "lt" }
  | { type: "macd"; fast?: number; slow?: number; signal?: number; op: "gt" | "lt" }
  | { type: "bollinger"; period?: number; mult?: number; side: "below_lower" | "above_upper" }
  | { type: "order_flow"; period?: number; op: Comparator; value: number }
  | { type: "pattern"; name: string };

export interface ConditionGroup {
  mode: "all" | "any";
  conditions: Condition[];
}

export interface RuleSpec {
  entry: ConditionGroup;
  exit: ConditionGroup;
}

function compare(a: number, op: Comparator, b: number): boolean {
  switch (op) {
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
  }
}

/** Rolling mean of a nullable series; a window with any null yields null. */
function smoothRatio(values: (number | null)[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v === null) return null;
      sum += v;
    }
    return sum / period;
  });
}

/** Evaluate one condition across the whole series -> a boolean per candle. */
function conditionSeries(cond: Condition, candles: Candle[]): boolean[] {
  const closes = candles.map((c) => c.close);
  const n = candles.length;
  const falses = new Array(n).fill(false);

  switch (cond.type) {
    case "indicator": {
      const series =
        cond.name === "rsi"
          ? rsi(closes, cond.period ?? 14)
          : stochasticK(candles, cond.period ?? 14);
      return series.map((v) => (v === null ? false : compare(v, cond.op, cond.value)));
    }
    case "ma": {
      const fn = cond.kind === "sma" ? sma : ema;
      const fast = fn(closes, cond.fast);
      const slow = fn(closes, cond.slow);
      return candles.map((_, i) => {
        const f = fast[i];
        const s = slow[i];
        if (f === null || s === null) return false;
        return cond.op === "gt" ? f > s : f < s;
      });
    }
    case "macd": {
      const m = macd(closes, cond.fast, cond.slow, cond.signal);
      return candles.map((_, i) => {
        const line = m.macd[i];
        const sig = m.signal[i];
        if (line === null || sig === null) return false;
        return cond.op === "gt" ? line > sig : line < sig;
      });
    }
    case "bollinger": {
      const b = bollinger(closes, cond.period ?? 20, cond.mult ?? 2);
      return candles.map((c, i) => {
        const upper = b.upper[i];
        const lower = b.lower[i];
        if (upper === null || lower === null) return false;
        return cond.side === "below_lower" ? c.close < lower : c.close > upper;
      });
    }
    case "order_flow": {
      // Taker buy ratio: share of a candle's volume bought by aggressive takers
      // (>0.5 = net buying pressure). Optionally smoothed over `period` candles.
      const ratios = candles.map((c) =>
        c.takerBuyVolume != null && c.volume > 0 ? c.takerBuyVolume / c.volume : null,
      );
      const series = cond.period && cond.period > 1 ? smoothRatio(ratios, cond.period) : ratios;
      return series.map((v) => (v === null ? false : compare(v, cond.op, cond.value)));
    }
    case "pattern":
      return detectPattern(cond.name, candles);
    default:
      return falses;
  }
}

function evalGroup(group: ConditionGroup, candles: Candle[]): boolean[] {
  if (!group.conditions.length) return new Array(candles.length).fill(false);
  const series = group.conditions.map((c) => conditionSeries(c, candles));
  return candles.map((_, i) =>
    group.mode === "all" ? series.every((s) => s[i]) : series.some((s) => s[i]),
  );
}

export class RuleStrategy implements Strategy {
  readonly name = "rule";
  readonly params: Record<string, number> = {};

  constructor(readonly spec: RuleSpec) {
    if (!spec?.entry || !spec?.exit) {
      throw new Error("rule strategy requires { entry, exit } condition groups");
    }
  }

  generate(candles: Candle[]): Signal[] {
    const entry = evalGroup(this.spec.entry, candles);
    const exit = evalGroup(this.spec.exit, candles);
    return candles.map((_, i) => {
      if (entry[i]) return "BUY";
      if (exit[i]) return "SELL";
      return "HOLD";
    });
  }
}
