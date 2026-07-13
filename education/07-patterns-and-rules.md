# 7. Patterns & Rule-Based Strategies

## Why this step exists (the journey continues)

In [lesson 2](02-indicators-and-strategies.md) our strategies used **indicators
only** (SMA/EMA/RSI). That was the first look. But real traders also read
**candlestick patterns** ("that looks like a hammer — a bounce might be coming"),
and our methodology says to use **as much data and calculation as possible**. So
this step **adds patterns and more indicators**, and a way to **mix them together**
into a strategy. Nothing from lesson 2 was removed — this is new capability layered
on top.

## Part A — more indicators (`engine/indicators.ts`, added functions)

We added four classics next to SMA/EMA/RSI:

- **MACD** — the gap between a fast and slow EMA, plus a "signal" line. When MACD
  crosses above its signal, momentum is turning up.
- **Bollinger Bands** — a moving average with an upper and lower band set a couple
  of standard deviations away. Price near the lower band = "unusually cheap".
- **ATR (Average True Range)** — how big a typical candle move is. A volatility
  gauge (used later for stop-losses).
- **Stochastic %K** — where the close sits inside the recent high–low range (0–100).

Each is a **pure function** returning an array with `null` until it has enough
history — same careful style as before.

## Part B — candlestick patterns (`engine/patterns.ts`, story S9.2)

A **candlestick pattern** is a shape (or small group of shapes) that traders treat
as a hint. We measure each candle's parts:

- **body** = |close − open| (the thick part),
- **range** = high − low (the whole thing),
- **upper/lower wick** = the thin lines above/below the body.

Then simple rules spot the patterns:

```ts
// Hammer: tiny body up top, long lower wick — a possible bullish bounce.
p.body > 0 && p.lowerWick >= 2 * p.body && p.upperWick <= p.body
```

```ts
// Bullish engulfing: today's green candle wraps around yesterday's red body.
prev.close < prev.open && c.close > c.open &&
c.close >= prev.open && c.open <= prev.close
```

We detect: **doji, hammer, shooting star, bullish/bearish engulfing, morning/evening
star**. Each returns a boolean per candle — `true` where the pattern completes.

> **No cheating (look-ahead):** a pattern at candle *i* only looks at candle *i* and
> **earlier** ones (engulfing looks back 1, stars look back 2). It never peeks at
> the future, so it's safe in a backtest.

> **Better option later:** real "pattern discovery" (S9's bigger goal) also *learns*
> which patterns actually made money historically, instead of trusting folklore.
> That statistical part lives in the AI service later; here we provide the reliable
> **detection** it will build on.

## Part C — the rule engine (`engine/rule-strategy.ts`) 🧩

This is the important glue. A **`RuleStrategy`** reads a **JSON spec** describing
*when to buy* and *when to sell*, using indicators **and** patterns together:

```jsonc
{
  "entry": { "mode": "any", "conditions": [
    { "type": "indicator", "name": "rsi", "period": 14, "op": "lt", "value": 40 },
    { "type": "pattern", "name": "bullish_engulfing" }
  ]},
  "exit":  { "mode": "any", "conditions": [
    { "type": "indicator", "name": "rsi", "period": 14, "op": "gt", "value": 65 },
    { "type": "pattern", "name": "bearish_engulfing" }
  ]}
}
```

Reads as: **buy** if RSI is under 40 *or* we see a bullish engulfing; **sell** if
RSI is over 65 *or* a bearish engulfing appears.

Condition types supported: `indicator` (rsi/stoch threshold), `ma` (fast vs slow
SMA/EMA), `macd` (line vs signal), `bollinger` (price vs a band), and `pattern`.
Groups combine with **`mode: "all"`** (every condition) or **`"any"`** (at least
one).

How it runs:

```ts
generate(candles) {
  const entry = evalGroup(this.spec.entry, candles);  // boolean per candle
  const exit  = evalGroup(this.spec.exit, candles);
  return candles.map((_, i) => (entry[i] ? "BUY" : exit[i] ? "SELL" : "HOLD"));
}
```

- We evaluate each condition across the **whole** series once (fast), then combine.
- The strategy is **stateless** — it just says BUY/SELL/HOLD. The engine (lesson 3)
  still enforces "only buy when flat, only sell when holding". Clean separation.

**Why this design?** Because the AI Strategy Generator (E10, coming next) will
*produce these JSON specs* — trying thousands of indicator+pattern combinations and
keeping the ones that beat the benchmark. By making the engine understand a spec,
**any** generated strategy is instantly backtestable with the exact same, trusted
engine and metrics. That's the whole point of building this now.

## Using it via the API

`POST /backtests` now accepts `strategy: "rule"` plus a `rules` object. The full
spec is stored (in the backtest's `params`) so every run is reproducible.

## What we verified ✅

- **25 unit tests** total (patterns, the 4 new indicators, and the rule engine
  combining an indicator + a pattern). Build + lint green.
- **Live** on 500 real BTC 1h candles: a rule mixing **RSI + candlestick patterns**
  ran 25 trades and returned full metrics (net −2.11% vs buy&hold −3.61% — it lost
  less than holding), with the rule spec saved for reproducibility.

Now strategies are built from **indicators AND patterns** — real data and
calculations, exactly as the methodology requires.

Next: the [glossary](08-glossary.md).
