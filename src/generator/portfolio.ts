/**
 * Portfolio backtest. Individual coins each have profitable *and* losing windows,
 * but they rarely all lose at once — so trading the whole basket together pools
 * the wins and smooths the losses (diversification). This simulates a shared
 * account that runs every coin's best out-of-sample strategy at the same time.
 *
 * Model (equal-risk pooled trades):
 *   - Start with one shared balance.
 *   - Each trade risks a fixed fraction of the CURRENT balance (`allocFraction`),
 *     so a coin can't bet the whole account on one idea.
 *   - Trades are realised in exit-time order; each adds `balance × alloc × pnl%`.
 *   - We track the combined equity curve to measure return and drawdown, and pool
 *     every coin's trades to get the basket's true win rate.
 *
 * This is deliberately simple and honest: no leverage, no compounding tricks —
 * just "spread the same money across many coins and see how the basket does".
 */

import { PortfolioTrade } from "./trade-optimizer";

export interface PortfolioCoinInput {
  symbol: string;
  entryLabel: string;
  stopLossPct: number;
  takeProfitRR: number;
  trades: PortfolioTrade[];
}

export interface PortfolioOptions {
  allocFraction?: number; // fraction of balance risked per trade (default 0.1)
  initialCapital?: number;
}

export interface PortfolioCoinSummary {
  symbol: string;
  strategy: string; // "entryLabel | SLx% TPy%"
  trades: number;
  winRate: number;
  netProfitPct: number; // this coin's own standalone net (sum of pnl on its sleeve)
}

export interface PortfolioResult {
  coins: number;
  totalTrades: number;
  totalWins: number;
  overallWinRatePct: number;
  netReturnPct: number;
  maxDrawdownPct: number;
  allocFraction: number;
  perCoin: PortfolioCoinSummary[];
}

function round(v: number, dp = 2): number {
  if (!Number.isFinite(v)) return 0;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function simulatePortfolio(
  inputs: PortfolioCoinInput[],
  options: PortfolioOptions = {},
): PortfolioResult {
  const alloc = Math.min(Math.max(options.allocFraction ?? 0.1, 0.01), 1);
  const initial = options.initialCapital ?? 10_000;

  // Per-coin summaries (standalone, on an equal sleeve).
  const perCoin: PortfolioCoinSummary[] = inputs.map((c) => {
    const wins = c.trades.filter((t) => t.pnlPct > 0).length;
    const net = c.trades.reduce((a, t) => a + t.pnlPct, 0);
    return {
      symbol: c.symbol,
      strategy: `${c.entryLabel} | SL${c.stopLossPct * 100}% RR${c.takeProfitRR}`,
      trades: c.trades.length,
      winRate: c.trades.length ? round((wins / c.trades.length) * 100) : 0,
      netProfitPct: round(net),
    };
  });

  // Pool every coin's trades and realise them in exit-time order.
  const all = inputs
    .flatMap((c) => c.trades)
    .sort((a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime());

  let equity = initial;
  let peak = initial;
  let maxDd = 0;
  let wins = 0;
  for (const t of all) {
    equity += equity * alloc * (t.pnlPct / 100);
    if (t.pnlPct > 0) wins++;
    if (equity > peak) peak = equity;
    if (peak > 0) {
      const dd = ((peak - equity) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }

  return {
    coins: inputs.length,
    totalTrades: all.length,
    totalWins: wins,
    overallWinRatePct: all.length ? round((wins / all.length) * 100) : 0,
    netReturnPct: round(((equity - initial) / initial) * 100),
    maxDrawdownPct: round(maxDd),
    allocFraction: alloc,
    perCoin,
  };
}
