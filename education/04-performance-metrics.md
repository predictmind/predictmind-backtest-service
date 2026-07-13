# 4. Performance Metrics (`engine/metrics.ts`)

A pile of trades and an equity curve don't mean much until we **measure** them.
This is story **S12.2** — turning a run into the numbers that decide if a strategy
is good, and whether it **beats Buy & Hold**.

## The metrics, in plain words

- **Net profit %** — how much our money grew or shrank overall. The headline.
- **Buy & Hold %** — what you'd have made by just buying and holding. Our strategy
  must beat this to be worth the effort.
- **Win rate %** — of all completed trades, how many made money.
- **Profit factor** — total winnings ÷ total losses. Above 1 = profitable; 2 =
  won twice as much as lost.
- **Max drawdown %** — the worst peak-to-valley drop in our money. This is the
  "how scary was it / how much pain would you feel" number.
- **Sharpe ratio** — return compared to how bumpy the ride was (risk-adjusted).
  Higher = smoother profit.
- **Sortino ratio** — like Sharpe but only counts *downward* bumps (because upside
  swings aren't "risk" you mind).
- **Expectancy %** — the average profit you can expect per trade.
- **Trades count / avg trade %** — how busy, and how good the average trade was.

## Key pieces of code

### Max drawdown

```ts
let peak = -Infinity, worst = 0;
for (const equity of equityCurve) {
  if (equity > peak) peak = equity;          // new high-water mark
  if (peak > 0) worst = Math.max(worst, (peak - equity) / peak);
}
return worst * 100;
```

- Walk the equity curve, always remembering the highest point so far (**peak**).
- At each step, how far below the peak are we? The biggest such drop is the max
  drawdown. Real people quit strategies during big drawdowns — so this number
  matters as much as profit.

### Profit factor (careful with divide-by-zero)

```ts
const profitFactor = grossLoss > 0 ? grossWin / grossLoss
                   : grossWin > 0 ? grossWin : 0;
```

- If there were **no losses**, we can't divide by zero, so we fall back sensibly.
  Always guard divisions in finance code — markets produce weird edge cases.

### Sharpe & Sortino (risk-adjusted, annualised)

```ts
const rets = periodReturns(equityCurve);      // % change each candle
const sd = stdDev(rets, avgRet);              // how bumpy
const ann = Math.sqrt(periodsPerYear(timeframe));
const sharpe = sd > 0 ? (avgRet / sd) * ann : 0;
```

- **Returns** = the percent change of our equity each candle.
- **Standard deviation** measures how much those returns wobble (risk).
- Sharpe = average return ÷ wobble, then **annualised** by multiplying by the
  square root of how many candles are in a year (`periodsPerYear`). That last part
  puts a 1-hour strategy and a 1-day strategy on the **same yearly scale** so they
  can be compared fairly.
- **Sortino** does the same but only measures *downside* wobble — because gains
  aren't the risk you care about.

```ts
export function periodsPerYear(timeframe) {
  return { "1h": 8760, "4h": 2190, "1d": 365, ... }[timeframe] ?? 365;
}
```

- 1 hour → 8,760 candles/year; 1 day → 365. This is what makes annualisation
  correct for each timeframe.

### Guarding every number

```ts
function round(value, dp = 4) { if (!Number.isFinite(value)) return 0; ... }
```

- Finance math can produce `NaN` or `Infinity` (e.g. 0 trades, no wobble). We turn
  those into a clean `0` so the API never returns junk. Defensive on purpose.

## The honest reminder

These metrics are computed on **past** data. A dazzling backtest can still be
**overfit** (memorised the past). That's why our methodology promotes a strategy
only if it wins **out-of-sample** and across market regimes. Metrics are the
scoreboard; robustness testing is the real referee.

Next: saving runs and exposing them — [database & API](05-database-and-api.md).
