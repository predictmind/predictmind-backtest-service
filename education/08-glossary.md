# 8. Glossary (the dictionary)

Backtesting words used in these notes. General coding words (server, API, database,
Prisma, module, controller, service, DTO, decorator, Docker, port, CI, east-west
call, fetch, timeout) are defined in the auth, market, and news glossaries:
- [auth glossary](../../predictmind-auth-service/education/09-glossary.md)
- [market glossary](../../predictmind-market-service/education/08-glossary.md)
- [news glossary](../../predictmind-news-service/education/08-glossary.md)

| Word | Simple meaning |
| --- | --- |
| **Backtest** | Replaying a strategy over past prices to see how it would have done. |
| **Strategy** | A rule that outputs BUY/SELL/HOLD for each candle. |
| **Signal** | One BUY/SELL/HOLD decision on a candle. |
| **Spot** | Buying a coin with cash and later selling it (no shorting/leverage). |
| **Long / flat** | Holding the coin / holding cash. Our only two states. |
| **Trade** | One completed buy-then-sell. |
| **Equity curve** | Your total money plotted over time. |
| **Mark-to-market** | Valuing what you hold at the current price, each candle. |
| **Fee** | Small cost per buy/sell (we use 0.1% per side). |
| **SMA / EMA** | Simple / Exponential Moving Average (trend smoothers). |
| **RSI** | 0–100 momentum gauge; <30 oversold, >70 overbought. |
| **MACD** | Gap between a fast and slow EMA + a signal line — momentum. |
| **Bollinger Bands** | A moving average with bands set a few std-devs above/below. |
| **ATR** | Average True Range — typical candle move size (volatility). |
| **Stochastic %K** | Where the close sits in the recent high-low range (0-100). |
| **Standard deviation** | How spread out numbers are (used for bands and risk). |
| **Crossover** | When a fast average crosses above/below a slow one. |
| **Mean reversion** | Betting overshoots snap back (RSI strategy). |
| **Trend following** | Betting moves continue (crossover strategies). |
| **Candlestick pattern** | A candle shape traders read as a hint (hammer, engulfing...). |
| **Body / wick** | The thick part / the thin lines of a candle. |
| **Doji** | Tiny-body candle — indecision. |
| **Hammer / shooting star** | Long-wick reversal candles (bullish / bearish). |
| **Engulfing** | A candle whose body wraps the previous one (bullish/bearish). |
| **Morning / evening star** | Three-candle bullish / bearish reversal patterns. |
| **Rule spec** | JSON describing entry/exit conditions (indicators + patterns). |
| **Order-flow** | Who's aggressive: volume bought by takers vs total volume. |
| **Taker buy volume** | The part of a candle's volume from aggressive market buys. |
| **Buy ratio** | takerBuyVolume ÷ volume (>0.5 = net buying pressure). |
| **Funding rate** | Perp-futures crowd-positioning gauge (signal only; we trade spot). |
| **Alignment (two-pointer)** | Matching an 8h funding series to each candle by time, efficiently. |
| **Condition group** | A set of conditions combined with "all" or "any". |
| **RuleStrategy** | A strategy built from a rule spec — the AI generator's output format. |
| **Benchmark** | A known strategy we compare against (must beat Buy & Hold). |
| **Net profit %** | Overall money gained/lost. |
| **Win rate** | Share of trades that made money. |
| **Profit factor** | Total wins ÷ total losses (>1 is profitable). |
| **Drawdown** | Peak-to-valley drop in equity — the "pain" measure. |
| **Sharpe ratio** | Return per unit of total wobble (risk-adjusted). |
| **Sortino ratio** | Like Sharpe but only counts downside wobble. |
| **Expectancy** | Average profit expected per trade. |
| **Annualise** | Scale a short-timeframe number to a yearly basis for fair comparison. |
| **Look-ahead bias** | Cheating by using future data in a past decision — to avoid. |
| **Out-of-sample** | Data a strategy was NOT tuned on — the real test. |
| **Overfitting** | A strategy that memorised the past and fails on new data. |
| **Pure function** | Output depends only on input; no I/O — easy to test. |
| **Nested create (Prisma)** | Saving a row and its related rows in one operation. |

Back to the [index](README.md).
