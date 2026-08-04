# 📘 SOL Strategy Playbook — Plain-English Guide

This is the "how do we actually trade Solana (SOL)" guide, in simple words. No
coding needed to read it. It covers **two** strategies:

1. **DAILY strategy** — small profits, almost every day.
2. **SWING strategy** — big profits, holding for weeks or months.

For each one you'll see: **what it is**, **the exact settings**, **exactly when to
buy**, **exactly when to sell**, and **what ₹10,000 would have become**.

> ⚠️ **Honesty note:** these numbers come from testing on **real past SOL prices**.
> The past is the best guide we have, but it is **not a promise** about the future.
> Markets change. Treat these as "how the plan behaved," not "guaranteed income."

---

## First: the one idea you must understand

**Winning most of your trades is NOT the same as making money.**

What actually makes money is simple: **win big, lose small.** You can lose more
trades than you win and still get rich — as long as your winners are much bigger than
your losers. The measure for this is **Profit Factor** = (all the money you won) ÷
(all the money you lost). Above 1.0 means profitable. Our SWING strategy is **6.85**
— it makes ₹6.85 for every ₹1 it loses.

Keep this in mind as you read. The DAILY strategy wins often; the SWING strategy wins
rarely but huge. Both make money — just in opposite ways.

---

## STRATEGY 1 — DAILY (steady small profits)

### What it is
In an uptrend, we **buy small dips** and **sell into small bounces**, many times.
Think of it like picking up coins that keep dropping on the floor — each one is
small, but you pick up a lot of them. We look at the **15-minute chart** (each candle
= 15 minutes).

### The exact settings
| Setting | Value | In plain words |
|---|---|---|
| Trend filter | EMA(50) above EMA(200) | The recent average price is above the long-term average = uptrend |
| Dip trigger | RSI(14) below 50 | Price has dipped a little (RSI is a 0–100 "hot/cold" meter) |
| Downtrend guard | Price above its 7-day average (SMA 672 on 15m) | Don't trade if the bigger picture is falling |
| Sell trigger | RSI(14) above 65 | The bounce is done, take the profit |
| Trailing stop | 3% | If price falls 3% from its peak while we hold, get out |
| Hard stop-loss | 2% | If price drops 2% below our buy price, get out — mistake, cut it |

### 👉 Exactly WHEN to BUY
Buy **only when a 15-minute candle closes and ALL THREE are true at the same time:**
1. EMA(50) is above EMA(200) (uptrend), **and**
2. RSI(14) is below 50 (a dip), **and**
3. The current price is above the 7-day average (bigger picture still up).

If any one of the three is false → **do nothing, wait.**

### 👉 Exactly WHEN to SELL
Sell (close the trade) as soon as **any ONE** of these happens:
- RSI(14) rises above 65 (bounce finished), **or**
- Price falls 3% from the highest point reached since you bought (trailing stop), **or**
- Price falls 2% below your buy price (hard stop-loss — the trade was wrong).

### How it performed (tested on ~52 recent days of 15-min SOL)
| Measure | Result |
|---|---|
| Profit | **+13.8%** in about 52 days |
| Win rate | **64.6%** (wins more than it loses) |
| Number of trades | 48 (about 1 per day) |
| Worst dip in the account | only **7%** |
| Profit factor | 1.45 |

### 💰 With ₹10,000 capital
₹10,000 → **about ₹11,377** in ~52 days (**+₹1,377**), with the account never dropping
more than ~7% along the way. That window was a flat/choppy market, so this is a
*modest but steady* result — the strength here is **frequent wins and small risk**,
not huge gains.

---

## STRATEGY 2 — SWING (big profits, held for weeks/months)

### What it is
We wait for SOL to show **real strength** (a fresh multi-month high) while the whole
crypto market is healthy, then **buy and hold on for the big ride** — sometimes for
months. We accept many small "false start" losses to catch the rare, giant winner.
We look at the **1-day chart** (each candle = 1 day).

### The exact settings
| Setting | Value | In plain words |
|---|---|---|
| Strength trigger | Price breaks above the highest price of the last **100 days** | SOL is making a big new high = real momentum |
| Market-health filter | Bitcoin is above its own 100-day average | The whole market is in "risk-on" mode |
| Exit | **25% trailing stop** | Hold as long as it keeps rising; only sell after it falls 25% from its peak |

### 👉 Exactly WHEN to BUY
Buy when a **daily** candle closes and **BOTH** are true:
1. SOL's closing price is **higher than every close in the previous 100 days** (a new
   100-day high), **and**
2. Bitcoin's price is above its own 100-day average.

### 👉 Exactly WHEN to SELL
Sell **only** when the price drops **25% below the highest point** reached since you
bought. That's it — no fixed target. If SOL keeps rising, you keep holding (even for
months). The 25% cushion is what lets a winner run all the way up.

