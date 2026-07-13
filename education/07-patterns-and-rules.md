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

## Update — signal #1: order-flow (added later) 🌊

After this lesson was first written, we added the **first "extra signal"** from the
precision roadmap (docs 07 §16.6): **order-flow**, i.e. how much of each candle's
volume was **bought by aggressive takers**. It's a new condition type in the same
rule engine — nothing above changed, this is an addition.

- The market service now captures Binance's **taker buy volume** on every candle
  (it was always in the data; we just started saving it). See the market service's
  order-flow lesson.
- The engine's `Candle` type gained optional `takerBuyVolume` / `trades` fields, and
  the market client reads them.
- New rule condition:

```jsonc
{ "type": "order_flow", "period": 3, "op": "gt", "value": 0.55 }
```

It computes **buy ratio = takerBuyVolume / volume** (0–1; above 0.5 = net buying),
optionally **smoothed** over `period` candles, and compares it to `value`. If a
candle has no taker data (older imports), the condition is simply `false` — safe.

Why it's valuable: patterns and indicators read *price*; order-flow reads *who is
pushing* — aggressive buyers vs sellers. It often confirms or warns against a
price signal.

**Verified live:** an order-flow-only rule on 500 BTC 4h candles ran 31 trades and
beat Buy & Hold (−14.9% vs −17.2%) over a falling market — it sidestepped some of
the drop. (Kept only because it helps; that's the data-first rule.)

## Update — signal #2: funding rate (added later) 💸

Next from the roadmap: **funding rate** — a crowd-positioning gauge from perpetual
futures (positive = crowd heavily long; negative = heavily short). We use it as a
**signal only** (we still trade spot). The market service captures funding history;
here we consume it.

- The `Candle` type gained an optional `fundingRate`. Funding updates every ~8h,
  so the market client **aligns** it to each candle (the most recent funding at or
  before the candle's time, via a two-pointer walk) and best-effort leaves it
  `null` if funding can't be fetched.
- New rule condition:

```jsonc
{ "type": "funding", "op": "lt", "value": 0.00005 }
```

It compares the candle's aligned funding rate to a value (e.g. "only buy when the
crowd isn't over-leveraged long"). Missing funding → condition `false` (safe).

**Verified live:** funding imported for BTC, and a funding-based rule backtest on
BTC 4h ran with funding correctly aligned to candles. 29 tests green.

## Update — signal #3: open interest (added later) 📊

**Open interest (OI)** = the total size of open futures positions. Rising OI while
price rises = **conviction** (new money); falling OI = positions closing. Signal
only (we trade spot).

- The `Candle` gained optional `openInterest`. The market client now aligns OI to
  candles too — we generalised the funding alignment into one reusable
  `attachSeries` helper (two-pointer walk), and both funding and OI use it.
- New rule condition compares the **percent change** of OI over a lookback (rising
  OI matters more than the raw level):

```jsonc
{ "type": "oi_change", "period": 1, "op": "gt", "value": 2 }   // OI up >2%
```

Missing OI → condition `false` (safe).

**Verified live:** an OI-conviction rule on BTC 4h returned **+6.1% vs buy&hold
−2.0% with a 77% win rate** in-sample. Promising — but per the methodology it must
still beat benchmarks **out-of-sample** before we rely on it. 31 tests green.

## Update — signal #4: long/short ratio (added later) 👥

The **long/short ratio** is the share of futures accounts long vs short — mostly a
**contrarian** gauge (when everyone's long, a pullback often follows). Signal only.

- The market service captures it; the client aligns it to candles via the same
  `attachSeries` helper; the `Candle` gained optional `longShortRatio`.
- New rule condition:

```jsonc
{ "type": "long_short_ratio", "op": "gt", "value": 2 }   // crowd very long -> caution
```

Missing data → `false` (safe). **Liquidations** (the roadmap's paired item) are
**deferred** — historical liquidation data isn't freely available from Binance
REST (needs a live websocket or paid source).

**Verified live:** long/short ratio imported for BTC and aligned to candles in a
backtest. 33 tests green.

## Update — signal #5: Fear & Greed Index (added later) 😱🤑

The **Crypto Fear & Greed Index** is one market-wide daily number 0–100 (0 =
extreme fear, 100 = extreme greed) — a **contrarian** gauge. Unlike the others it's
not per-coin and comes from a free public API (alternative.me).

- The market service captures it; the client aligns the daily value to each candle
  (same `attachSeries` helper); the `Candle` gained optional `fearGreed`.
- New rule condition:

```jsonc
{ "type": "fear_greed", "op": "lt", "value": 25 }   // extreme fear -> contrarian buy
```

Missing data → `false` (safe).

**Verified live:** 1000 daily values imported and aligned to BTC 4h candles in a
backtest. 35 tests green.

## Update — signal #6: BTC context (added later) 🟠

Alts (ETH, SOL, …) mostly **follow BTC**. If BTC is falling, most alts fall too —
so a smart alt strategy should **only trade when BTC is healthy**. That's the BTC
context filter.

Unlike the other signals, this needs **no new data feed** — we already have BTC
candles. So it's a **backtest-only** addition:

- The market client, when backtesting an alt, also fetches **BTC candles** for the
  same timeframe and attaches BTC's close to each candle (`candle.btcClose`). For
  BTC itself, it's just its own close.
- New rule condition checks whether BTC is above/below its own moving average
  (an uptrend/downtrend regime):

```jsonc
{ "type": "btc_trend", "period": 50, "dir": "above" }   // only when BTC is in an uptrend
```

Missing BTC data → `false` (safe).

**Verified live (this is a great example):** an ETH 4h strategy that buys RSI dips
**only while BTC is above its 50-period MA** lost just **−3.7% vs ETH buy&hold
−23.1%** over a bad window — the BTC filter kept it in cash through most of the
drop. Exactly the point of a regime filter. 37 tests green.

*(BTC **dominance** — BTC's share of total market cap — is a related idea that
would need an external market-cap feed like CoinGecko; noted as an optional
extension.)*

## Update — signal #7: on-chain metrics (added later) ⛓️

**On-chain** data comes from the blockchain itself (not exchanges):

- **Active addresses** — daily count of active wallets (network usage/adoption).
- **MVRV** — market cap ÷ realized cap (a valuation ratio).

The market service captures these from the free Coin Metrics community API. The
`Candle` gained optional `activeAddresses` and `mvrv`, aligned daily. Two new rule
conditions:

```jsonc
{ "type": "active_addr_change", "period": 7, "op": "gt", "value": 10 }  // usage growing >10%
{ "type": "mvrv", "op": "gt", "value": 3.5 }                            // over-valued -> caution
```

**Honest note:** **MVRV needs realized cap, which is *not* on the free tier** — so
`mvrv` stays `null` unless a paid source is configured later (the condition is
future-ready). Active addresses **are** free and working.

**Verified live:** BTC 1d strategy on active-address growth lost **−22.5% vs
buy&hold −42.8%** in-sample. 40 tests green.

Next: the [glossary](08-glossary.md).
