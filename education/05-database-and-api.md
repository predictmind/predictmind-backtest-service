# 5. Database & API

Now we connect the pure engine to the outside world: **get candles**, **save
results**, and **serve endpoints**.

## Getting candles from the market service (`market/market-client.service.ts`)

The backtest engine needs price history — but that data belongs to the **market
service**. Following our rule "each service owns its data," we don't reach into the
market database; we **ask over HTTP** (an **east-west** call):

```ts
const url = `${baseUrl}/api/v1/market/candles?symbol=BTC&timeframe=1h&limit=500`;
const res = await fetch(url, { signal: controller.signal });   // 10s timeout
const raw = await res.json();
return raw.map((c) => ({ openTime: new Date(c.openTime), open: Number(c.open), ... }))
         .sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
```

- The market service returns numbers as **strings** (from its exact Decimal
  columns), so we convert them with `Number(...)`.
- We **sort ascending by time** so the engine always walks history forwards — never
  assume the other service's order; make it correct here.
- A 10-second **timeout** (AbortController) stops us hanging if the market service
  is slow.

## The tables (`prisma/schema.prisma`)

Three tables in our own `backtest` schema:

- **`backtests`** — one row per run: which coin/timeframe/strategy/params, how many
  candles, the time range, and status.
- **`backtest_results`** — the metrics for a run (one-to-one with a backtest). All
  numbers are `Decimal` for exactness.
- **`backtest_trades`** — every simulated trade (the **S12.3 trade log**): entry/
  exit time and price, profit %, and how many bars it lasted.

```prisma
model Backtest {
  id String @id @default(uuid()) @db.Uuid
  result BacktestResult?      // one-to-one
  trades BacktestTrade[]      // one-to-many
  ...
}
```

- **`onDelete: Cascade`** on the children means deleting a backtest cleans up its
  result and trades automatically — no orphans.
- We store `params` as **`Json`** because different strategies have different
  parameters (`{fast,slow}` vs `{period,low,high}`). JSON keeps it flexible.

## Saving a run (`backtest/backtest.service.ts`)

`execute(...)` runs the engine and then writes everything in **one** Prisma
`create` using nested writes:

```ts
await this.prisma.backtest.create({
  data: {
    coinSymbol, timeframe, strategyName, params, ...,
    result: { create: { netProfitPct, winRate, sharpe, ... } },  // nested
    trades: { create: run.trades.map((t) => ({ entryTime, exitTime, pnlPct, ... })) },
  },
});
```

- **Nested `create`** saves the backtest, its metrics, and all its trades together
  — one clean operation, no half-saved data.

## The endpoints (`backtest/backtest.controller.ts`)

| Method | Path | Does |
| --- | --- | --- |
| POST | `/backtests` | Run one strategy → metrics (and save it) |
| POST | `/backtests/benchmark` | Run **all** benchmark strategies and **rank** them |
| GET | `/backtests` | List recent runs |
| GET | `/backtests/:id` | One run + its metrics |
| GET | `/backtests/:id/results` | Just the metrics |
| GET | `/backtests/:id/trades` | The trade log |

The star is **`/backtests/benchmark`** — it runs every strategy on the same candles
and returns them **sorted by net profit**. That's the "beat the field" view from our
methodology: instantly see whether an idea beats Buy & Hold and the rest.

- Inputs are checked by a **DTO** with `class-validator` (symbol/timeframe are
  strings, `limit` is 10–5000) so bad requests are rejected cleanly.
- `POST` returns `200 OK` (not `201`) because it's "run a computation," not "create
  a thing to hand back."

## Update — the live "current signal" endpoint (added later)

Later we added **`POST /backtests/signal`** for **live/paper trading**. A backtest
replays a whole history; a *bot* trading live only needs one thing: **"given the
latest candles, what does this strategy say to do right now?"**

```ts
// backtest.service.ts
async signal(symbol, timeframe, strategyName, params, rules, limit = 400) {
  const candles = await this.market.getCandles(symbol, timeframe, limit);
  const strategy = createStrategy(strategyName, params, rules);
  const signals = strategy.generate(candles);      // BUY/SELL/HOLD per candle
  const last = candles.length - 1;
  return { symbol, timeframe, signal: signals[last] ?? "HOLD",
           price: candles[last].close, time: candles[last].openTime, candleCount: candles.length };
}
```

- **What/why:** it reuses the *exact same* strategy engine as a backtest, then just
  returns the **last** candle's signal plus the latest price. So a live bot and a
  backtest can never disagree about what a strategy means — one source of truth.
- **Who calls it:** the **paper service's strategy bot** (see the paper service's
  education) polls this every minute and buys/sells on its virtual account
  accordingly. That's how "test on the live market" is automated.
- **Note on the endpoint table above:** the service has grown more POST endpoints
  since (`/generate`, `/optimize`, `/optimize/walkforward`, `/portfolio`,
  `/portfolio/live`, and now `/signal`). They all follow the same pattern: a
  validated DTO in, a computed JSON result out, `200 OK`.

Next: [running it and the real test](06-running-and-testing.md).
