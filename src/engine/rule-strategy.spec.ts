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

  it("uses the oi_change condition (rising open interest)", () => {
    // OI ramps up then falls; price flat.
    const ois = [100, 100, 110, 121, 100, 90];
    const candles: Candle[] = ois.map((oi, i) => ({
      openTime: new Date(2025, 0, 1, i),
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      volume: 100,
      openInterest: oi,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "oi_change", period: 1, op: "gt", value: 5 }] },
      exit: { mode: "all", conditions: [{ type: "oi_change", period: 1, op: "lt", value: -5 }] },
    });
    const signals = strat.generate(candles);
    expect(signals[3]).toBe("BUY"); // 110 -> 121 = +10%
    expect(signals[4]).toBe("SELL"); // 121 -> 100 = -17%
  });

  it("oi_change is false when open-interest data is missing", () => {
    const candles: Candle[] = [1, 2, 3].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 1,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "oi_change", op: "gt", value: 0 }] },
      exit: { mode: "all", conditions: [{ type: "oi_change", op: "lt", value: 0 }] },
    });
    expect(strat.generate(candles).every((s) => s === "HOLD")).toBe(true);
  });

  it("uses the long_short_ratio condition (contrarian crowd positioning)", () => {
    const lsr = [0.9, 1.0, 2.5, 2.6]; // crowd flips heavily long
    const candles: Candle[] = lsr.map((r) => ({
      openTime: new Date(),
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      volume: 100,
      longShortRatio: r,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "long_short_ratio", op: "lt", value: 1 }] },
      exit: { mode: "all", conditions: [{ type: "long_short_ratio", op: "gt", value: 2 }] },
    });
    const signals = strat.generate(candles);
    expect(signals[0]).toBe("BUY"); // ratio 0.9 < 1
    expect(signals[2]).toBe("SELL"); // ratio 2.5 > 2 (crowd too long)
  });

  it("long_short_ratio is false when data is missing", () => {
    const candles: Candle[] = [1, 2].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 1,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "long_short_ratio", op: "lt", value: 1 }] },
      exit: { mode: "all", conditions: [{ type: "long_short_ratio", op: "gt", value: 2 }] },
    });
    expect(strat.generate(candles).every((s) => s === "HOLD")).toBe(true);
  });

  it("uses the fear_greed condition (contrarian sentiment)", () => {
    const fg = [15, 20, 80, 85]; // extreme fear -> extreme greed
    const candles: Candle[] = fg.map((v) => ({
      openTime: new Date(),
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      volume: 100,
      fearGreed: v,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "fear_greed", op: "lt", value: 25 }] },
      exit: { mode: "all", conditions: [{ type: "fear_greed", op: "gt", value: 75 }] },
    });
    const signals = strat.generate(candles);
    expect(signals[0]).toBe("BUY"); // extreme fear -> contrarian buy
    expect(signals[2]).toBe("SELL"); // extreme greed -> contrarian sell
  });

  it("fear_greed is false when data is missing", () => {
    const candles: Candle[] = [1, 2].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 1,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "fear_greed", op: "lt", value: 25 }] },
      exit: { mode: "all", conditions: [{ type: "fear_greed", op: "gt", value: 75 }] },
    });
    expect(strat.generate(candles).every((s) => s === "HOLD")).toBe(true);
  });

  it("uses the btc_trend condition (BTC-regime filter)", () => {
    // BTC ramps up so its close ends above its short SMA (uptrend).
    const btc = [100, 101, 102, 103, 104, 105, 106, 107];
    const candles: Candle[] = btc.map((b, i) => ({
      openTime: new Date(2025, 0, 1, i),
      open: 10,
      high: 11,
      low: 9,
      close: 10,
      volume: 100,
      btcClose: b,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "btc_trend", period: 3, dir: "above" }] },
      exit: { mode: "all", conditions: [{ type: "btc_trend", period: 3, dir: "below" }] },
    });
    const signals = strat.generate(candles);
    expect(signals).toContain("BUY"); // BTC uptrend -> entry allowed
  });

  it("btc_trend is false when BTC context is missing", () => {
    const candles: Candle[] = [1, 2, 3, 4].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 1,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "btc_trend", period: 2, dir: "above" }] },
      exit: { mode: "all", conditions: [{ type: "btc_trend", period: 2, dir: "below" }] },
    });
    expect(strat.generate(candles).every((s) => s === "HOLD")).toBe(true);
  });

  it("uses the mvrv condition (on-chain valuation)", () => {
    const mvrvs = [0.8, 0.9, 3.6, 3.8]; // undervalued -> overvalued
    const candles: Candle[] = mvrvs.map((m) => ({
      openTime: new Date(),
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      volume: 100,
      mvrv: m,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "mvrv", op: "lt", value: 1 }] },
      exit: { mode: "all", conditions: [{ type: "mvrv", op: "gt", value: 3.5 }] },
    });
    const signals = strat.generate(candles);
    expect(signals[0]).toBe("BUY"); // undervalued
    expect(signals[2]).toBe("SELL"); // overvalued
  });

  it("uses the active_addr_change condition (on-chain usage growth)", () => {
    const addrs = [1000, 1000, 1200, 900];
    const candles: Candle[] = addrs.map((a) => ({
      openTime: new Date(),
      open: 50,
      high: 51,
      low: 49,
      close: 50,
      volume: 100,
      activeAddresses: a,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "active_addr_change", period: 1, op: "gt", value: 10 }] },
      exit: { mode: "all", conditions: [{ type: "active_addr_change", period: 1, op: "lt", value: -10 }] },
    });
    const signals = strat.generate(candles);
    expect(signals[2]).toBe("BUY"); // 1000 -> 1200 = +20%
    expect(signals[3]).toBe("SELL"); // 1200 -> 900 = -25%
  });

  it("on-chain conditions are false when data is missing", () => {
    const candles: Candle[] = [1, 2, 3].map((cl) => ({
      openTime: new Date(),
      open: cl,
      high: cl,
      low: cl,
      close: cl,
      volume: 1,
    }));
    const strat = new RuleStrategy({
      entry: { mode: "all", conditions: [{ type: "mvrv", op: "lt", value: 1 }] },
      exit: { mode: "all", conditions: [{ type: "mvrv", op: "gt", value: 3 }] },
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
