# 13. More Indicators, and Two Strategies: DAILY vs LONG

Up to now we had one growing toolbox of indicators and one search that tried to
find *a* good strategy. In this step we did two things the owner asked for:

1. **Add more tools to the toolbox** — three new indicators: **VWAP**, **Keltner
   Channels**, and a **Stochastic** mean-reversion — plus a *wider* search (more RSI
   thresholds, more moving-average pairs, more band widths).
2. **Split the goal into two strategies** — a **DAILY** one (trades often, on the
   15-minute chart) and a **LONG** one (trades rarely, on the 1-day chart, to ride
   the big moves).

Everything here is on **SOL** (Solana), the one coin the owner picked to specialise
in.

---

## Part A — the three new indicators

### A1. VWAP (Volume-Weighted Average Price)

**What it is.** A normal moving average treats every candle the same. VWAP does
not: it gives **more weight to candles where lots of coins changed hands**. So VWAP
tells you the price where *most of the real business* happened. If price is **above**
VWAP, buyers have been in control; **below**, sellers have.

**How we wrote it** (`src/engine/indicators.ts`, function `vwap`). For each candle we
take its **typical price** = (high + low + close) ÷ 3, multiply by that candle's
**volume**, and keep a rolling sum over the last `period` candles. VWAP = (sum of
price×volume) ÷ (sum of volume).

```ts
const typical = (c.high + c.low + c.close) / 3;
pv.push(typical * v);   // price × volume
vol.push(v);            // volume
pvSum += pv[i]; volSum += vol[i];
if (i >= period) { pvSum -= pv[i - period]; volSum -= vol[i - period]; } // slide window
out.push(volSum > 0 ? pvSum / volSum : typical);
```

- **Why a rolling window** (last N candles) instead of the usual "since the start of
  the day"? Our engine just gets a plain list of candles with no idea where a day
  begins. A rolling window needs no day boundaries, so it works on any timeframe.
- **Why build with `push`** and slide the window (add the new, subtract the oldest)?
  Two reasons: it's fast (no re-adding N numbers every candle), and it avoids
  writing `out[i] = …` with an index that comes from data — which our security
  scanner (CodeQL) flags. Every indicator in this file follows the same `push` rule.

### A2. Keltner Channels

**What it is.** A "lane" drawn around price. The **middle** line is an EMA of the
close; the **upper/lower** lanes sit a multiple of **ATR** (average candle size)
above and below. It's a close cousin of **Bollinger Bands** — the difference is
Bollinger measures width with *standard deviation* (how scattered closes are) while
Keltner measures it with *ATR* (how big candles actually are). A close **below the
lower** lane = price stretched down (possible bounce); **above the upper** = a strong
breakout / overextended.

**How we wrote it** (`keltner` in `indicators.ts`): reuse the `ema` and `atr` helpers
we already had, then push `middle ± mult × atr`.

```ts
const middle = ema(closes, period);
const atrArr = atr(candles, period);
upper.push(m + mult * a);
lower.push(m - mult * a);
```

- **Why reuse `ema` and `atr`** instead of writing new maths? Less code = fewer bugs,
  and those two are already unit-tested. A "better option" would be a dedicated ATR
  smoothing (Wilder's) inside Keltner, but our simple ATR is plenty for a filter.

### A3. Stochastic mean-reversion (a new *use* of an old tool)

We already had `stochasticK` (where the close sits inside the recent high-low range,
0–100). We didn't add new maths — we added new **strategies that use it** (see Part
B): buy when %K is very low (oversold), sell when very high.

### Wiring them into the rule language

A strategy in PredictMind is a **rule spec** — a little JSON of conditions. To let
strategies *use* the new tools, we added three new condition types to the `Condition`
list in `src/engine/rule-strategy.ts`, and a matching `case` for each in
`conditionSeries` (the function that turns one condition into a true/false for every
candle):

- `{ type: "keltner", side: "below_lower" | "above_upper" }`
- `{ type: "vwap", op: "gt" | "lt" }` — price above/below VWAP
- (Stochastic reuses the existing `{ type: "indicator", name: "stoch_k", … }`.)

Each `case` just calls the indicator and compares, e.g. for VWAP:

```ts
const vw = vwap(candles, cond.period ?? 20);
return candles.map((c, i) => {
  const v = vw[i];
  if (v === null) return false;         // not enough history yet → no signal
  return cond.op === "gt" ? c.close > v : c.close < v;
});
```

**Why `null` → `false`?** Early candles don't have enough history to compute the
indicator. Returning `false` (no signal) there is the safe, honest choice — never
guess a value you don't have.

### A wider search space

In `src/generator/candidate-space.ts` we added more **bases** (starting strategies)
and one new **gate** (an extra filter you can bolt on):

