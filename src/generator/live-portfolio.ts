/**
 * Live-style portfolio simulation with a SHARED, capital-constrained balance.
 *
 * This models real money: you start with one balance (e.g. ₹10,000). When a
 * trade opens it LOCKS a fixed slice of capital (e.g. ₹1,000), so your free cash
 * drops to ₹9,000 and can fund fewer new trades. When the trade closes, the slice
 * plus its profit/loss returns to free cash. If a new signal fires but there's no
 * free cash left, the trade is SKIPPED — exactly as in real trading.
 *
 * Each coin is traded with its assigned strategy (dip-buy or breakout). We collect
 * every coin's trades (with timestamps), then replay them all on one shared
 * balance in time order.
 */

import { EngineOptions, runBacktest } from "../engine/backtest-engine";
import { Condition, RuleSpec, RuleStrategy } from "../engine/rule-strategy";
import { Candle } from "../engine/types";

export type StrategyKind = "dip" | "breakout";

// The two proven strategies, matched to coin character.
const DIP_SPEC: RuleSpec = {
  entry: {
    mode: "all",
    conditions: [
      { type: "indicator", name: "rsi", period: 2, op: "lt", value: 10 },
      { type: "ma", kind: "sma", fast: 1, slow: 200, op: "gt" },
      { type: "ma", kind: "ema", fast: 20, slow: 50, op: "gt" },
      { type: "btc_trend", period: 200, dir: "above" },
    ] as Condition[],
  },
  exit: { mode: "any", conditions: [{ type: "indicator", name: "rsi", period: 2, op: "gt", value: 70 }] },
};
const DIP_RISK: EngineOptions = {
  stopLossPct: 0.08,
  takeProfitRR: 2,
  trailingStopPct: 0.08,
  maxHoldBars: 40,
  cooldownBars: 2,
  breakEvenAtR: 1,
};

const BREAKOUT_SPEC: RuleSpec = {
  entry: {
    mode: "all",
    conditions: [
      { type: "breakout", period: 20, dir: "up" },
      { type: "ma", kind: "ema", fast: 20, slow: 50, op: "gt" },
      { type: "btc_trend", period: 200, dir: "above" },
    ] as Condition[],
  },
  exit: { mode: "any", conditions: [{ type: "breakout", period: 10, dir: "down" }] },
};
const BREAKOUT_RISK: EngineOptions = {
  stopLossPct: 0.1,
  takeProfitRR: 3,
  trailingStopPct: 0.12,
  maxHoldBars: 60,
  cooldownBars: 2,
  breakEvenAtR: 1,
};

export function strategyFor(kind: StrategyKind): { spec: RuleSpec; risk: EngineOptions } {
  return kind === "dip" ? { spec: DIP_SPEC, risk: DIP_RISK } : { spec: BREAKOUT_SPEC, risk: BREAKOUT_RISK };
}

interface SimTrade {
  symbol: string;
  kind: StrategyKind;
  entryMs: number;
  exitMs: number;
  pnlPct: number;
}

export interface LivePortfolioOptions {
  initialCapital?: number;
  allocFraction?: number; // fixed slice per trade = fraction of the INITIAL capital
}

export interface LivePortfolioResult {
  initialCapital: number;
  finalEquity: number;
  netReturnPct: number;
  allocPerTrade: number;
  tradesTaken: number;
  tradesSkippedNoCash: number;
  maxConcurrentPositions: number;
  maxDrawdownPct: number;
  perCoin: { symbol: string; kind: StrategyKind; signals: number }[];
}

/** Collect a coin's trades (with times) from its assigned strategy. */
export function coinTrades(candles: Candle[], kind: StrategyKind): SimTrade[] {
  const { spec, risk } = strategyFor(kind);
  const signals = new RuleStrategy(spec).generate(candles);
  const run = runBacktest(candles, signals, risk);
  return run.trades.map((t) => ({
    symbol: "",
    kind,
    entryMs: t.entryTime.getTime(),
    exitMs: t.exitTime.getTime(),
    pnlPct: t.pnlPct,
  }));
}

/** Replay all coins' trades on one shared, capital-constrained balance. */
export function simulateLivePortfolio(
  all: SimTrade[],
  options: LivePortfolioOptions = {},
): Omit<LivePortfolioResult, "perCoin"> {
  const initialCapital = options.initialCapital ?? 10_000;
  const allocFraction = Math.min(Math.max(options.allocFraction ?? 0.1, 0.02), 1);
  const alloc = initialCapital * allocFraction; // fixed rupee size per trade

  // Build a time-ordered event stream: exits before entries at the same instant
  // (free cash first, then spend it).
  interface Ev { t: number; kind: "entry" | "exit"; id: number; pnlPct: number }
  const events: Ev[] = [];
  all.forEach((tr, id) => {
    events.push({ t: tr.entryMs, kind: "entry", id, pnlPct: tr.pnlPct });
    events.push({ t: tr.exitMs, kind: "exit", id, pnlPct: tr.pnlPct });
  });
  events.sort((a, b) => a.t - b.t || (a.kind === "exit" ? -1 : 1));

  let cash = initialCapital;
  let locked = 0;
  let open = 0;
  let maxConcurrent = 0;
  let taken = 0;
  let skipped = 0;
  let peak = initialCapital;
  let maxDd = 0;
  const openIds = new Set<number>();

  for (const ev of events) {
    if (ev.kind === "entry") {
      if (cash >= alloc) {
        cash -= alloc;
        locked += alloc;
        open++;
        taken++;
        openIds.add(ev.id);
        if (open > maxConcurrent) maxConcurrent = open;
      } else {
        skipped++;
      }
    } else {
      if (!openIds.has(ev.id)) continue; // this trade was skipped at entry
      openIds.delete(ev.id);
      cash += alloc * (1 + ev.pnlPct / 100); // return the slice + its P&L
      locked -= alloc;
      open--;
    }
    const equity = cash + locked; // locked valued at cost (conservative)
    if (equity > peak) peak = equity;
    if (peak > 0) {
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }

  const finalEquity = cash + locked;
  return {
    initialCapital,
    finalEquity: round(finalEquity),
    netReturnPct: round(((finalEquity - initialCapital) / initialCapital) * 100),
    allocPerTrade: round(alloc),
    tradesTaken: taken,
    tradesSkippedNoCash: skipped,
    maxConcurrentPositions: maxConcurrent,
    maxDrawdownPct: round(maxDd),
  };
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
