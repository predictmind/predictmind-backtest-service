/**
 * Performance metrics (S12.2). Turns a backtest run into the numbers that decide
 * whether a strategy is any good — and crucially whether it beats Buy & Hold.
 * All risk-adjusted numbers are annualised using the candle timeframe.
 */

import { Candle, RunResult } from "./types";

export interface Metrics {
  netProfitPct: number;
  buyHoldPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  expectancyPct: number;
  avgTradePct: number;
  tradesCount: number;
  finalEquity: number;
}

/** How many candles of this timeframe fit in a year (for annualising Sharpe). */
export function periodsPerYear(timeframe: string): number {
  const map: Record<string, number> = {
    "1m": 525_600,
    "5m": 105_120,
    "15m": 35_040,
    "30m": 17_520,
    "1h": 8_760,
    "4h": 2_190,
    "1d": 365,
    "1w": 52,
  };
  return map[timeframe] ?? 365;
}

function round(value: number, dp = 4): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdDev(xs: number[], avg: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((a, x) => a + (x - avg) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

/** Max peak-to-trough drop of the equity curve, as a positive percentage. */
export function maxDrawdown(equityCurve: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const equity of equityCurve) {
    if (equity > peak) peak = equity;
    if (peak > 0) {
      const dd = (peak - equity) / peak;
      if (dd > worst) worst = dd;
    }
  }
  return worst * 100;
}

/** Per-candle simple returns of the equity curve. */
function periodReturns(equityCurve: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1];
    if (prev > 0) rets.push((equityCurve[i] - prev) / prev);
  }
  return rets;
}

export function computeMetrics(
  run: RunResult,
  candles: Candle[],
  timeframe: string,
): Metrics {
  const { trades, equityCurve, finalEquity, initialCapital } = run;

  const netProfitPct = ((finalEquity - initialCapital) / initialCapital) * 100;

  const first = candles[0]?.close ?? 0;
  const last = candles[candles.length - 1]?.close ?? 0;
  const buyHoldPct = first > 0 ? ((last - first) / first) * 100 : 0;

  const pnls = trades.map((t) => t.pnlPct);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p <= 0);
  const winRate = pnls.length ? (wins.length / pnls.length) * 100 : 0;

  const grossWin = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? grossWin : 0;

  const avgTradePct = mean(pnls);
  // Expectancy = (winRate * avgWin) - (lossRate * avgLoss), in % per trade.
  const avgWin = mean(wins);
  const avgLoss = Math.abs(mean(losses));
  const lossRate = pnls.length ? losses.length / pnls.length : 0;
  const winRateFrac = pnls.length ? wins.length / pnls.length : 0;
  const expectancyPct = winRateFrac * avgWin - lossRate * avgLoss;

  // Annualised Sharpe & Sortino from per-candle equity returns.
  const rets = periodReturns(equityCurve);
  const avgRet = mean(rets);
  const ann = Math.sqrt(periodsPerYear(timeframe));
  const sd = stdDev(rets, avgRet);
  const sharpe = sd > 0 ? (avgRet / sd) * ann : 0;
  const downside = rets.filter((r) => r < 0);
  const downsideDev = stdDev(downside, 0); // deviation below zero
  const sortino = downsideDev > 0 ? (avgRet / downsideDev) * ann : 0;

  return {
    netProfitPct: round(netProfitPct),
    buyHoldPct: round(buyHoldPct),
    winRate: round(winRate, 2),
    profitFactor: round(profitFactor),
    maxDrawdownPct: round(maxDrawdown(equityCurve)),
    sharpe: round(sharpe),
    sortino: round(sortino),
    expectancyPct: round(expectancyPct),
    avgTradePct: round(avgTradePct),
    tradesCount: trades.length,
    finalEquity: round(finalEquity, 2),
  };
}
