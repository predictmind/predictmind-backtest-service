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
