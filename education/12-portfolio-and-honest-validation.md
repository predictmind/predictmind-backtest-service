# 12. The Portfolio + Honest Validation (and the bias we caught)

This lesson is about two things that separate a *toy* backtest from a *trustworthy*
one: **trading a basket of coins together** (`src/generator/portfolio.ts`), and the
discipline that stops a backtest from **lying to you**.

## Why a portfolio, not one coin

A single coin has good *and* bad windows — but different coins rarely have their bad
windows at the same time. When DOGE is chopping, DOT might be trending. If you trade
the whole basket at once, the winners fill in the losers' gaps: the combined ride is
**smoother** and you're never stuck waiting on one coin's setup. This is
**diversification** — the closest thing to a free lunch in markets.

## How the portfolio backtest works

```text
for each coin:
   pick its best config on the PAST only  →  collect that config's trades on the FUTURE slice
pool all coins' trades  →  simulate one shared account  →  measure the basket
```

- **Shared balance**, and each trade risks a fixed fraction (`allocFraction`, e.g.
  10%) — so one coin can't bet the whole account.
- We pool every coin's trades, realise them in time order, and track the combined
  equity to get the basket's win rate, return, and drawdown.

## ⚠️ The bias we caught (read this twice)

Our first portfolio looked amazing: **87.5% win rate, +11.7%, tiny drawdown**. Then
we found the flaw. For each coin we had been choosing the config that scored best on
the **test** slice — i.e. we peeked at the future to pick the strategy. That is
**look-ahead bias**, and it makes any backtest look brilliant.

We fixed it: now each coin's config is chosen on the **training** data only; the test
slice is used **purely to report**, never to choose:

```ts
// pick the TRAIN-best config that actually trades on the holdout — no peeking
for (const c of trainRankedConfigs) {
  const t = evaluate(c.spec, test, timeframe, c.engine);
  if (t.tradesCount < 3) continue;
  best = { c, t }; break;
}
```

The moment we removed the peeking, that 87.5%/+11.7% became **73.8%/−18.7%**. Same
code, same data — the only difference was *honesty*. **This is the most important
lesson in the whole project: a backtest that peeks at the future will always lie.**

## The "go back in time" test (a clean 1-year holdout)

The cleanest honesty test: pretend it's one year ago. **Train only on data up to
then**, then "live-trade" the **untouched last year**. Results for ₹10,000:

| Setup (last year, held-out) | ₹10,000 becomes |
| --- | --- |
| Just holding the 10 coins (buy & hold) | ~₹4,640 (−54% — it was a crash year) |
| Strategy, no regime filter | ~₹7,850 (−21%) |
| Strategy **+ regime filter** | **~₹9,795 (−2%, flat)** |
| Full risk stack, bull+bear mixed period | ~₹9,506 (−5%), with ETH **+28%**, BNB **+22%** |

## What honest validation taught us (the real conclusions)

1. **You cannot profit long-only in a −54% crash.** The win is *losing far less* than
   the market (−2% vs −54%). That is real, valuable capital protection.
2. **A stable "90% win + big profit" does not exist** for mechanical price rules on
   liquid crypto out-of-sample. Every time it appeared, it traced back to peeking or
   overfitting.
3. **The honest, sellable profile:** protect hard in bad markets, make modest gains
   on the coins/regimes that suit the strategy, and prove it *forward* — never trust a
   pretty backtest number alone.

## The walk-forward optimizer

`POST /backtests/optimize/walkforward` runs the whole "re-pick the best config, then
trade the next unseen window" loop across many windows — mimicking how we'd actually
re-tune live as new data arrives. It reports the win rate across **all** windows and
lists exactly which windows lost, so we can keep refining.

## The rule we live by now

> **If a result looks too good, assume we peeked — and go find where.**
> Honesty in validation is worth more than any strategy.

Next: the [glossary](13-glossary.md).
