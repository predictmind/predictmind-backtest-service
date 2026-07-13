# 📚 PredictMind Backtest Service — Learn It Like You're 10

This service is the platform's **time machine and referee**. It takes a trading
idea (a "strategy"), replays it against **real past prices**, and measures exactly
how it would have done — profit, wins, losses, and risk. Then it compares your
strategy against the market's famous strategies to see if yours is actually any
good.

These notes are your textbook. Read in order; each explains **what** the code does,
**how** to write it, **why** we did it this way, and what **other options** exist.

> New to *server, API, database, Prisma, module, DTO, Docker*? The auth and market
> service notes teach those. This folder focuses on **backtesting**.

## What this service does

1. **Gets** past candles from the market service.
2. **Runs** a strategy over them, pretending to buy and sell (spot only).
3. **Measures** the result with proper finance metrics.
4. **Compares** it against a library of well-known strategies (the "beat the field"
   test), and **saves** everything (the run, its metrics, every trade).

```text
 market service            backtest service (port 3006)
 ┌────────────┐  candles  ┌─────────────────────────────────────┐  saves  ┌──────────┐
 │ /market/   │ ────────▶ │ strategy → engine → metrics → rank  │ ──────▶ │ Database │
 │  candles   │           └─────────────────────────────────────┘         │(backtest)│
 └────────────┘                        │ serves                            └────┬─────┘
                                        ▼                                        │
      POST /backtests, /backtests/benchmark, GET /backtests/:id(/results|/trades)┘
```

## Read in order

| # | File | What you'll learn |
| --- | --- | --- |
| 1 | [01-what-is-backtesting.md](01-what-is-backtesting.md) | What backtesting is, spot long/flat, fees, and the traps to avoid |
| 2 | [02-indicators-and-strategies.md](02-indicators-and-strategies.md) | SMA/EMA/RSI helpers and the benchmark strategy library |
| 3 | [03-the-backtest-engine.md](03-the-backtest-engine.md) | The engine that turns signals into trades + an equity curve |
| 4 | [04-performance-metrics.md](04-performance-metrics.md) | Net profit, win rate, profit factor, drawdown, Sharpe/Sortino, expectancy |
| 5 | [05-database-and-api.md](05-database-and-api.md) | Storing runs, the market client, and the endpoints |
| 6 | [06-running-and-testing.md](06-running-and-testing.md) | Running it in Docker and the real end-to-end test |
| 7 | [07-glossary.md](07-glossary.md) | Dictionary of every backtesting word |

Start with [01-what-is-backtesting.md](01-what-is-backtesting.md). 🚀
