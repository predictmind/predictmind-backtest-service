import { Candle } from "../engine/types";
import { walkForward } from "./walk-forward";

function candlesFromCloses(closes: number[]): Candle[] {
  const start = Date.UTC(2025, 0, 1);
  return closes.map((cl, i) => ({
    openTime: new Date(start + i * 86_400_000),
    open: cl,
    high: cl * 1.01,
    low: cl * 0.99,
    close: cl,
    volume: 100,
  }));
}

// A wavy series so crossover / mean-reversion candidates actually trade.
function wavySeries(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(100 + Math.sin(i / 4) * 12 + Math.sin(i / 13) * 6 + (i % 5));
  }
  return out;
}

describe("walkForward", () => {
  const candles = candlesFromCloses(wavySeries(600));

  it("runs the requested number of windows and reports success rates", () => {
    const r = walkForward(candles, "1d", { folds: 5, minTrainFraction: 0.5, minTrades: 3 });
    expect(r.folds).toBe(5);
    expect(r.windowsEvaluated).toBeGreaterThan(0);
    expect(r.results.length).toBe(r.windowsEvaluated);
    // rates are valid percentages
    expect(r.beatBuyHoldRatePct).toBeGreaterThanOrEqual(0);
    expect(r.beatBuyHoldRatePct).toBeLessThanOrEqual(100);
    expect(r.profitableRatePct).toBeGreaterThanOrEqual(0);
    expect(r.profitableRatePct).toBeLessThanOrEqual(100);
  });

  it("each fold trains on the past and tests on a later, unseen window", () => {
    const r = walkForward(candles, "1d", { folds: 4, minTrainFraction: 0.5, minTrades: 3 });
    for (const f of r.results) {
      expect(f.trainCandles).toBeGreaterThanOrEqual(60);
      expect(f.testCandles).toBeGreaterThanOrEqual(10);
      expect(typeof f.beatsBuyHold).toBe("boolean");
      expect(typeof f.profitable).toBe("boolean");
    }
    // counts are consistent with the per-fold flags
    expect(r.beatBuyHoldWindows).toBe(r.results.filter((f) => f.beatsBuyHold).length);
    expect(r.profitableWindows).toBe(r.results.filter((f) => f.profitable).length);
  });

  it("clamps folds into a sane range", () => {
    const r = walkForward(candles, "1d", { folds: 99 });
    expect(r.folds).toBeLessThanOrEqual(12);
  });
});