### The real trades (this is the important part)
Here are the **actual 9 trades** the strategy took over ~5.5 years of SOL history:

| # | How long held | Result |
|---|---|---|
| 1 | 2 days | −2.8% (loss) |
| 2 | 11 days | +66.3% (win) |
| 3 | 1 day | −14.6% (loss) |
| 4 | 16 days | −11.9% (loss) |
| 5 | 9 days | −7.5% (loss) |
| 6 | **72 days** | **+196.7%** (win) |
| 7 | 36 days | +9.4% (win) |
| 8 | 42 days | +0.8% (win) |
| 9 | 81 days | −3.0% (loss) |

- **5 losses, 4 wins** → only a **44% win rate**.
- But add them up: the **5 losses together ≈ −40%**, while the **4 wins together ≈
  +273%**.
- **One single trade (+196.7%) was about 5× bigger than all five losses combined.**

That is "win big, lose small" in action. The losses are tiny because a failed
breakout exits fast; the winners are huge because the 25% trailing stop lets them run
for months.

### How it performed (full ~5.5 years of daily SOL)
| Measure | Result |
|---|---|
| Profit | **+256.6%** |
| Win rate | 44% (loses more often — and that's fine) |
| Profit factor | **6.85** (₹6.85 won for every ₹1 lost) |
| Number of trades | 9 (rare) |
| Worst dip in the account | 41% (you must be able to stomach this) |

### 💰 With ₹10,000 capital — step by step
Watch how the ₹10,000 actually moved through the 9 trades:

| After trade | Result | Balance |
|---|---|---|
| Start | — | ₹10,000 |
| 1 | −2.8% | ₹9,720 |
| 2 | +66.3% | ₹16,164 |
| 3 | −14.6% | ₹13,804 |
| 4 | −11.9% | ₹12,161 |
| 5 | −7.5% | ₹11,249 |
| 6 | **+196.7%** | **₹33,376** |
| 7 | +9.4% | ₹36,514 |
| 8 | +0.8% | ₹36,806 |
| 9 | −3.0% | ₹35,700 |

**₹10,000 → about ₹35,700 over ~5.5 years** (roughly a 3.5× gain, ~₹25,700 profit).

Notice trades 1–5: after five trades you were only at ₹11,249 — barely up, and you
sat through several small losses. **Then trade #6 changed everything.** This is the
hard part of swing trading: you must patiently take the small losses while waiting for
the big run. Most people quit during trades 1–5 and miss trade #6.

---

## DAILY vs SWING — which should you use?

| | DAILY | SWING |
|---|---|---|
| Chart | 15-minute | 1-day |
| How often you trade | ~1 per day | ~2 per year |
| Win rate | 64.6% (wins often) | 44% (loses often) |
| Feeling | Frequent small wins, comfortable | Long waits, small losses, then a jackpot |
| Best for | Someone who wants activity + steady gains | Someone patient who wants big gains |
| ₹10,000 became | ~₹11,377 in ~52 days | ~₹35,700 in ~5.5 years |

**You don't have to choose one.** Many traders run both: the DAILY strategy for steady
cash flow, and the SWING strategy in the background for the occasional big payday.

---

## The honest fine print (please read)

1. **Past results are not future promises.** These are backtests on real history; live
   markets can behave differently.
2. **The SWING result rode SOL's giant 2023 run.** If that specific run hadn't
   happened, the profit would be far smaller. Its real value is **protecting you in
   crashes** (it sits in cash when Bitcoin is weak) and catching *whatever* the next
   big run is — not guaranteeing another +197%.
3. **Simply holding SOL** through this whole period actually gained *more* on paper
   (because SOL rose ~20×). Our strategies win on **risk control** (much smaller
   drops, cash during downtrends), not on out-guessing a coin that only went up.
4. **Spot only** — we only buy and sell; we never bet on prices falling. In a long
   downtrend, the honest best move is to **sit in cash**, which is exactly what the
   filters make us do.
5. Before real money, we test each strategy **forward** (walk-forward / paper trading),
   never trusting a single pretty backtest number.

---

## Using these strategies on OTHER coins (we tested this)

You asked a smart question: can we run these same plans on other coins to make more
money? We tested it. The two strategies behave **very differently** when moved to
other coins.

### SWING travels well — use it on a basket of coins ✅

We ran the **exact same SWING rule** (new 100-day high + Bitcoin healthy + 25%
trailing stop) — with **no changes** — on 22 major coins over their full history
(₹10,000 each). It made money on **8 of them**:

| Coin | Strategy profit | Just holding the coin | Profit factor |
|---|---|---|---|
| SOL | **+257%** | +2,150% | 6.85 |
| NEAR | **+94%** | **−49%** | 3.08 |
| ADA | **+44%** | **−55%** | 2.00 |
| AVAX | **+39%** | **−49%** | 2.11 |
| ICP | **+34%** | **−99%** | 2.56 |
| BTC | **+31%** | +90% | 2.13 |
| BNB | **+24%** | +1,294% | 1.91 |
| XLM | **+23%** | **−57%** | 1.66 |

Look at the middle column. On **NEAR, ADA, AVAX, ICP, XLM**, just holding the coin
would have **lost you 49% to 99%** — but the SWING strategy **made money** on them.
That's the whole point: it grabs the big run and then gets out before the crash. On
coins that only ever went up (BTC, BNB), plain holding won — but you'd have suffered
huge drops on the way.

**On the other 14 coins the same rule lost money** (examples: LTC −70%, UNI −74%, DOT
−38%, RUNE −55%). So the plan is: **only run SWING on the coins it actually fits.**
Our best basket: **SOL, NEAR, ADA, AVAX, ICP, BTC, BNB, XLM.**

> By running SWING across these 8 coins instead of only SOL, you get **more chances**
> to catch a big run — while the healthy-Bitcoin filter still pulls you all to cash
> together when the whole market turns down.

### SWING profit by recent periods (it's lumpy — like investing)

You wanted to see it "by months/years," not one 5-year number. Here's what ₹10,000
became over the **last 1, 2, and 3 years** (a trade may last months, so we measure in
years):

| Coin | Last 12 months | Last 24 months | Last 36 months |
|---|---|---|---|
| SOL | ₹10,000 (0 trades) | ₹9,771 (−2%) | **₹28,934 (+189%)** |
| NEAR | ₹13,949 (+39%) | ₹11,407 (+14%) | ₹26,559 (+166%) |
| ADA | ₹10,000 (0 trades) | ₹18,687 (+87%) | ₹24,464 (+145%) |
| AVAX | ₹10,000 (0 trades) | ₹12,022 (+20%) | ₹26,907 (+169%) |
| BTC | ₹10,000 (0 trades) | ₹12,363 (+24%) | ₹20,330 (+103%) |
| XLM | ₹8,406 (−16%) | ₹20,037 (+100%) | ₹16,724 (+67%) |

**The big lesson here:** in the **last 12 months** the strategy hardly traded at all —
several coins had **0 trades** because no valid breakout appeared while Bitcoin was
healthy. It just sat safely in cash. Most of the profit came in the **2-to-3-year**
windows that contained the big 2024–2025 run.

So SWING is **not steady monthly income.** It's more like **patient investing**: quiet
for long stretches (sometimes a whole year with no trade), then a big payoff when a
real bull move finally comes. If you want money moving every month, that's the DAILY
strategy's job, not this one.

### DAILY does NOT travel — it's SOL-only for now ❌

We imported 15-minute data for BTC, ETH, BNB, XRP, ADA, AVAX, DOGE, LINK and NEAR and
ran the **exact same DAILY rule** on each (recent ~24-day window). Result:

| Coin | DAILY profit |
|---|---|
| **SOL** | **+4.0%** (78% win) ✅ |
| XRP | −1.8% |
| NEAR | −3.3% |
| BNB | −5.4% |
| ADA | −5.6% |
| LINK | −6.3% |
| BTC | −7.4% |
| ETH | −8.9% |
| DOGE | −10.2% |
| AVAX | −13.5% |

**Only SOL made money.** The DAILY settings (the RSI levels, the 3% trailing, the 2%
stop) are tuned to how *SOL* wiggles on the 15-minute chart. Other coins wiggle
differently, so the same numbers lose. This is the honest truth: **the DAILY strategy
is a SOL specialist, not a one-size-fits-all plan.**

To make a DAILY strategy work on another coin we would need to:
1. Import **much deeper** 15-minute history for that coin (we only had ~24 days —
   too little to trust), and
2. **Re-tune** its settings for that specific coin (its own RSI levels, stop, target),
   then test it forward.

That's a real, doable follow-up — just say the word and I'll build a per-coin DAILY
tuner. But I won't pretend the current SOL settings work elsewhere, because the test
says they don't.

### Bottom line

- **SWING:** run it on a **basket** — SOL, NEAR, ADA, AVAX, ICP, BTC, BNB, XLM. More
  coins = more shots at a big run, with built-in crash protection. Expect **lumpy,
  investment-style** returns (quiet years, then big years).
- **DAILY:** keep it on **SOL only** for now. Extending it to other coins needs deeper
  data and per-coin tuning — a separate project.

---

*Back to the [education index](README.md). For the technical/code version of this, see
[step 13](13-expanded-indicators-daily-long.md).*
