import { buildCandidateSpecs } from "./candidate-space";
import { generateAndRank } from "./generator";
import { Candle } from "../engine/types";

function candlesFromCloses(closes: number[]): Candle[] {
  const start = Date.UTC(2025, 0, 1);
  return closes.map((cl, i) => ({
    openTime: new Date(start + i * 3_600_000),
    open: cl,
    high: cl * 1.01,
    low: cl * 0.99,
    close: cl,
    volume: 100,
  }));
}

// A wavy series so mean-reversion / crossover strategies actually trade.
function wavySeries(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(100 + Math.sin(i / 4) * 12 + Math.sin(i / 13) * 6 + (i % 5));
  }
  return out;
}

describe("candidate space", () => {
  it("builds base x filter combinations, each a valid rule spec", () => {
    const candidates = buildCandidateSpecs();
    expect(candidates.length).toBeGreaterThan(20);
    for (const c of candidates) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.spec.entry.conditions.length).toBeGreaterThan(0);
      expect(c.spec.exit.conditions.length).toBeGreaterThan(0);
    }
  });
});

describe("generateAndRank", () => {
  const candles = candlesFromCloses(wavySeries(400));

  it("splits train/test and returns ranked strategies", () => {
    const result = generateAndRank(candles, "1h", { trainFraction: 0.7, minTrades: 3, topN: 5 });
    expect(result.evaluated).toBeGreaterThan(20);
    expect(result.trainCandles).toBe(280);
    expect(result.testCandles).toBe(120);
    expect(result.strategies.length).toBeGreaterThan(0);
    expect(result.strategies.length).toBeLessThanOrEqual(5);
  });

  it("each finalist carries train + test metrics and an OOS verdict", () => {
    const result = generateAndRank(candles, "1h", { minTrades: 3, topN: 3 });
    for (const s of result.strategies) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(typeof s.train.sharpe).toBe("number");
      expect(typeof s.test.netProfitPct).toBe("number");
      expect(typeof s.beatsBuyHoldOutOfSample).toBe("boolean");
    }
  });

  it("finalists are ranked by in-sample Sharpe (descending)", () => {
    const result = generateAndRank(candles, "1h", { minTrades: 3, topN: 5 });
    for (let i = 1; i < result.strategies.length; i++) {
      expect(result.strategies[i - 1].train.sharpe).toBeGreaterThanOrEqual(
        result.strategies[i].train.sharpe,
      );
    }
  });
});