- More RSI reversion thresholds (added 20/80 and 40/60).
- More EMA-cross pairs (8/34, 13/48).
- Bollinger at two band widths (2 and 2.5).
- New **`keltner_reversion`** and **`stoch_reversion`** bases.
- A **`stoch_pullback`** base (oversold %K but only in an uptrend).
- A new **`above_vwap`** regime gate (only buy when price is above VWAP).

The generator automatically tries every base × gate × risk-preset combination, so
just by adding these lines the search got meaningfully wider — without touching the
search engine itself.

---

## Part B — DAILY vs LONG (why one strategy can't do both)

The owner wants **daily profits** *and* to **catch the big bull runs**. Those are two
different jobs, and — honestly — **one strategy can't do both well**. Here's why, and
what we built for each.

### The unavoidable trade-off

- To **win most of your trades**, you take a **small, quick profit** and a **tight
  stop**. That means you must be **picky**, so you trade **rarely**.
- To **catch a 3× bull run**, you must **hold for weeks** and accept that **most
  breakouts fizzle** (low win rate), but the rare winner is **huge**.

You can have a high *win rate* or big *runners*, not both in the same setup. So we
built **two** strategies, each honest about its job.

### The DAILY strategy (15-minute chart)

**Idea:** in an uptrend, buy small dips and take small, quick gains — many times.

- **Entry (all must be true):** EMA50 > EMA200 (uptrend) **and** RSI-14 < 50 (a mild
  dip) **and** price above its 7-day average (`SMA(672)` on 15m — a "don't trade in a
  downtrend" filter).
- **Exit:** RSI-14 climbs back above 65, **or** a 3% trailing stop, **or** a 2%
  hard stop-loss (whichever comes first).

**Real result** (last ~5,000 fifteen-minute candles ≈ 52 days):

| Measure | Value |
| --- | --- |
| Net profit | **+13.8%** in ~52 days |
| Win rate | **64.6%** |
| Profit factor | 1.45 |
| Trades | **48** (about one a day) |
| Max drawdown | **7.0%** (small) |
| Sharpe | 3.0 (strong risk-adjusted) |

That's a genuine "daily" cadence with tight risk. It roughly matches buy-and-hold's
return over the same window (+14.5%) **but with far less stomach-churn** (7%
drawdown), which is the point of an active strategy.

### The LONG strategy (1-day chart) — the big-run catcher

**Idea:** buy strength, ride it, and let a wide trailing stop keep you in for weeks.

- **Entry (all must be true):** price breaks to a **new 100-day high** (Donchian
  breakout) **and** BTC is above its own 100-day average (the whole market is
  healthy).
- **Exit:** a **25% trailing stop** (give the trend room to breathe).

**Real result** (SOL 1-day, ~5.5 years):

| Measure | Value |
| --- | --- |
| Net profit | **+257%** (₹10,000 → ₹35,660) |
| Win rate | 44% (low — as expected) |
| Profit factor | **6.85** (winners dwarf losers) |
| Trades | 9 (rare) |
| Max drawdown | 41% (big — the cost of holding through wobbles) |

The **low win rate but huge profit factor** is exactly the big-run profile: many
small false-breakout losses, a few enormous winners (it caught SOL's 2023 run of
~+200%).

### The honest catch (very important)

Over this exact SOL window, simply **buying and holding** SOL returned **+2,150%** —
far more than our +257%. Why keep the strategy then? Because:

1. Buy-and-hold also suffered **enormous** drops along the way; our LONG strategy's
   job is to **sidestep the worst downtrends** (it sits in cash when BTC is weak).
2. A single coin that happened to 20× is not a plan you can trust *forward*. The same
   breakout+regime rule applied across **many** coins is what protects capital in the
   ones that *don't* moon (see step 12's portfolio results).
3. This is the same lesson as every earlier step: **no mechanical rule reliably beats
   holding a coin that only went up** — the edge is **risk control and
   diversification**, not magic entries.

### What the wider search told us (walk-forward, out-of-sample)

We re-ran the walk-forward optimiser (re-tune each window, judge on the next unseen
window) with the new indicators included:

- **1h, win-rate objective:** 92% win rate across windows — but only ~13 trades
  (still picky). Our new **`above_vwap`** gate got picked in one window, proving the
  new tools are wired in and useful.
- **1d:** ~38% win rate, few trades — confirms 1-day is for *runners*, not win rate.
- **15m, win-rate objective:** the tune-then-test pick barely traded and lost —
  proving again that **chasing a high win rate with fixed take-profit/stop exits on
  15m does not generalise**. The DAILY strategy above works because it exits on a
  *signal* (RSI back up) plus a trailing stop, not a rigid target.

**Bottom line:** more indicators widened the search and gave us cleaner filters, but
they did **not** unlock a secret 90%-win, high-profit money machine — because one
doesn't exist out-of-sample. What they *did* give us is two clear, honest, separately
tuned strategies: a **steady DAILY** one and a **big-run LONG** one.

Next: the [glossary](14-glossary.md).
