import { Metrics } from "./metrics";
import { predictScore } from "./predict-score";

function metrics(overrides: Partial<Metrics> = {}): Metrics {
  return {
    netProfitPct: 0,
    buyHoldPct: 0,
    winRate: 50,
    profitFactor: 1,
    maxDrawdownPct: 10,
    sharpe: 0,
    sortino: 0,
    expectancyPct: 0,
    avgTradePct: 0,
    tradesCount: 10,
    finalEquity: 10000,
    ...overrides,
  };
}

describe("predictScore", () => {
  it("gives a strong strategy a high score and good grade", () => {
    const r = predictScore(
      metrics({ netProfitPct: 40, buyHoldPct: 5, winRate: 70, maxDrawdownPct: 8, sharpe: 2.5 }),
    );
    expect(r.score).toBeGreaterThan(75);
    expect(["A+", "A", "B"]).toContain(r.grade);
  });

  it("gives a poor strategy a low score", () => {
    const r = predictScore(
      metrics({ netProfitPct: -30, buyHoldPct: 10, winRate: 25, maxDrawdownPct: 45, sharpe: -1.5 }),
    );
    expect(r.score).toBeLessThan(40);
    expect(r.grade).toBe("D");
  });

  it("stays within 0-100 and grades by threshold", () => {
    const r = predictScore(metrics());
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["A+", "A", "B", "C", "D"]).toContain(r.grade);
  });

  it("includes sentiment only when provided (data-first renormalisation)", () => {
    const dataOnly = predictScore(metrics({ netProfitPct: 20 }));
    expect(dataOnly.factors.sentiment).toBeUndefined();
    const withSentiment = predictScore(metrics({ netProfitPct: 20 }), { sentiment: 90 });
    expect(withSentiment.factors.sentiment).toBe(90);
  });

  it("confidence rises with more trades and falls with a big OOS gap", () => {
    const few = predictScore(metrics({ tradesCount: 2 }));
    const many = predictScore(metrics({ tradesCount: 30 }));
    expect(many.confidence).toBeGreaterThan(few.confidence);
    const stable = predictScore(metrics({ tradesCount: 20 }), { oosGap: 1 });
    const overfit = predictScore(metrics({ tradesCount: 20 }), { oosGap: 25 });
    expect(stable.confidence).toBeGreaterThan(overfit.confidence);
  });
});
