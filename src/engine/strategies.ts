/**
 * The benchmark strategy library. These are the market's well-known, publicly
 * documented strategies. Every generated strategy will be compared against them
 * (see docs 07-ai-strategy-engine §16.4). All are SPOT long/flat: BUY = hold the
 * coin, SELL = go to cash. No shorting.
 */

import { ema, rsi, sma } from "./indicators";
import { Candle, Signal, Strategy } from "./types";

/** Buy on the first candle and hold forever — the return everything must beat. */
export class BuyAndHold implements Strategy {
  readonly name = "buy_and_hold";
  readonly params = {};
  generate(candles: Candle[]): Signal[] {
    return candles.map((_, i) => (i === 0 ? "BUY" : "HOLD"));
  }
}

/** Moving-average crossover: BUY when fast SMA is above slow SMA, else SELL. */
export class SmaCrossover implements Strategy {
  readonly name = "sma_crossover";
  readonly params: Record<string, number>;
  constructor(
    private readonly fast = 20,
    private readonly slow = 50,
  ) {
    this.params = { fast, slow };
  }
  generate(candles: Candle[]): Signal[] {
    const closes = candles.map((c) => c.close);
    const fastMa = sma(closes, this.fast);
    const slowMa = sma(closes, this.slow);
    return candles.map((_, i) => {
      const f = fastMa[i];
      const s = slowMa[i];
      if (f === null || s === null) return "HOLD";
      return f > s ? "BUY" : "SELL";
    });
  }
}

/** EMA crossover — like SMA crossover but more responsive to recent price. */
export class EmaCrossover implements Strategy {
  readonly name = "ema_crossover";
  readonly params: Record<string, number>;
  constructor(
    private readonly fast = 12,
    private readonly slow = 26,
  ) {
    this.params = { fast, slow };
  }
  generate(candles: Candle[]): Signal[] {
    const closes = candles.map((c) => c.close);
    const fastMa = ema(closes, this.fast);
    const slowMa = ema(closes, this.slow);
    return candles.map((_, i) => {
      const f = fastMa[i];
      const s = slowMa[i];
      if (f === null || s === null) return "HOLD";
      return f > s ? "BUY" : "SELL";
    });
  }
}

/** RSI mean-reversion: BUY when oversold (<low), SELL when overbought (>high). */
export class RsiReversion implements Strategy {
  readonly name = "rsi_reversion";
  readonly params: Record<string, number>;
  constructor(
    private readonly period = 14,
    private readonly low = 30,
    private readonly high = 70,
  ) {
    this.params = { period, low, high };
  }
  generate(candles: Candle[]): Signal[] {
    const closes = candles.map((c) => c.close);
    const r = rsi(closes, this.period);
    return candles.map((_, i) => {
      const v = r[i];
      if (v === null) return "HOLD";
      if (v < this.low) return "BUY";
      if (v > this.high) return "SELL";
      return "HOLD";
    });
  }
}

/** Factory: build a strategy by name + optional params (used by the API). */
export function createStrategy(
  name: string,
  params: Record<string, number> = {},
): Strategy {
  switch (name) {
    case "buy_and_hold":
      return new BuyAndHold();
    case "sma_crossover":
      return new SmaCrossover(params.fast, params.slow);
    case "ema_crossover":
      return new EmaCrossover(params.fast, params.slow);
    case "rsi_reversion":
      return new RsiReversion(params.period, params.low, params.high);
    default:
      throw new Error(`Unknown strategy: ${name}`);
  }
}

/** Names of every strategy in the benchmark library. */
export const BENCHMARK_STRATEGIES = [
  "buy_and_hold",
  "sma_crossover",
  "ema_crossover",
  "rsi_reversion",
];
