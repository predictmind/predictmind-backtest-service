import { Candle } from "../engine/types";
import { optimizeTrades } from "./trade-optimizer";

function candlesFromCloses(closes: number[]): Candle[] {
  const start = Date.UTC(2024, 0, 1);
  return closes.map((cl, i) => ({
    openTime: new Date(start + i * 86_400_000),
    open: cl,
    high: cl * 1.02,
    low: cl * 0.98,
    close: cl,
    volume: 100,
  }));
}

// An upward, wavy series so entries trigger and some take-profits get hit.
function series(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(100 + i * 0.2 + Math.sin(i / 5) * 8 + Math.sin(i / 17) * 5);
  }
  return out;
}

describe("optimizeTrades", () => {
  const candles = candlesFromCloses(series(700));

  it("searches the grid and returns configs ranked by out-of-sample win rate", () => {
    const r = optimizeTrades(candles, "1d", {
      trainFraction: 0.7,
      minTrades: 3,
      stopLossPcts: [0.03, 0.05],
      takeProfitRRs: [0.5, 1, 2],
      topN: 5,
    });
    expect(r.evaluated).toBeGreaterThan(0);
    expect(r.trainCandles + r.testCandles).toBe(700);
    expect(r.trainCandles).toBeGreaterThanOrEqual(489);
    // top list is sorted by test win rate descending
    for (let i = 1; i < r.top.length; i++) {
      expect(r.top[i - 1].testWinRate).toBeGreaterThanOrEqual(r.top[i].testWinRate);
    }
    // every reported config respects the profit-factor guard and carries TP/SL
    for (const c of r.top) {
      expect(c.testProfitFactor).toBeGreaterThanOrEqual(1);
      expect(c.stopLossPct).toBeGreaterThan(0);
      expect(c.takeProfitRR).toBeGreaterThan(0);
      expect(c.testWinRate).toBeGreaterThanOrEqual(0);
      expect(c.testWinRate).toBeLessThanOrEqual(100);
    }
  });

  it("best is the top of the validated list (or null if none generalize)", () => {
    const r = optimizeTrades(candles, "1d", { trainFraction: 0.7, minTrades: 3, topN: 3 });
    if (r.best) {
      expect(r.best.testWinRate).toBe(r.top[0].testWinRate);
      expect(r.best.testProfitFactor).toBeGreaterThanOrEqual(r.minProfitFactor);
    } else {
      expect(r.top.length).toBe(0);
    }
  });
});
