# 3. The Backtest Engine (`engine/backtest-engine.ts`)

This is the heart (story **S12.1**). It takes the candles and the strategy's
signals and **pretends to trade**, bar by bar, producing: the list of completed
**trades** and the **equity curve** (our money over time).

## The trading model: all-in / all-out spot

We keep it simple and directly comparable to Buy & Hold:

- When the signal says **BUY** and we're in cash → put **all** our cash into the
  coin (minus fee).
- When the signal says **SELL** and we're holding → sell **everything** back to
  cash (minus fee).
- Otherwise do nothing.

So we're always either 100% coin or 100% cash. (Real strategies later can size
positions more cleverly; for benchmarking, all-in/all-out is the fair standard.)

## Walking through the code

```ts
let cash = initialCapital;   // start with e.g. 10,000
let units = 0;               // how much coin we hold
let inPosition = false;
```

Then for each candle we look at its **close** price and the signal:

```ts
if (!inPosition && signal === "BUY") {
  entryCost = cash;                 // remember what we spent (for pnl)
  const afterFee = cash * (1 - fee);
  units = afterFee / price;         // buy as much coin as the cash allows
  cash = 0; inPosition = true; entryPrice = price; entryTime = candle.openTime;
}
```

- **`entryCost = cash`** — we remember the cash we put in, so later we can compute
  the trade's profit % exactly.
- **`afterFee = cash * (1 - fee)`** — the fee is taken out *before* buying, so we
  get slightly less coin. Realistic.
- **`units = afterFee / price`** — turn cash into coin at this candle's price.

```ts
else if (inPosition && signal === "SELL") {
  const proceeds = units * price * (1 - fee);   // sell all, fee again
  trades.push(makeTrade(entryTime, entryPrice, candle.openTime, price, entryCost, proceeds, i - entryIndex));
  cash = proceeds; units = 0; inPosition = false;
}
```

- Selling turns coin back into cash, minus the fee again.
- We record a **completed trade**: when we bought, when we sold, and the profit %.

```ts
equityCurve.push(cash + units * price);   // every candle, mark our worth
```

- **Mark-to-market:** each candle we record our total worth = cash + (coin × current
  price). This line builds the equity curve we later measure risk from.

## Closing at the end

```ts
if (inPosition && candles.length > 0) {
  // sell at the last candle so the trade list is complete
}
```

If we're still holding coin when history ends, we **sell at the last price** so
every trade has an ending and the stats are complete. (Otherwise a great-looking
open position would never be counted.)

## Computing a trade's profit

```ts
const pnlPct = entryCost > 0 ? ((proceeds - entryCost) / entryCost) * 100 : 0;
```

Profit % compares the cash we got back (`proceeds`) to the cash we put in
(`entryCost`). Because both fees are already baked into those numbers, this profit
is **after costs** — the honest figure.

## Why this design?

- **Pure function:** `runBacktest(candles, signals, options)` takes inputs and
  returns a result — no database, no network. That makes it fast and **easy to
  test** (our `engine.spec.ts` feeds tiny price series and checks the money).
- **Signals separate from execution:** the strategy only decides BUY/SELL/HOLD; the
  engine handles money, fees, and bookkeeping. This split means we can swap in any
  strategy (including future AI ones) without touching the engine.

> **A better option we deferred:** intrabar stop-loss / take-profit (exiting
> mid-candle when price hits a level). It's more realistic but needs high/low
> handling and careful anti-cheating. For V1 benchmarking we act on the close;
> stops are a documented next step.

## Update — risk management & position sizing (S10.3, added later) 🛡️

The "next step" above is now here. The engine gained **optional** risk controls
(all off by default, so everything above still holds). Good risk management is
often what separates a survivable strategy from a blown-up one.

- **Stop-loss** — cut a loser automatically. Either a fixed percent
  (`stopLossPct`, e.g. 5%) or **volatility-based** (`atrMult` × ATR — a wider stop
  when the market is choppy, tighter when calm; the doc recommends ~2 × ATR).
- **Take-profit** — lock in a winner at a **risk:reward** multiple of the stop
  distance (`takeProfitRR`, e.g. 2 means aim to make twice what you'd risk).
- **Position sizing** (`riskPerTradePct`) — instead of going all-in, only risk a
  fixed slice of equity per trade (e.g. 1%). Size = riskAmount ÷ stop distance, so
  a wider stop → smaller position. This is **the** classic way pros control risk.

Now exits are checked **intrabar** using each candle's low/high (stop first, then
take-profit, then the strategy's own SELL signal — stop has priority, the
conservative choice). We never enter and stop on the same bar.

```ts
if (options.riskPerTradePct != null && stopDistance > 0) {
  const riskAmount = cash * options.riskPerTradePct;     // e.g. 1% of equity
  const sized = (riskAmount * price) / stopDistance;      // fewer units if stop is wide
  spend = Math.min(cash, sized);                          // never more than we have
}
```

**Verified live** on BTC 4h (same EMA-cross strategy): adding a **2×ATR stop, 2:1
take-profit, and 1%/trade sizing** cut the **max drawdown from 10.2% to 4.7%** (more
than half) and reduced the loss from −5.5% to −2.9%. Less pain, smaller losses —
exactly what risk management is for. The generator (`POST /backtests/generate`) can
apply the same `risk` profile to every candidate.

Next: turning trades + equity into a verdict — [metrics](04-performance-metrics.md).
