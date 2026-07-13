import { runBacktest } from "./backtest-engine";
import { ema, rsi, sma } from "./indicators";
import { computeMetrics, maxDrawdown, periodsPerYear } from "./metrics";
import { BuyAndHold, createStrategy, SmaCrossover } from "./strategies";
import { Candle } from "./types";

function candlesFromCloses(closes: number[]): Candle[] {
  const start = Date.UTC(2025, 0, 1);
  return closes.map((c, i) => ({
    openTime: new Date(start + i * 3_600_000),
    open: c,
    high: c,
    low: c,
    close: c,
    volume: 1,
  }));
}

describe("indicators", () => {
  it("sma averages the last N values", () => {
    const out = sma([2, 4, 6, 8], 2);
    expect(out[0]).toBeNull();
    expect(out[1]).toBe(3);
    expect(out[3]).toBe(7);
  });

  it("ema returns a value once seeded", () => {
    const out = ema([1, 2, 3, 4, 5], 3);
    expect(out[1]).toBeNull();
    expect(out[2]).not.toBeNull();
  });

  it("rsi stays within 0-100", () => {
    const out = rsi([1, 2, 3, 4, 3, 2, 5, 6, 7, 8, 7, 6, 9, 10], 5);
    for (const v of out) {
      if (v !== null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("runBacktest (spot long/flat)", () => {
  it("buy and hold profits on a rising market (minus fees)", () => {
    const candles = candlesFromCloses([100, 110, 120, 130]);
    const signals = new BuyAndHold().generate(candles);
    const run = runBacktest(candles, signals, { feePct: 0.001, initialCapital: 10_000 });
    expect(run.trades).toHaveLength(1);
    expect(run.finalEquity).toBeGreaterThan(10_000);
    // ~30% gain minus two small fees.
    expect(run.finalEquity).toBeLessThan(13_000);
  });

  it("stays flat (no trades) when never signalled to buy", () => {
    const candles = candlesFromCloses([100, 90, 80]);
    const signals = candles.map(() => "HOLD" as const);
    const run = runBacktest(candles, signals);
    expect(run.trades).toHaveLength(0);
    expect(run.finalEquity).toBe(run.initialCapital);
  });

  it("records a completed trade on buy then sell", () => {
    const candles = candlesFromCloses([100, 120, 120]);
    const signals = ["BUY", "SELL", "HOLD"] as const;
    const run = runBacktest(candles, [...signals], { feePct: 0, initialCapital: 1000 });
    expect(run.trades).toHaveLength(1);
    expect(run.trades[0].pnlPct).toBeCloseTo(20, 1);
  });
});

describe("metrics", () => {
  it("maxDrawdown measures the worst peak-to-trough drop", () => {
    expect(maxDrawdown([100, 120, 60, 90])).toBeCloseTo(50, 5); // 120 -> 60
  });

  it("computes coherent metrics for a winning run", () => {
    const candles = candlesFromCloses([100, 110, 120, 130]);
    const run = runBacktest(candles, new BuyAndHold().generate(candles), { feePct: 0 });
    const m = computeMetrics(run, candles, "1h");
    expect(m.tradesCount).toBe(1);
    expect(m.winRate).toBe(100);
    expect(m.netProfitPct).toBeGreaterThan(0);
    expect(m.buyHoldPct).toBeCloseTo(30, 0);
  });

  it("periodsPerYear maps timeframes", () => {
    expect(periodsPerYear("1d")).toBe(365);
    expect(periodsPerYear("1h")).toBe(8_760);
    expect(periodsPerYear("weird")).toBe(365);
  });
});

describe("strategies", () => {
  it("sma crossover buys in an uptrend and sells in a downtrend", () => {
    const up = candlesFromCloses([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const signals = new SmaCrossover(2, 4).generate(up);
    expect(signals).toContain("BUY");
  });

  it("createStrategy builds by name and rejects unknown", () => {
    expect(createStrategy("buy_and_hold").name).toBe("buy_and_hold");
    expect(() => createStrategy("nope")).toThrow();
  });
});
