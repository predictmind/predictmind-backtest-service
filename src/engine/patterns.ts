/**
 * Candlestick pattern detectors (S9.2 — historical pattern detection).
 *
 * Each detector returns a boolean per candle: true where the pattern *completes*
 * on that candle. They only ever look at the current and earlier candles (never
 * the future), so they are safe to use in a backtest without look-ahead bias.
 * All pure functions — no I/O — so they are easy to unit-test.
 */

import { Candle } from "./types";

interface Parts {
  body: number;
  range: number;
  upperWick: number;
  lowerWick: number;
  bullish: boolean;
  bearish: boolean;
}

function parts(c: Candle): Parts {
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  const lowerWick = Math.min(c.open, c.close) - c.low;
  return { body, range, upperWick, lowerWick, bullish: c.close > c.open, bearish: c.close < c.open };
}

/** Small body relative to range — indecision. */
export function doji(candles: Candle[]): boolean[] {
  return candles.map((c) => {
    const p = parts(c);
    return p.range > 0 && p.body <= p.range * 0.1;
  });
}

/** Long lower wick, small body near the top — potential bullish reversal. */
export function hammer(candles: Candle[]): boolean[] {
  return candles.map((c) => {
    const p = parts(c);
    return p.body > 0 && p.lowerWick >= 2 * p.body && p.upperWick <= p.body;
  });
}

/** Long upper wick, small body near the bottom — potential bearish reversal. */
export function shootingStar(candles: Candle[]): boolean[] {
  return candles.map((c) => {
    const p = parts(c);
    return p.body > 0 && p.upperWick >= 2 * p.body && p.lowerWick <= p.body;
  });
}

/** Current green candle fully engulfs the previous red body — bullish. */
export function bullishEngulfing(candles: Candle[]): boolean[] {
  return candles.map((c, i) => {
    if (i === 0) return false;
    const prev = candles[i - 1];
    return (
      prev.close < prev.open && // previous bearish
      c.close > c.open && // current bullish
      c.close >= prev.open &&
      c.open <= prev.close
    );
  });
}

/** Current red candle fully engulfs the previous green body — bearish. */
export function bearishEngulfing(candles: Candle[]): boolean[] {
  return candles.map((c, i) => {
    if (i === 0) return false;
    const prev = candles[i - 1];
    return (
      prev.close > prev.open && // previous bullish
      c.close < c.open && // current bearish
      c.open >= prev.close &&
      c.close <= prev.open
    );
  });
}

/** Three-candle bullish reversal: big red, small star, strong green. */
export function morningStar(candles: Candle[]): boolean[] {
  return candles.map((c, i) => {
    if (i < 2) return false;
    const a = candles[i - 2];
    const b = candles[i - 1];
    const pa = parts(a);
    const pb = parts(b);
    const mid = (a.open + a.close) / 2;
    return (
      a.close < a.open && // first bearish, sizeable
      pa.body > pa.range * 0.5 &&
      pb.body <= pb.range * 0.5 && // small middle body
      c.close > c.open && // third bullish
      c.close > mid // closes back into the first body
    );
  });
}

/** Three-candle bearish reversal: big green, small star, strong red. */
export function eveningStar(candles: Candle[]): boolean[] {
  return candles.map((c, i) => {
    if (i < 2) return false;
    const a = candles[i - 2];
    const b = candles[i - 1];
    const pa = parts(a);
    const pb = parts(b);
    const mid = (a.open + a.close) / 2;
    return (
      a.close > a.open &&
      pa.body > pa.range * 0.5 &&
      pb.body <= pb.range * 0.5 &&
      c.close < c.open &&
      c.close < mid
    );
  });
}

export type PatternName =
  | "doji"
  | "hammer"
  | "shooting_star"
  | "bullish_engulfing"
  | "bearish_engulfing"
  | "morning_star"
  | "evening_star";

export const PATTERN_NAMES: PatternName[] = [
  "doji",
  "hammer",
  "shooting_star",
  "bullish_engulfing",
  "bearish_engulfing",
  "morning_star",
  "evening_star",
];

/**
 * Detect a pattern by name across the whole candle series.
 * Uses an explicit switch (not a dynamic `map[name]()` call) so a user-supplied
 * name can never dispatch to an unexpected/inherited function.
 */
export function detectPattern(name: string, candles: Candle[]): boolean[] {
  switch (name) {
    case "doji":
      return doji(candles);
    case "hammer":
      return hammer(candles);
    case "shooting_star":
      return shootingStar(candles);
    case "bullish_engulfing":
      return bullishEngulfing(candles);
    case "bearish_engulfing":
      return bearishEngulfing(candles);
    case "morning_star":
      return morningStar(candles);
    case "evening_star":
      return eveningStar(candles);
    default:
      throw new Error(`Unknown pattern: ${name}`);
  }
}
