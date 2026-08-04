# 6. Running It & Testing It for Real

## Dockerfile (same Prisma pattern as the others)

This service uses Prisma, so its `Dockerfile` copies the `prisma` folder **before**
installing (so `prisma generate` works), runs as the non-root `node` user, and
exposes port **3006** — the same pattern proven in the market and news services.

## Running with docker compose

From `predictmind-infra`:

```bash
docker compose up --build postgres market backtest
```

- Brings up the database, the **market** service (our candle source), and the
  **backtest** service together on one network.
- The backtest container reaches the market service at **`http://market:3003`** (the
  service name, set via `MARKET_SERVICE_URL`) — not `localhost`.
- On a fresh database, apply the schema first: `prisma db push` / `migrate deploy`.

## The order that matters

1. Database up.
2. Apply the backtest schema.
3. Make sure the market service **has candles** (import some:
   `POST /market/import {symbol:"BTC", timeframe:"1h", limit:500}`). A backtest with
   no data can't measure anything, so the service returns a clear "not enough
   candles" error rather than pretending.

## The real end-to-end test ✅

Live, against the containers with **real** imported BTC 1h candles:

**`POST /backtests/benchmark {symbol:"BTC", timeframe:"1h", limit:500}`** ranked the
whole library on identical data:

| Strategy | Net % | Buy&Hold % | Win % | Profit factor | Max DD % | Trades |
| --- | --- | --- | --- | --- | --- | --- |
| rsi_reversion | -0.49 | -2.84 | 33 | 0.90 | 7.5 | 3 |
| ema_crossover | -1.68 | -2.84 | 22 | 0.78 | 4.9 | 9 |
| sma_crossover | -1.86 | -2.84 | 40 | 0.77 | 5.7 | 5 |
| buy_and_hold | -3.04 | -2.84 | 0 | 0 | 11.1 | 1 |

Reading it: over this window BTC drifted **down ~2.8%**, so *every* approach lost or
roughly matched — but the active strategies **lost less than buying and holding**,
and did so with **smaller drawdowns**. That's exactly the kind of comparison the
platform is built to make. (Different windows/regimes will crown different winners —
which is the whole point of keeping a library.)

Then:
- **`POST /backtests`** (sma_crossover 20/50) returned full metrics + an `id`.
- **`GET /backtests/:id/results`** read the saved metrics back.
- **`GET /backtests/:id/trades`** returned the trade log (entry/exit times, prices,
  pnl %, bars held).

## Automated tests

`engine/engine.spec.ts` (12 tests) covers the **pure** core — indicators, the
engine (profit on a rising market, no trades when never signalled, a completed
buy→sell trade), and metrics (drawdown, win rate, annualisation). Pure functions
make these fast and rock-solid. Build + lint + tests are green in CI on every push.

> **Why not test the market fetch in CI?** It needs the market service running, so
> that's a live/integration check (done by hand above). The *logic* — the part that
> could be wrong — is the engine and metrics, and those are fully unit-tested.

Next: the [glossary](07-glossary.md).
