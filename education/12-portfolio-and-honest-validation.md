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

## Update — a wider universe + a live shared-capital simulator (added later)

Two upgrades made the system genuinely tradeable.

**1. A wider net (universe expansion).** Trading a *few* trades per coin per year is
too little on 10 coins. So we imported **~40 liquid coins** and applied the two
proven fixed strategies — **dip-buy** (Connors RSI-2 in an uptrend) and **breakout**
(Donchian in an uptrend) — across all of them, keeping only the coins each *fits*:

- **Dip-buy fits:** ETH, BNB, LTC, TRX.
- **Breakout fits:** XLM, XRP, HBAR, MANA, VET, TRX, DOGE, SAND.
- Together, **11 coins qualify** (up from 4), giving **~45 quality trades/year** —
  a real cadence, without forcing more trades *per* coin (which we proved loses).
- Lesson: don't trade one coin more often; trade the *same selective edge across
  more coins*. That's how you get activity without giving up the edge.

**2. A live, capital-constrained portfolio (`live-portfolio.ts`).** The earlier
portfolio pooled trades loosely. The live simulator models **real money**: one
shared balance, each open trade **locks a fixed slice** (e.g. ₹1,000 of ₹10,000), so
free cash falls while trades are open and a new signal is **skipped if you can't
afford it** — exactly like live trading.

```ts
events (entry/exit, time-ordered):
  on entry: if (cash >= slice) { cash -= slice; open++ } else skip
  on exit:  cash += slice * (1 + pnl%/100)   // slice + its profit/loss returns
```

Result on the 11-coin basket (₹10,000, ₹1,000/trade, out-of-sample):

| Period | ₹10,000 becomes | Trades | Max open at once | Max drawdown |
| --- | --- | --- | --- | --- |
| Recent bear year | ₹10,202 (+2%) | 16 | 3 | 0.9% |
| Bull+bear 2 years | ₹12,429 (+24%) | 86 | 8 | 5.1% |

So ~**+12%/year across a full cycle** with a **~5% max drawdown**, and in a crash
year it stays **safe and roughly flat** — never running out of cash (peak 8 of 10
slots used). That's the honest, realistic profile: steady, protected, single-to-low-
double-digit annual returns — not a fantasy.

Next: the [glossary](13-glossary.md).
