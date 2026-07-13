/** A single price bar (candle). Times are real Dates; prices are plain numbers. */
export interface Candle {
  openTime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Order-flow: volume bought by aggressive takers (optional; older data lacks it). */
  takerBuyVolume?: number | null;
  /** Number of trades in the candle (optional). */
  trades?: number | null;
  /** Perp funding rate active at this candle's time (optional; signal only). */
  fundingRate?: number | null;
  /** Perp open interest at this candle's time (optional; signal only). */
  openInterest?: number | null;
  /** Global long/short account ratio at this candle's time (optional; signal only). */
  longShortRatio?: number | null;
  /** Market-wide Fear & Greed Index (0-100) at this candle's time (optional). */
  fearGreed?: number | null;
}

/** What a strategy decides to do on a given candle. */
export type Signal = "BUY" | "SELL" | "HOLD";

/**
 * A trading strategy. Given the full candle series it returns one signal per
 * candle (same length). Spot only: BUY = be in the coin, SELL = be in cash.
 */
export interface Strategy {
  readonly name: string;
  readonly params: Record<string, number>;
  generate(candles: Candle[]): Signal[];
}

/** One completed spot trade: bought, then later sold. */
export interface Trade {
  entryTime: Date;
  entryPrice: number;
  exitTime: Date;
  exitPrice: number;
  pnlPct: number;
  bars: number;
}

/** The raw output of running a strategy over candles (before metrics). */
export interface RunResult {
  trades: Trade[];
  equityCurve: number[];
  finalEquity: number;
  initialCapital: number;
}
