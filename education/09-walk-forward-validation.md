# 9. Walk-Forward Validation (E13 — the honesty test)

Everything up to lesson 8 could tune a strategy on the past and check it on **one**
later slice of data. That's good, but it hides a trap: what if that one slice was
just **lucky** (a nice bull run) or **unlucky** (a crash)? A single test can make a
bad system look great, or a good system look terrible. **Walk-forward validation**
fixes that. It's the most honest test we have of the whole *strategy-picking
process*.

> **Why we built this (the real story).** We generated strategies for all 10 coins
> and asked "what's our success rate?". The answer swung wildly depending on which
> slice we tested — because a single train/test split lands on whatever market mood
> happened to be at the end of the data. To get a number we could actually trust,
> we needed to test **many** windows across **many** market moods. That's this
> lesson.

## The big idea: test the *process*, not one strategy

A subtle but important shift. Before, we asked "is *this* strategy good?". Now we
ask "is our **way of choosing** a strategy good?". Because in real life we'll keep
re-picking the best strategy as new data arrives — so we should test *that whole
habit*, repeatedly, on data it never saw.

## How it works — anchored (expanding) walk-forward

Imagine your price history is a long book. We read it like this:

```text
 |<----------- history (e.g. 1000 daily candles) ----------->|
 [======== initial training (50%) ========][ w1 ][ w2 ][ w3 ][ w4 ][ w5 ]
                                            train→ test  test  test  test  test
 fold 1: train on everything before w1,  test on w1
 fold 2: train on everything before w2,  test on w2   (training GREW)
 fold 3: train on everything before w3,  test on w3
 ...and so on.
```

1. Reserve the first chunk (default **50%**) as the minimum training block.
2. Split the rest into `folds` (default **5**) consecutive **test windows**.
3. For each window, **train on all the candles before it**, pick the best candidate
   (exactly the generator's rule: enough trades, then best Sharpe), and **measure
   that pick on the window** it has never seen.
4. Count how often the pick **beat Buy & Hold** and how often it was **profitable**.

The training window **grows** each fold (it's "anchored" at the start) — like a
student who keeps all their past lessons and learns more before each new exam.

> **Why train-before-test every time?** Because that's how reality works: you can
> only use the past to decide, then the future judges you. Never let the test data
> leak into the choice — that's the cardinal sin of backtesting (it's called
> **look-ahead bias**), and it makes fake results.

## The code (`generator/walk-forward.ts`)

```ts
const start = Math.floor(n * minTrainFraction);   // initial training block
const testSize = Math.floor((n - start) / folds); // size of each window

for (let k = 0; k < folds; k++) {
  const trainEnd = start + k * testSize;
  const train = candles.slice(0, trainEnd);            // everything before window k
  const test  = candles.slice(trainEnd, trainEnd + testSize); // window k (unseen)

  // pick the best candidate on TRAIN only (same rule as the generator)
  const scored = candidates
    .map((c) => ({ ...c, m: evaluate(c.spec, train, timeframe, engine) }))
    .filter((c) => c.m.tradesCount >= minTrades)
    .sort((a, b) => b.m.sharpe - a.m.sharpe || b.m.netProfitPct - a.m.netProfitPct);

  const pick = scored[0];
  const t = evaluate(pick.spec, test, timeframe, engine);   // judge on unseen window
  results.push({ ...,
    profitable: t.netProfitPct > 0,
    beatsBuyHold: t.netProfitPct > t.buyHoldPct,
  });
}
```

- We **reuse** the generator's `evaluate` and `buildCandidateSpecs` — the same
  bricks, so walk-forward judges exactly the process the generator uses. (We
  exported `evaluate` from `generator.ts` so both files share one definition
  instead of copying it — one source of truth.)
- **The "stay in cash" case.** If *no* candidate trades enough on the train slice,
  the system would place no trades — so that window's return is **0%**. In a
  downtrend, 0% actually **beats** a negative Buy & Hold. We record that honestly
  (`selectedLabel: null`, profitable = false, beatsBuyHold = 0 > buyHold). Sitting
  out a crash is a real, valid decision.

## What it reports

```ts
{
  folds, windowsEvaluated,
  profitableWindows, beatBuyHoldWindows,
  profitableRatePct,   // e.g. 40  → profitable in 2 of 5 windows
  beatBuyHoldRatePct,  // e.g. 80  → beat Buy & Hold in 4 of 5 windows
  avgOosReturnPct, avgBuyHoldPct,
  results: [ ...per-window detail... ]
}
```

`beatBuyHoldRatePct` is the headline: **out of every unseen window, how often did
our process do better than simply holding the coin?** That's a success rate you can
actually believe, because no window was cherry-picked.

## What it told us (verified live, 10 coins, 1d, 5 windows) ✅

- **Beat Buy & Hold in ~74% of windows on average — 8 of 10 coins hit 80%+.**
- **Profitable in only ~28% of windows** — because the test windows were mostly
  *downtrends*, and our strategies are **long-only spot** (they can only buy). In a
  falling market the best a buy-only strategy can do is **lose less** by holding
  cash — which is exactly what happened (e.g. ADA +0.6% vs Buy & Hold −28%).

> **The honest lesson this taught us.** A headline like "80% of trades win" is the
> *wrong* goal for long-only spot trading — you cannot win most trades when the
> whole market falls and you can only buy. The right, achievable goal is **"beat
> Buy & Hold across most windows and market moods"**, and by that measure we're
> already close to target. Walk-forward is what let us say that with a straight
> face instead of guessing from one lucky slice.

## What this is — and isn't (yet)

- **Is:** a repeated, leak-free test of our selection process across many market
  regimes, giving a trustworthy success rate.
- **Isn't yet:** per-fold **parameter optimization** (we pick from a fixed candidate
  list, we don't fine-tune numbers per window), nor **Monte Carlo** reshuffling to
  test luck. Those are the next robustness upgrades — this is the honest foundation
  they build on.

Next: [the trade-quality optimizer](10-trade-quality-optimizer.md).
