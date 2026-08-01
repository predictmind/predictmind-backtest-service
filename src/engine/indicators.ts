/**
 * Small, pure indicator helpers used by the benchmark strategies and metrics.
 * They return arrays the same length as the input; positions without enough
 * history yet are `null`. Kept independent of the market service's indicators
 * so the backtest engine can run on any candle array with no network calls.
 *
 * Note: results are built with `push` (sequential append) rather than writing
 * `out[i] = ...`. Appending avoids a computed-property write whose index derives
 * from externally-sourced data — which static analysis (CodeQL) rightly flags.
 */

import { Candle } from "./types";

/** Simple Moving Average: plain average of the last `period` closes. */
export function sma(values: number[], period: number): (number | null)[] {
  if (period <= 0) return values.map(() => null);
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

/** Exponential Moving Average: recent prices weighted more heavily. */
export function ema(values: number[], period: number): (number | null)[] {
  if (period <= 0 || values.length < period) return values.map(() => null);
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values.
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;

  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
    } else if (i === period - 1) {
      out.push(prev);
    } else {
      prev = values[i] * k + prev * (1 - k);
      out.push(prev);
    }
  }
  return out;
}

/** Relative Strength Index (Wilder's smoothing): 0-100 momentum oscillator. */
export function rsi(closes: number[], period: number): (number | null)[] {
  if (period <= 0 || closes.length <= period) return closes.map(() => null);

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;

  const rsiFrom = (g: number, l: number): number =>
    l === 0 ? 100 : 100 - 100 / (1 + g / l);

  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      out.push(null);
    } else if (i === period) {
      out.push(rsiFrom(avgGain, avgLoss));
    } else {
      const change = closes[i] - closes[i - 1];
      const g = change >= 0 ? change : 0;
      const l = change < 0 ? -change : 0;
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      out.push(rsiFrom(avgGain, avgLoss));
    }
  }
  return out;
}

/** MACD: difference of two EMAs, plus its signal line and histogram. */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = closes.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });

  // Signal line = EMA of the (non-null) MACD line, realigned to full length.
  // The MACD line is null until both EMAs exist, then contiguous, so the k-th
  // defined value maps to index (firstIdx + k). We build with push (no computed
  // property writes) to keep it clear and static-analysis clean.
  const firstIdx = macdLine.findIndex((v) => v !== null);
  const defined = macdLine.filter((v): v is number => v !== null);
  const signalDefined = ema(defined, signalPeriod);

  const signal: (number | null)[] = [];
  const histogram: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (firstIdx < 0 || i < firstIdx) {
      signal.push(null);
      histogram.push(null);
      continue;
    }
    const sig = signalDefined[i - firstIdx] ?? null;
    signal.push(sig);
    const m = macdLine[i];
    histogram.push(sig !== null && m !== null ? m - sig : null);
  }
  return { macd: macdLine, signal, histogram };
}

/** Bollinger Bands: a moving average with bands `mult` std-devs above/below. */
export function bollinger(
  closes: number[],
  period = 20,
  mult = 2,
): { middle: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    const m = middle[i];
    if (m === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - m) ** 2;
    const sd = Math.sqrt(sumSq / period);
    upper.push(m + mult * sd);
    lower.push(m - mult * sd);
  }
  return { middle, upper, lower };
}

/** Average True Range: typical size of a candle's move (volatility). */
export function atr(candles: Candle[], period = 14): (number | null)[] {
  if (candles.length === 0) return [];
  const trueRanges: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      trueRanges.push(c.high - c.low);
    } else {
      const prevClose = candles[i - 1].close;
      trueRanges.push(
        Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)),
      );
    }
  }
  return sma(trueRanges, period);
}

/**
 * ADX (Average Directional Index, Wilder). Measures TREND STRENGTH (0-100),
 * regardless of direction: below ~20 = choppy/no trend, above ~25 = strong trend.
 * Pros use it as a filter — only take trend trades when ADX confirms a real trend.
 */
export function adx(candles: Candle[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period * 2) return out;

  const trs: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      trs.push(candles[0].high - candles[0].low);
      plusDM.push(0);
      minusDM.push(0);
      continue;
    }
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close),
    );
    trs.push(tr);
  }

  // Wilder smoothing of TR, +DM, -DM, then DX, then ADX.
  let trS = 0;
  let pS = 0;
  let mS = 0;
  const dx: number[] = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    if (i <= period) {
      trS += trs[i];
      pS += plusDM[i];
      mS += minusDM[i];
    } else {
      trS = trS - trS / period + trs[i];
      pS = pS - pS / period + plusDM[i];
      mS = mS - mS / period + minusDM[i];
    }
    if (i >= period && trS > 0) {
      const plusDI = (100 * pS) / trS;
      const minusDI = (100 * mS) / trS;
      const denom = plusDI + minusDI;
      dx[i] = denom > 0 ? (100 * Math.abs(plusDI - minusDI)) / denom : 0;
    }
  }
  // ADX = Wilder-smoothed DX.
  let adxVal = 0;
  let count = 0;
  for (let i = period; i < n; i++) {
    if (Number.isNaN(dx[i])) continue;
    count++;
    if (count <= period) {
      adxVal += dx[i];
      if (count === period) out[i] = adxVal / period;
    } else {
      adxVal = (out[i - 1] as number) * (period - 1) + dx[i];
      out[i] = adxVal / period;
    }
  }
  return out;
}

/**
 * Supertrend direction (Olivier Seban). An ATR-band trend filter: returns `true`
 * when the market is in an uptrend (close above the trailing Supertrend line),
 * `false` otherwise. `period` = ATR length, `mult` = band width.
 */
export function supertrend(candles: Candle[], period = 10, mult = 3): boolean[] {
  const atrArr = atr(candles, period);
  const up: boolean[] = [];
  let finalUpperPrev = Infinity;
  let finalLowerPrev = -Infinity;
  let trendUpPrev = true;
  for (let i = 0; i < candles.length; i++) {
    const a = atrArr[i];
    const c = candles[i];
    if (a === null) {
      up.push(false);
      finalUpperPrev = Infinity;
      finalLowerPrev = -Infinity;
      continue;
    }
    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + mult * a;
    const basicLower = hl2 - mult * a;
    const prevClose = i > 0 ? candles[i - 1].close : c.close;
    const finalUpper =
      basicUpper < finalUpperPrev || prevClose > finalUpperPrev ? basicUpper : finalUpperPrev;
    const finalLower =
      basicLower > finalLowerPrev || prevClose < finalLowerPrev ? basicLower : finalLowerPrev;
    // Stay in the current trend until the close breaks the opposite band.
    const trendUp: boolean = trendUpPrev ? c.close >= finalLower : c.close > finalUpper;
    up.push(trendUp);
    finalUpperPrev = finalUpper;
    finalLowerPrev = finalLower;
    trendUpPrev = trendUp;
  }
  return up;
}

/** Stochastic %K: where the close sits within the recent high-low range (0-100). */
export function stochasticK(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].high > hi) hi = candles[j].high;
      if (candles[j].low < lo) lo = candles[j].low;
    }
    const range = hi - lo;
    out.push(range > 0 ? ((candles[i].close - lo) / range) * 100 : 50);
  }
  return out;
}
