# 10. The Trade-Quality Optimizer (win rate you can tune)

Up to now our strategies exited on a *signal* (e.g. "sell when RSI is high"). But a
real trader thinks differently: **"I'll enter here, take profit at +X%, and cut the
loss at −Y%."** That single choice — the **take-profit** and **stop-loss** — decides
how often you win. This lesson is about the tool that searches for the best
entry + take-profit + stop-loss combination: the **trade-quality optimizer**
(`src/generator/trade-optimizer.ts`).

## The key idea: win rate is a dial, not a fact

Imagine buying a coin and setting two exits:
- **Take-profit** a little above (say +2%) → easy to reach → you win **often**.
- **Stop-loss** far below (say −10%) → rarely hit → you lose **rarely**… but when
  you do, it hurts.

Flip it (big take-profit, tight stop) and you win **rarely** but winners are big.
So **you can dial the win rate up or down** just by where you place the exits. The
optimizer explores that dial.

We measure the take-profit as a **risk:reward ratio (RR)** of the stop distance:
`take-profit distance = RR × stop distance`. So RR 0.5 means the target is half the
stop — easy to hit, high win rate. RR 2 means the target is twice the stop — harder,
lower win rate but bigger wins.

> **The maths that keeps us honest.** To at least break even, your win rate must be
> above `1 / (1 + RR)`. RR 0.5 needs 67% wins; RR 0.2 needs 83%; RR 0.11 needs 90%.
> That's *why* a "90% win rate" always comes with a tiny take-profit and a wide
> stop — and why it's fragile.

## The guard: don't lose more than you win

A high win rate is worthless if the rare losses are huge. So every config the
optimizer keeps must have a **profit factor ≥ 1** (usually we set 1.1–1.2):

```text
profit factor = total money won ÷ total money lost
```

Above 1 means winners outweigh losers. This single guard stops the optimizer from
handing you a "95% win rate" strategy that quietly blows up on the 5%.

## The search (grid) — line by line

```ts
for (const entry of entries) {          // every entry trigger (RSI dip, breakout, ...)
  const spec = entrySpec(entry);        // entry-only: exits are ONLY take-profit / stop
  for (const sl of stops) {             // e.g. 5%, 8%, 12%
    for (const rr of rrs) {             // e.g. 0.2, 0.33, 0.5, 1, 2
      const m = evaluate(spec, train, timeframe, { stopLossPct: sl, takeProfitRR: rr });
      if (m.tradesCount < minTrades || m.profitFactor < minProfitFactor) continue;
      keep(entry, sl, rr, m);           // net-positive & trades enough
    }
  }
}
```

- **`entrySpec`** builds a rule whose exit list is *empty*, so a trade ends **only**
  at the take-profit or the stop — exactly the trader's "TP or SL" mental model.
- We try every combination, drop the ones that barely trade or lose money, and rank
  the rest.

## What to rank by — the "objective"

We can sort the survivors three ways (the `objective` option):

| Objective | Picks configs that… | We learned… |
| --- | --- | --- |
| **winRate** | win the most often | most *robust* (small, boring wins generalise) |
| **profit** | made the biggest net gain | **overfits** — chases one lucky big move, fails later |
| **profitFactor** | best reward-to-risk | also overfits on this data |

> **A real, hard-won lesson.** We expected "maximise profit" to be best. It was the
> *worst* out-of-sample — the biggest-profit config on the past was usually a fluke
> that lost on the future. Ranking by **win rate** (many small, repeatable wins)
> generalised better. Boring beats greedy.

## Choosing honestly: train vs test

We **choose** the config only on a **train** slice (the earlier data) and **report**
it on a **test** slice (later, unseen data). Critically, we do **not** pick the
config that looks best on the test slice — that would be **look-ahead bias** (peeking
at the answer). More on the day we caught ourselves doing this in
[lesson 12](12-portfolio-and-honest-validation.md).

## New strategy families we added for the search

To give the optimizer more to work with (and to suit *trending* coins, not just
dip-buying), we added four well-known families — see the candidate space:

- **Connors RSI-2** — Larry Connors' famous mean-reversion: buy a very oversold
  2-period RSI **only while price is above its 200-period average** (buy dips inside
  an uptrend, never a falling knife). "close > SMA(200)" is written as an SMA(1)
  [= the close itself] above SMA(200).
- **Supertrend** — Olivier Seban's ATR-band trend filter: ride the uptrend, exit
  when it flips down (see the `supertrend` indicator).
- **Donchian breakout** — buy a new N-candle high (trend/momentum).
- **Momentum (ROC)** — buy when price rose enough over a lookback.

> **Honest footnote.** Connors RSI-2 is famous for ~90% win rates **on stocks, daily
> bars**. On volatile crypto 4h it only managed ~55–65% and often lost — a good
> reminder that a strategy's reputation doesn't transfer across markets. We tested
> it rather than trusting the legend.

## Endpoints

- `POST /backtests/optimize` — single train/test split, returns the top configs by
  out-of-sample win rate (with the profit-factor guard).
- `POST /backtests/optimize/walkforward` — the same idea across **many** windows
  (see [lesson 12](12-portfolio-and-honest-validation.md)).

Next: the risk controls that make it safe to run — [11-risk-controls-and-regime.md](11-risk-controls-and-regime.md).
