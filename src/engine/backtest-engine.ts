/**
 * The backtest engine (S12.1). Runs a signal series over candles as a SPOT
 * long/flat strategy: when we BUY we put ALL cash into the coin; when we SELL we
 * go fully back to cash. A trading fee is applied on both sides so results are
 * realistic. This "all-in / all-out" model keeps every strategy directly
 * comparable to Buy & Hold.
 */

import { Candle, RunResult, Signal, Trade } from "./types";

export interface EngineOptions {
  /** Fee per trade side, as a fraction (0.001 = 0.1%). */
  feePct?: number;
  /** Starting cash. */
  initialCapital?: number;
}

const DEFAULT_FEE = 0.001; // 0.1% per side, typical spot taker fee
const DEFAULT_CAPITAL = 10_000;

export function runBacktest(
  candles: Candle[],
  signals: Signal[],
  options: EngineOptions = {},
): RunResult {
  const fee = options.feePct ?? DEFAULT_FEE;
  const initialCapital = options.initialCapital ?? DEFAULT_CAPITAL;

  let cash = initialCapital;
  let units = 0;
  let inPosition = false;
  let entryPrice = 0;
  let entryTime = candles[0]?.openTime ?? new Date();
  let entryCost = 0;
  let entryIndex = 0;

  const trades: Trade[] = [];
  const equityCurve: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const price = candle.close;
    const signal = signals[i];

    if (!inPosition && signal === "BUY") {
      entryCost = cash;
      const afterFee = cash * (1 - fee);
      units = afterFee / price;
      cash = 0;
      inPosition = true;
      entryPrice = price;
      entryTime = candle.openTime;
      entryIndex = i;
    } else if (inPosition && signal === "SELL") {
      const proceeds = units * price * (1 - fee);
      trades.push(makeTrade(entryTime, entryPrice, candle.openTime, price, entryCost, proceeds, i - entryIndex));
      cash = proceeds;
      units = 0;
      inPosition = false;
    }

    equityCurve.push(cash + units * price);
  }

  // Close any open position at the last candle so trade stats are complete.
  if (inPosition && candles.length > 0) {
    const last = candles[candles.length - 1];
    const proceeds = units * last.close * (1 - fee);
    trades.push(
      makeTrade(entryTime, entryPrice, last.openTime, last.close, entryCost, proceeds, candles.length - 1 - entryIndex),
    );
    cash = proceeds;
    units = 0;
    equityCurve[equityCurve.length - 1] = cash;
  }

  return { trades, equityCurve, finalEquity: cash, initialCapital };
}

function makeTrade(
  entryTime: Date,
  entryPrice: number,
  exitTime: Date,
  exitPrice: number,
  entryCost: number,
  proceeds: number,
  bars: number,
): Trade {
  const pnlPct = entryCost > 0 ? ((proceeds - entryCost) / entryCost) * 100 : 0;
  return { entryTime, entryPrice, exitTime, exitPrice, pnlPct, bars };
}
