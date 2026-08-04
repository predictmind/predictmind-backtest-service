import { atr, bollinger, macd, stochasticK } from "./indicators";
import {
  bearishEngulfing,
  bullishEngulfing,
  detectPattern,
  doji,
  hammer,
  PATTERN_NAMES,
} from "./patterns";
import { Candle } from "./types";

function c(open: number, high: number, low: number, close: number): Candle {
  return { openTime: new Date(), open, high, low, close, volume: 1 };
}

describe("candlestick patterns", () => {
  it("detects a doji (tiny body, big range)", () => {
    const out = doji([c(100, 110, 90, 100.2)]);
    expect(out[0]).toBe(true);
  });

  it("detects a hammer (long lower wick)", () => {
    const out = hammer([c(100, 101, 90, 100.5)]);
    expect(out[0]).toBe(true);
  });

  it("detects bullish engulfing", () => {
    const candles = [c(100, 100, 95, 96), c(95, 106, 94, 105)];
    expect(bullishEngulfing(candles)[1]).toBe(true);
  });

  it("detects bearish engulfing", () => {
    const candles = [c(100, 106, 100, 105), c(106, 107, 98, 99)];
    expect(bearishEngulfing(candles)[1]).toBe(true);
  });

  it("first candle can never be an engulfing pattern", () => {
    expect(bullishEngulfing([c(1, 2, 0, 2)])[0]).toBe(false);
  });

  it("detectPattern rejects unknown names", () => {
    expect(() => detectPattern("nope", [])).toThrow();
    expect(PATTERN_NAMES).toContain("bullish_engulfing");
  });
});

describe("added indicators", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5);
  const candles: Candle[] = closes.map((cl, i) =>
    c(cl, cl + 1, cl - 1, closes[i]),
  );

  it("macd returns aligned arrays", () => {
    const m = macd(closes);
    expect(m.macd).toHaveLength(closes.length);
    expect(m.signal).toHaveLength(closes.length);
    expect(m.histogram).toHaveLength(closes.length);
  });

  it("bollinger bands bracket the middle", () => {
    const b = bollinger(closes, 20, 2);
    const i = closes.length - 1;
    expect(b.upper[i]!).toBeGreaterThanOrEqual(b.middle[i]!);
    expect(b.lower[i]!).toBeLessThanOrEqual(b.middle[i]!);
  });

  it("atr is non-negative", () => {
    const a = atr(candles, 14);
    const v = a[a.length - 1];
    expect(v!).toBeGreaterThanOrEqual(0);
  });

  it("stochastic %K stays within 0-100", () => {
    const k = stochasticK(candles, 14);
    for (const v of k) {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});
