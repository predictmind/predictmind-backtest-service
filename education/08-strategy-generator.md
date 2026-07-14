# 8. The Strategy Generator (E10)

Everything so far lets us *test* a strategy someone hands us. This step makes the
platform **invent** strategies: it tries many combinations, backtests each, and
keeps the ones that actually work — **on data they were never tuned on**.

This is the "AI" of PredictMind V1. Not a mysterious neural network — a
**transparent, systematic search**. Every strategy it outputs is a readable rule
spec (methodology §16: "no black box").

## The three ideas

1. **A search space** — a big list of candidate strategies to try.
2. **Train/test split** — tune on the past, judge on a *later* slice it never saw.
3. **Ranking + an honest verdict** — sort by risk-adjusted return, then report
   whether each finalist beat Buy & Hold **out-of-sample**.

## 1. The search space (`generator/candidate-space.ts`)

We combine well-known **base** strategies with optional **signal filters**:

- **Bases** (entry + exit): RSI reversion at a few thresholds, EMA/SMA crossovers
  at several speeds, MACD, Bollinger reversion — 10 in total.
- **Filters** (added to the entry with "all"): none, "BTC in an uptrend",
  "aggressive buying" (order-flow), "market in fear" (Fear & Greed) — 4 options.

10 bases × 4 filters = **40 candidate strategies**, each a normal rule spec with a
human-readable label like `rsi_reversion(30/70) + btc_up`. Want more? Add a base or
a filter and the count multiplies automatically.

> **Why combine base + filter?** A base gives the *idea* (when to buy/sell); a
> filter adds *context* ("...but only when BTC is healthy"). Filters are exactly the
> precision signals we spent the last few steps building — now the generator can
> mix them in and *measure* whether they help.

## 2. Train / test split (`generator/generator.ts`)

```ts
const split = Math.floor(candles.length * trainFraction); // e.g. 70%
const train = candles.slice(0, split);
const test = candles.slice(split);
```

- We tune (search) on the **train** slice, then judge on the **test** slice — a
  *later* period the search never touched. This is the single most important guard
  against **overfitting** (a strategy that memorised the past and fails on new
  data). See [lesson 1](01-what-is-backtesting.md).

## 3. Search, rank, and the honest verdict

```ts
// evaluate every candidate in-sample; drop ones that barely trade
const scored = candidates
  .map((c) => ({ ...c, train: evaluate(c.spec, train, timeframe) }))
  .filter((c) => c.train.tradesCount >= minTrades);

// rank by risk-adjusted return (Sharpe), tie-break on net profit
scored.sort((a, b) => b.train.sharpe - a.train.sharpe || b.train.netProfitPct - a.train.netProfitPct);

// take the finalists and measure them OUT-OF-SAMPLE
const strategies = scored.slice(0, topN).map((c) => {
  const test = evaluate(c.spec, candles.slice(split), timeframe);
  return { ...c, test, beatsBuyHoldOutOfSample: test.netProfitPct > test.buyHoldPct && test.netProfitPct > 0 };
});
```

- **`minTrades` filter** — a strategy that made 1 lucky trade isn't real; we ignore
  candidates that barely traded.
- **Rank by Sharpe** — we reward *risk-adjusted* return (smooth profit), not just
  raw profit. Tie-break by net profit.
- **`beatsBuyHoldOutOfSample`** — the moment of truth: did this finalist beat simply
  buying and holding, on the slice it was **not** tuned on? Only a "true" here is
  worth trusting.

> **Why rank in-sample but judge out-of-sample?** If we ranked by the *test* score,
> we'd be peeking at the answer and overfitting to the test too. We choose finalists
> using only the train slice, then reveal the test result — like picking students by
> their practice scores, then seeing how they do on the real, unseen exam.

## The API

`POST /backtests/generate { symbol, timeframe, limit, trainFraction?, minTrades?, topN? }`
returns each finalist with its **label**, **rule spec**, **train** metrics, **test**
metrics, and the **OOS verdict**. The service fetches candles *with all signals
attached* (order-flow, funding, OI, etc.) so filter conditions have data.

## Verified live ✅

On BTC 4h (500 candles → 350 train / 150 test), the generator evaluated all **40**
candidates and returned 5 finalists. The top pick `sma_cross(20/50)` beat Buy & Hold
**out-of-sample** (test +1.38% vs +1.02%), and 4 of 5 finalists beat it OOS. 44
tests green.

## Update — PredictScore & ranking (E11, added later) 🏅

The generator produced finalists with lots of numbers (net profit, drawdown,
Sharpe...). **PredictScore** squashes those into **one 0–100 score** so strategies
can be ranked and compared at a glance — plus a **letter grade** and a
**confidence**.

The score is a weighted blend (from docs §9), each factor mapped to 0–100:

| Factor | Weight | From |
| --- | --- | --- |
| Profitability | 30% | net profit % |
| Win rate | 15% | win rate |
| Drawdown | 20% | max drawdown (smaller = higher) |
| Consistency | 15% | Sharpe ratio |
| Market fit | 10% | how much it beat Buy & Hold |
| Sentiment alignment | 10% | *optional* — omitted → other weights renormalise |

```ts
score = Σ (factorScore × weight);   // 0-100
grade = score>=90?"A+" : >=80?"A" : >=70?"B" : >=60?"C" : "D";
```

- **Data-first:** sentiment is the only optional factor. If we don't supply it, we
  **drop its 10% and renormalise** the other five to sum to 100% — so a strategy is
  always judged on its data merit first.
- **Confidence (S11.2):** *how much to trust the score.* It rises with more trades
  (bigger sample) and **falls when the in-sample vs out-of-sample gap is large**
  (a big gap smells of overfitting). So a high score with low confidence is a
  yellow flag.
- **We score on the out-of-sample metrics** and rank finalists by PredictScore —
  the honest quality measure, not the tuned one.

**Verified live** on BTC 4h: finalists came back ranked by PredictScore, e.g.
`ema_cross(12/26) + buy_pressure` **score 74, grade B**, while a strategy that
failed to beat the market out-of-sample scored **60 (grade C)**. Every single
backtest and benchmark result now carries a PredictScore too.

## What this is — and isn't (yet)

- **Is:** a transparent search that produces readable strategies, proves them
  out-of-sample, and ranks them with a single explainable score.
- **Isn't yet:** parameter *optimization* (fine-tuning numbers), walk-forward across
  many windows, or a machine-learning ranking model. Those are the next upgrades —
  this is the solid, honest foundation they build on.

Next: the [glossary](09-glossary.md).
