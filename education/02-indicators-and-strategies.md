# 2. Indicators & the Benchmark Strategy Library

## Part A — the indicator helpers (`engine/indicators.ts`)

Strategies need a few classic calculations. We keep small, **pure** versions right
here so the engine can run on any candle array without calling the market service.

New words:
- **SMA (Simple Moving Average)** — the plain average of the last N closes. Smooths
  out the jiggles so you see the trend.
- **EMA (Exponential Moving Average)** — like SMA but recent prices count more, so
  it reacts faster.
- **RSI (Relative Strength Index)** — a 0–100 number: high (>70) = "maybe overbought",
  low (<30) = "maybe oversold".

Each helper returns an array the **same length** as the input, with `null` where
there isn't enough history yet. For example, a 50-period SMA has no value for the
first 49 candles — we return `null` there so a strategy knows "not enough data,
don't act."

```ts
export function sma(values: number[], period: number): (number | null)[] {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];   // slide the window
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}
```

- **Why the "sliding window" trick?** Instead of re-adding N numbers every candle
  (slow), we add the new price and subtract the one that fell out of the window.
  Fast and simple.
- **`out[i] = null` until `i >= period - 1`** — honest about "no answer yet."

`ema` seeds itself with the first SMA, then applies the weighting factor
`k = 2/(period+1)`. `rsi` uses **Wilder's smoothing** (the standard way) so our RSI
matches what every charting tool shows.

> **Why our own copy instead of the market service's indicators?** The backtest
> engine must run on a plain array of candles with **no network calls** (so tests
> are instant and the engine is self-contained). The market service's indicators
> are for live serving; these are for offline replay. Small, intentional
> duplication buys us independence and speed.

## Part B — the strategy library (`engine/strategies.ts`)

A **strategy** is a class with a `generate(candles)` method that returns one signal
per candle. These are the market's famous strategies — our **benchmarks**. Every
future AI-generated strategy must beat these to earn its place.

### Buy & Hold — the baseline to beat

```ts
generate(candles) { return candles.map((_, i) => (i === 0 ? "BUY" : "HOLD")); }
```

Buy on the first candle, never sell. This is the return you'd get by doing
*nothing* clever. **If a strategy can't beat Buy & Hold, it's not worth using** —
which is exactly why it's our number-one benchmark.

### SMA / EMA crossover — trend following

```ts
const f = fastMa[i], s = slowMa[i];
if (f === null || s === null) return "HOLD";
return f > s ? "BUY" : "SELL";
```

Idea: when the **fast** average is above the **slow** average, price is trending up
→ hold the coin. When it drops below → get out. Classic trend-following. EMA
crossover is the same idea with faster-reacting averages.

### RSI reversion — mean reversion

```ts
if (v < this.low)  return "BUY";   // oversold → expect a bounce up
if (v > this.high) return "SELL";  // overbought → expect a pullback
return "HOLD";
```

Idea: prices that overshoot tend to snap back. Buy when RSI says "oversold" (<30),
sell when "overbought" (>70). This is the **opposite** philosophy to trend
following — and that's the point: **different strategies win in different markets**,
which is why we keep a whole library instead of one favourite.

### The factory

```ts
export function createStrategy(name, params = {}) {
  switch (name) { case "sma_crossover": return new SmaCrossover(params.fast, params.slow); ... }
}
```

- Lets the API build a strategy from a **name + params** sent in a request, e.g.
  `{"strategy":"sma_crossover","params":{"fast":20,"slow":50}}`.
- Unknown names throw a clear error instead of silently doing nothing.
- `BENCHMARK_STRATEGIES` lists them all, so the "run everything and rank" endpoint
  knows the full field.

> **Better options / future:** these are simple, well-known strategies on purpose —
> they're the *measuring stick*. The clever, optimised strategies come later (in the
> AI service) and will be **scored against exactly these**.

Next: the [engine](03-the-backtest-engine.md) that turns signals into money.
