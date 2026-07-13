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

Next: [running it and the real test](06-running-and-testing.md).
