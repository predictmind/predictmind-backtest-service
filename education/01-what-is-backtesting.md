# 1. What Is Backtesting?

## The idea

Imagine you have an idea: "buy Bitcoin whenever it's been falling for a while, then
sell when it bounces back." Is that a *good* idea? Instead of risking real money to
find out, we **replay history**: take the last few hundred hours of real prices and
pretend we followed the rule the whole time. At the end we count: did we make
money? How often were we right? How scary were the ups and downs?

That replay is **backtesting**. It's the single most important tool for deciding if
a strategy is worth anything — and (from our [strategy methodology](../../predictmind/docs/07-ai-strategy-engine.md))
it's how we prove a strategy **beats the market's known strategies**.

## The words we'll use

- **Candle** — one time slice of price: open, high, low, close, volume.
- **Strategy** — a rule that, for each candle, says **BUY**, **SELL**, or **HOLD**.
- **Signal** — that one decision (BUY/SELL/HOLD) on a candle.
- **Trade** — one complete buy-then-sell.
- **Equity curve** — our total money, drawn over time.

## Spot only — the safe kind of trading

PredictMind V1 does **spot** trading only: we buy a coin with cash, and later sell
it back to cash. We are always in one of two states:

- **In position** — we own the coin (we "went long").
- **Flat** — we hold cash.

We never "short" (bet a price will fall) and never borrow money ("leverage").
That's a deliberate rule — the most you can lose is what you put in, nothing worse.
So in our engine, **BUY = hold the coin**, **SELL = go back to cash**. Simple.

## Fees matter

Every real buy or sell costs a small **fee** (we use 0.1% per side). If we ignored
fees, a strategy that trades constantly would look great on paper and lose money in
real life. So the engine subtracts a fee on every buy and every sell. Honesty first.

## The big trap: cheating by accident (look-ahead bias)

The most common backtesting mistake is **look-ahead bias** — accidentally using
information from the *future* to make a *past* decision. For example, "buy at the
low of the day" — but you only know the day's low *after* the day ends. That makes
a strategy look magical in testing and fail in real life.

We avoid it by having strategies decide using only data **up to the current
candle**, and by acting at that candle's **close** price. No peeking ahead.

> **Why this matters so much:** it's easy to build a backtest that shows huge
> profits and is completely fake. A trustworthy engine is *careful* not to cheat.
> That's why our indicators only look backwards and our tests check the math.

## The even bigger idea: out-of-sample

A strategy tuned to look perfect on one stretch of history is often just
**memorising** that stretch (called **overfitting**). The real test is how it does
on data it has **never seen** (**out-of-sample**). This service produces the
metrics; later steps (walk-forward, regime tests) use them to check a strategy
generalises. For now, remember: **a good backtest is necessary but not enough — the
proof is out-of-sample.**

Next: the building blocks — [indicators and strategies](02-indicators-and-strategies.md).
