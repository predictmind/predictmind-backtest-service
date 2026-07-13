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
