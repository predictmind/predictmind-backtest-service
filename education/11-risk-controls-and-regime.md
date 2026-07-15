# 11. Risk Controls and the Market-Flow Regime Filter

A good entry is only half the job. The other half — the half that keeps you alive —
is **risk management**: when to *not* trade, when to cut a loss, when to lock in a
win, and when to step aside. This lesson covers the protective controls we added to
the engine (`src/engine/backtest-engine.ts`) and the optimizer.

## The big one: the market-flow regime filter

**The rule:** *don't buy when the market is falling.* We trade **spot only** — we
can only make money when price goes **up**. In a downtrend the smartest long-only
move is to **sit in cash and wait**. (Selling short to profit from a fall is a
future, non-spot feature.)

So we gate every entry with a **regime** check — a trade is only allowed when:
1. **BTC** (the market leader) is above its 200-period average — the *whole market*
   is healthy, **and**
2. the **coin itself** is above its own 200-period average — this coin is trending up.

```ts
const REGIME_CONDS = [
  { type: "btc_trend", period: 200, dir: "above" },              // market is up
  { type: "ma", kind: "sma", fast: 1, slow: 200, op: "gt" },     // coin is up
];
// every entry becomes: [ ...the original triggers, ...REGIME_CONDS ]
```

When the market is bearish, both are false everywhere → **no trades** → the
strategy holds cash.

> **Why this matters, in one number.** In a test year where the market fell **−54%**,
> the strategy *without* this filter lost −21%; *with* it, the strategy sat out most
> of the crash and finished at **−2% (basically flat)**. It turned a losing year into
> a break-even one purely by refusing to fight the tide. This was the single most
> valuable idea in the whole project.

## Trailing stop — let winners run, but protect them

A fixed take-profit caps your gain. A **trailing stop** instead follows the price up:
once you're in profit, the stop rises to stay a fixed % below the highest price seen.
You keep riding as long as it climbs, and exit automatically when it pulls back.

```ts
if (candle.high > highSinceEntry) highSinceEntry = candle.high;   // track the peak
let effStop = stopPrice;
if (options.trailingStopPct != null) {
  const trail = highSinceEntry * (1 - options.trailingStopPct);   // 5% below the peak
  effStop = effStop != null ? Math.max(effStop, trail) : trail;   // never lower the stop
}
if (candle.low <= effStop) closePosition(effStop, ...);           // trailing exit
```

- **`Math.max`** means the stop only ever moves **up**, never down — you can give
  back a little from the top, but you lock in most of the gain.

## Time-based exit — no dead money

If a trade just drifts sideways for weeks, it ties up capital that could be working
elsewhere. `maxHoldBars` force-closes a position after N candles.

```ts
else if (options.maxHoldBars != null && i - entryIndex >= options.maxHoldBars) {
  closePosition(price, candle.openTime, i - entryIndex, i);  // time's up, move on
}
```

## Cooldown — no revenge trades

Right after a stop-loss, the same setup often re-fires and stops you out **again**
(a "whipsaw"). `cooldownBars` blocks new entries for a few candles after any exit.

```ts
const cooldownOk = i - lastExitIndex >= (options.cooldownBars ?? 0);
if (!inPosition && signal === "BUY" && cooldownOk) { /* enter */ }
```

## Robustness selection — pick a strategy that has *lasted*

The most dangerous mistake is picking the config with the single best score on the
past — it's usually a one-off fluke. Instead, **robustness selection** splits the
training data into 4 sub-periods and keeps the config that was **profitable in the
most of them**:

```ts
// for each candidate, across 4 train sub-periods:
if (subMetrics.profitFactor >= 1) profitableSubs++;
// rank by (profitableSubs / activeSubs) — consistency, not peak
```

A strategy that worked in 2021, 2022, **and** 2023 separately is far likelier to
survive next year than one that only shone once. This is our anti-overfitting spine.

## Position sizing (already in the engine)

`riskPerTradePct` risks a fixed % of the account per trade, sizing the position from
the stop distance — so one bad trade can never do outsized damage.

## How it all combines

The optimizer applies these as a bundle to every candidate it tests:

```ts
{ stopLossPct, takeProfitRR, trailingStopPct, maxHoldBars, cooldownBars }
// entries additionally gated by the regime filter
```

The payoff (out-of-sample, a mixed bull+bear year): adding these controls took the
result from **−13% → −5%**, cut the worst drawdown from **17% → 5%**, and turned
several coins genuinely profitable (ETH +28%, BNB +22%). Protection first, profit
second.

Next: putting coins together and validating honestly — [12-portfolio-and-honest-validation.md](12-portfolio-and-honest-validation.md).
