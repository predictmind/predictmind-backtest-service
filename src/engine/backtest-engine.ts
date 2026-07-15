/**
 * The backtest engine (S12.1 + S10.3 risk management). Runs a signal series over
 * candles as a SPOT long/flat strategy.
 *
 * By default it is "all-in / all-out" with a trading fee (directly comparable to
 * Buy & Hold). Optional risk controls (all off by default, so existing behaviour
 * is unchanged):
 *   - stop-loss: fixed percent (`stopLossPct`) or volatility-based (`atrMult`).
 *   - take-profit: at a risk:reward multiple of the stop distance (`takeProfitRR`).
 *   - position sizing: risk a fixed % of equity per trade (`riskPerTradePct`).
 * When a stop/TP is set, exits are checked intrabar using each candle's low/high.
 */

import { atr as atrSeries } from "./indicators";
import { Candle, RunResult, Signal, Trade } from "./types";

export interface EngineOptions {
  /** Fee per trade side, as a fraction (0.001 = 0.1%). */
  feePct?: number;
  /** Starting cash. */
  initialCapital?: number;
  /** Fixed stop-loss as a fraction of entry (0.05 = 5%). */
  stopLossPct?: number;
  /** Volatility stop: stop distance = atrMult x ATR (overrides stopLossPct). */
  atrMult?: number;
  /** ATR period for the volatility stop. */
  atrPeriod?: number;
  /** Take-profit at this multiple of the stop distance (risk:reward). */
  takeProfitRR?: number;
  /** Risk this fraction of equity per trade (position sizing). Needs a stop. */
  riskPerTradePct?: number;
  /** Trailing stop: once in profit, trail the stop this fraction below the peak,
   *  locking in gains while letting winners run. */
  trailingStopPct?: number;
  /** Time-based exit: force-close a trade after this many candles (no dead money). */
  maxHoldBars?: number;
  /** After an exit, wait this many candles before entering again (avoid whipsaw). */
  cooldownBars?: number;
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
  const atr =
    options.atrMult != null ? atrSeries(candles, options.atrPeriod ?? 14) : null;

  let cash = initialCapital;
  let units = 0;
  let inPosition = false;
  let entryPrice = 0;
  let entryTime = candles[0]?.openTime ?? new Date();
  let entryCost = 0;
  let entryIndex = 0;
  let stopPrice: number | null = null;
  let takeProfitPrice: number | null = null;
  let highSinceEntry = 0; // peak price since entry (for the trailing stop)
  let lastExitIndex = -Infinity; // for the post-exit cooldown

  const trades: Trade[] = [];
  const equityCurve: number[] = [];

  const closePosition = (exitPrice: number, exitTime: Date, bars: number, exitIndex: number): void => {
    const proceeds = units * exitPrice * (1 - fee);
    trades.push(makeTrade(entryTime, entryPrice, exitTime, exitPrice, entryCost, proceeds, bars));
    cash += proceeds;
    units = 0;
    inPosition = false;
    stopPrice = null;
    takeProfitPrice = null;
    lastExitIndex = exitIndex;
  };

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const price = candle.close;
    const signal = signals[i];

    // 1) Intrabar exits (not on the entry bar): trailing/fixed stop, then take-
    //    profit, then the time-based max-hold exit.
    if (inPosition && i > entryIndex) {
      if (candle.high > highSinceEntry) highSinceEntry = candle.high;
      // Effective stop = the higher of the fixed stop and the trailing stop.
      let effStop = stopPrice;
      if (options.trailingStopPct != null && highSinceEntry > 0) {
        const trail = highSinceEntry * (1 - options.trailingStopPct);
        effStop = effStop != null ? Math.max(effStop, trail) : trail;
      }
      if (effStop !== null && candle.low <= effStop) {
        closePosition(effStop, candle.openTime, i - entryIndex, i);
      } else if (takeProfitPrice !== null && candle.high >= takeProfitPrice) {
        closePosition(takeProfitPrice, candle.openTime, i - entryIndex, i);
      } else if (options.maxHoldBars != null && i - entryIndex >= options.maxHoldBars) {
        closePosition(price, candle.openTime, i - entryIndex, i);
      }
    }

    // 2) Signal-based exit (at close).
    if (inPosition && signal === "SELL") {
      closePosition(price, candle.openTime, i - entryIndex, i);
    }

    // 3) Entry (respecting the post-exit cooldown).
    const cooldownOk = i - lastExitIndex >= (options.cooldownBars ?? 0);
    if (!inPosition && signal === "BUY" && cooldownOk) {
      const stopDistance =
        atr && atr[i] != null
          ? (options.atrMult as number) * (atr[i] as number)
          : options.stopLossPct != null
            ? price * options.stopLossPct
            : null;

      // Position sizing: risk a fixed % of equity if we have a stop; else all-in.
      let spend = cash;
      if (options.riskPerTradePct != null && stopDistance != null && stopDistance > 0) {
        const riskAmount = cash * options.riskPerTradePct;
        const sized = (riskAmount * price) / stopDistance;
        spend = Math.min(cash, sized);
      }

      units = (spend * (1 - fee)) / price;
      cash -= spend;
      entryCost = spend;
      inPosition = true;
      entryPrice = price;
      entryTime = candle.openTime;
      entryIndex = i;
      highSinceEntry = price;
      stopPrice = stopDistance != null ? price - stopDistance : null;
      takeProfitPrice =
        stopDistance != null && options.takeProfitRR != null
          ? price + options.takeProfitRR * stopDistance
          : null;
    }

    equityCurve.push(cash + units * price);
  }

  // Close any open position at the last candle so trade stats are complete.
  if (inPosition && candles.length > 0) {
    const last = candles[candles.length - 1];
    closePosition(last.close, last.openTime, candles.length - 1 - entryIndex, candles.length - 1);
    if (equityCurve.length > 0) {
      equityCurve.pop();
      equityCurve.push(cash);
    }
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
