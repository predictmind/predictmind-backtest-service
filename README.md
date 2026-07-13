# predictmind-backtest-service

PredictMind **backtest** microservice — backtesting engine, performance metrics,
and benchmark comparison (Epic E12).

Part of the PredictMind platform (microservices architecture). Product and
architecture docs live in the private
[`predictmind/app`](https://github.com/predictmind/app) repo. Beginner-friendly
walkthroughs are in [`education/`](education/README.md).

## Tech stack

- NestJS + TypeScript
- Prisma → PostgreSQL (own `backtest` schema)
- Reads historical candles from the market service (east-west HTTP)
- Pure, tested backtest engine + metrics; **spot long/flat** only
- Default port `3006`, routed by the gateway under `/api/v1/backtests`

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/backtests` | Run one strategy (`{ symbol, timeframe, strategy, params?, limit? }`) |
| POST | `/api/v1/backtests/benchmark` | Run all benchmark strategies and rank them |
| GET | `/api/v1/backtests?limit=` | List recent backtests |
| GET | `/api/v1/backtests/:id` | A backtest + its metrics |
| GET | `/api/v1/backtests/:id/results` | A backtest's performance metrics |
| GET | `/api/v1/backtests/:id/trades` | A backtest's simulated trade log |
| GET | `/api/v1/health` | Health check |

Benchmark strategies: `buy_and_hold, sma_crossover, ema_crossover, rsi_reversion`.
Metrics: net profit, buy&hold, win rate, profit factor, max drawdown, Sharpe,
Sortino, expectancy, avg trade, trade count, final equity.

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL + MARKET_SERVICE_URL
npm install                   # also runs `prisma generate`
npm run prisma:migrate        # create tables (needs Postgres)
npm run start:dev
```

Interactive API docs (Swagger UI): `http://localhost:3006/api/docs`.

### Run with Docker (recommended)

Via the compose file in
[`predictmind-infra`](https://github.com/predictmind/predictmind-infra):

```bash
docker compose up --build postgres market backtest
```

The backtest service reaches the market service at `http://market:3003`. Import
candles first (`POST /market/import`) so there is history to backtest.

## Quality & security

CI (lint + test + build), CodeQL, and Dependabot run on every push and PR.

## License

Proprietary — © PredictMind. All rights reserved.
