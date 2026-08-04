# 14. Glossary (the dictionary)

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
| **Alignment (two-pointer)** | Matching a sparse signal series (funding/OI) to each candle by time, efficiently. |
| **Open interest (OI)** | Total size of open futures positions (conviction gauge; signal only). |
| **OI change** | Percent change of open interest over a lookback — rising = new money. |
| **Long/short ratio** | Share of futures accounts long vs short — contrarian crowd gauge (signal only). |
| **Fear & Greed Index** | Market-wide daily sentiment 0-100; contrarian (fear near bottoms, greed near tops). |
| **BTC context / btc_trend** | Whether BTC is above/below its own MA; a regime filter for alt trades. |
| **On-chain** | Blockchain-native data (active addresses, MVRV). |
| **Active addresses** | Daily active wallets — network usage; `active_addr_change` = its % change. |
| **MVRV** | Market cap ÷ realized cap valuation ratio (needs paid data — condition is future-ready). |
| **BTC dominance** | BTC's share of total crypto market cap (needs an external feed; optional). |
| **Condition group** | A set of conditions combined with "all" or "any". |
| **RuleStrategy** | A strategy built from a rule spec — the AI generator's output format. |
| **Benchmark** | A known strategy we compare against (must beat Buy & Hold). |
| **Strategy generator** | Searches many candidate strategies, ranks them, validates out-of-sample (E10). |
| **Candidate space** | All the strategies the generator tries (bases × filters). |
| **Train / test split** | Tune on an earlier slice, judge on a later unseen slice. |
| **In-sample / out-of-sample** | Data used to tune / data kept back for the honest test. |
| **Finalist** | A top-ranked candidate that then gets the out-of-sample test. |
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
| **Stop-loss** | An automatic exit that caps a losing trade (fixed % or ATR-based). |
| **Take-profit** | An automatic exit that locks in a gain at a risk:reward target. |
| **Risk:reward (RR)** | How much you aim to make vs risk (RR 2 = target twice the stop distance). |
| **Position sizing** | Choosing trade size so you risk only a fixed % of equity per trade. |
| **Intrabar exit** | Exiting mid-candle when price touches a stop/target (uses the candle's low/high). |
| **PredictScore** | A single 0-100 quality score blending 5-6 weighted factors. |
| **Grade** | A letter (A+/A/B/C/D) from the PredictScore. |
| **Confidence** | How much to trust a score — up with more trades, down with a big in/out-of-sample gap. |
| **Factor / weight** | One ingredient of PredictScore (e.g. drawdown 20%) and its share. |
| **Renormalise** | Rescale the remaining weights to sum to 100% when a factor (sentiment) is omitted. |
| **Walk-forward validation** | Testing the pick-a-strategy process on many consecutive unseen windows to get an honest success rate across market moods (E13). |
| **Anchored (expanding) window** | Walk-forward where the training block always starts at the beginning and grows each fold. |
| **Fold / window** | One train-then-test step in walk-forward; each test window is later, unseen data. |
| **Beat-Buy&Hold rate** | Share of walk-forward windows where the pick did better than simply holding the coin — our headline success metric for spot. |
| **Regime** | The market's current mood — bull (rising), bear (falling), or sideways. |
| **Take-profit (TP)** | A pre-set price above entry where the trade closes in profit. |
| **Stop-loss (SL)** | A pre-set price below entry where the trade closes to cap the loss. |
| **Risk:reward (RR)** | Take-profit distance ÷ stop distance. Low RR = small target = high win rate. |
| **Trade-quality optimizer** | Searches entry × take-profit × stop-loss for the best win rate (profit-factor guarded). |
| **Objective** | What the optimizer ranks by: win rate, profit, or profit factor. |
| **Connors RSI-2** | Buy a very oversold 2-period RSI while price is above its 200 SMA (dip-buying in an uptrend). |
| **Supertrend** | ATR-band trend filter (green below price = uptrend). |
| **Donchian breakout** | Buy a new N-candle high (trend/momentum entry). |
| **Momentum (ROC)** | Rate-of-change entry: buy when price rose enough over a lookback. |
| **Regime filter** | Only trade when BTC and the coin are above their long-term averages; skip downtrends (spot only). |
| **Trailing stop** | A stop that follows the peak price up, locking in gains while letting winners run. |
| **Time-based exit (maxHoldBars)** | Force-close a trade after N candles so capital isn't stuck. |
| **Cooldown** | Bars to wait after an exit before re-entering, to avoid whipsaw. |
| **Robustness selection** | Pick the config profitable across the most training sub-periods (not the single peak). |
| **Portfolio backtest** | Trade a basket of coins from one shared balance; diversification smooths the ride. |
| **Look-ahead bias** | Peeking at future/test data when choosing a strategy — makes any backtest lie. |
| **Holdout** | A block of recent data kept completely untouched during design, used only to judge honestly. |
| **Break-even stop** | Once a trade is up by ~1× its risk, the stop moves to entry so a winner can't turn into a loss. |
| **ADX** | Average Directional Index — measures trend *strength* (0-100); a filter to trade only genuine trends, not chop. |
| **EMA pullback** | Buy a mild dip to a rising moving average within an uptrend (a frequent, trend-continuation entry). |
| **Universe expansion** | Applying the same selective edge across many more coins to get more total trades without lowering quality. |
| **Live portfolio (shared capital)** | Simulation where one balance funds all coins; each open trade locks a slice, freed when it closes; signals are skipped if cash runs out. |
| **Allocation per trade** | The fixed slice of the balance committed to each trade (e.g. 10% = ₹1,000 of ₹10,000). |
| **VWAP** | Volume-Weighted Average Price — the average price weighted by how much volume traded there; price above it = buyers in control. |
| **Rolling VWAP** | VWAP over the last N candles (a moving window) rather than anchored to a day/session — usable on any candle array. |
| **Keltner Channel** | An EMA with bands set a multiple of ATR above/below it — like Bollinger Bands but volatility comes from ATR, not standard deviation. |
| **Stochastic reversion** | Buy when Stochastic %K is very low (oversold), sell when very high (overbought) — an oscillator mean-reversion, cousin of RSI reversion. |
| **Daily strategy** | A short-timeframe (15m/1h) setup that aims to trade roughly every day, banking many small, tightly-stopped gains. |
| **Long / swing strategy** | A higher-timeframe (1d) setup that holds days-to-weeks to catch the big trends, accepting a lower win rate for much larger winners. |

Back to the [index](README.md).
