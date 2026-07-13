import { RuleStrategy } from "./rule-strategy";
import { Candle } from "./types";

function candlesFromCloses(closes: number[]): Candle[] {
  return closes.map((cl) => ({
    openTime: new Date(),
    open: cl,
    high: cl + 1,
    low: cl - 1,
    close: cl,
    volume: 1,
  }));
}

describe("RuleStrategy", () => {
  it("requires entry and exit groups", () => {
    // @ts-expect-error intentionally invalid spec
    expect(() => new RuleStrategy({})).toThrow();
  });

  it("emits BUY when an RSI-oversold entry rule is met", () => {
    // A steady decline drives RSI low, then a recovery.
    const closes = [100, 98, 96, 94, 92, 90, 88, 86, 84, 82, 80, 85, 90, 95, 100];
    const candles = candlesFromCloses(closes);
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "indicator", name: "rsi", period: 5, op: "lt", value: 35 }] },
      exit: { mode: "all", conditions: [{ type: "indicator", name: "rsi", period: 5, op: "gt", value: 65 }] },
    });
    const signals = strat.generate(candles);
    expect(signals).toContain("BUY");
  });

  it("uses the order-flow (taker buy pressure) condition", () => {
    // Rising prices with strong taker buying (ratio 0.8), then weak (0.2).
    const candles: Candle[] = [100, 101, 102, 103, 104, 103, 102, 101].map((cl, i) => ({
      openTime: new Date(),
      open: cl,
      high: cl + 1,
      low: cl - 1,
      close: cl,
      volume: 100,
      takerBuyVolume: i < 5 ? 80 : 20,
      trades: 10,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "order_flow", op: "gt", value: 0.6 }] },
      exit: { mode: "all", conditions: [{ type: "order_flow", op: "lt", value: 0.4 }] },
    });
    const signals = strat.generate(candles);
    expect(signals.slice(0, 5)).toContain("BUY"); // strong buying window
    expect(signals.slice(5)).toContain("SELL"); // weak buying window
  });

  it("order-flow condition is false when taker data is missing", () => {
    const candles: Candle[] = [1, 2, 3].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 10,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "order_flow", op: "gt", value: 0.5 }] },
      exit: { mode: "all", conditions: [{ type: "order_flow", op: "lt", value: 0.5 }] },
    });
    expect(strat.generate(candles).every((s) => s === "HOLD")).toBe(true);
  });

  it("uses the funding-rate condition (signal only)", () => {
    const candles: Candle[] = [100, 101, 102, 103].map((cl, i) => ({
      openTime: new Date(),
      open: cl,
      high: cl + 1,
      low: cl - 1,
      close: cl,
      volume: 100,
      fundingRate: i < 2 ? 0.001 : -0.001, // crowded long, then short
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "funding", op: "lt", value: 0 }] },
      exit: { mode: "all", conditions: [{ type: "funding", op: "gt", value: 0.0005 }] },
    });
    const signals = strat.generate(candles);
    expect(signals[0]).toBe("SELL"); // positive funding -> exit condition met
    expect(signals[2]).toBe("BUY"); // negative funding -> entry condition met
  });

  it("funding condition is false when funding data is missing", () => {
    const candles: Candle[] = [1, 2].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 1,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "funding", op: "lt", value: 0 }] },
      exit: { mode: "all", conditions: [{ type: "funding", op: "gt", value: 0 }] },
    });
    expect(strat.generate(candles).every((s) => s === "HOLD")).toBe(true);
  });

  it("combines an indicator AND a pattern with mode 'all'", () => {
    const candles = candlesFromCloses([50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40]);
    const strat = new RuleStrategy({
      entry: {
        mode: "all",
        conditions: [
          { type: "ma", kind: "ema", fast: 3, slow: 6, op: "lt" },
          { type: "pattern", name: "hammer" },
        ],
      },
      exit: { mode: "any", conditions: [{ type: "ma", kind: "ema", fast: 3, slow: 6, op: "gt" }] },
    });
    const signals = strat.generate(candles);
    expect(signals).toHaveLength(candles.length);
    signals.forEach((s) => expect(["BUY", "SELL", "HOLD"]).toContain(s));
  });
});
