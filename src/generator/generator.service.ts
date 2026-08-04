import { Injectable, NotFoundException } from "@nestjs/common";
import { MarketClientService } from "../market/market-client.service";
import { generateAndRank, GeneratorOptions, GeneratorResult } from "./generator";
import {
  bestConfigTestTrades,
  optimizeTrades,
  TradeOptimizeOptions,
  TradeOptimizeResult,
  walkForwardOptimize,
  WalkForwardOptimizeOptions,
  WalkForwardOptimizeResult,
} from "./trade-optimizer";
import { PortfolioCoinInput, PortfolioResult, simulatePortfolio } from "./portfolio";
import {
  coinTrades,
  LivePortfolioOptions,
  LivePortfolioResult,
  simulateLivePortfolio,
  StrategyKind,
} from "./live-portfolio";
import { walkForward, WalkForwardOptions, WalkForwardResult } from "./walk-forward";

@Injectable()
export class GeneratorService {
  constructor(private readonly market: MarketClientService) {}

  /**
   * Fetch candles (with all signals attached), then search + rank strategies and
   * report their out-of-sample performance.
   */
  async generate(
    symbol: string,
    timeframe: string,
    limit = 1000,
    options: GeneratorOptions = {},
  ): Promise<GeneratorResult & { symbol: string; timeframe: string }> {
    const candles = await this.market.getCandles(symbol, timeframe, limit);
    if (candles.length < 60) {
      throw new NotFoundException(
        `Not enough candles for ${symbol} ${timeframe} (got ${candles.length}); import more first.`,
      );
    }
    const result = generateAndRank(candles, timeframe, options);
    return { symbol, timeframe, ...result };
  }

  /**
   * Walk-forward validation: measure how often our selection process beats
   * Buy & Hold / stays profitable across many consecutive out-of-sample windows.
   */
  async walkForward(
    symbol: string,
    timeframe: string,
    limit = 1000,
    options: WalkForwardOptions = {},
  ): Promise<WalkForwardResult & { symbol: string; timeframe: string }> {
    const candles = await this.market.getCandles(symbol, timeframe, limit);
    if (candles.length < 120) {
      throw new NotFoundException(
        `Not enough candles for ${symbol} ${timeframe} (got ${candles.length}); walk-forward needs more history.`,
      );
    }
    const result = walkForward(candles, timeframe, options);
    return { symbol, timeframe, ...result };
  }

  /**
   * Trade-quality optimizer: find the entry trigger + take-profit + stop-loss
   * with the best out-of-sample win rate (subject to profit factor ≥ 1).
   */
  async optimizeTrades(
    symbol: string,
    timeframe: string,
    limit = 2000,
    options: TradeOptimizeOptions = {},
  ): Promise<TradeOptimizeResult & { symbol: string; timeframe: string }> {
    const candles = await this.market.getCandles(symbol, timeframe, limit);
    if (candles.length < 120) {
      throw new NotFoundException(
        `Not enough candles for ${symbol} ${timeframe} (got ${candles.length}); import more first.`,
      );
    }
    const result = optimizeTrades(candles, timeframe, options);
    return { symbol, timeframe, ...result };
  }

  /**
   * Walk-forward trade optimizer: re-optimize the entry+TP+SL on the past for
   * every window and trade it on the unseen window; report the win rate across
   * ALL windows and which windows lost.
   */
  async walkForwardOptimize(
    symbol: string,
    timeframe: string,
    limit = 5000,
    options: WalkForwardOptimizeOptions = {},
  ): Promise<WalkForwardOptimizeResult & { symbol: string; timeframe: string }> {
    const candles = await this.market.getCandles(symbol, timeframe, limit);
    if (candles.length < 200) {
      throw new NotFoundException(
        `Not enough candles for ${symbol} ${timeframe} (got ${candles.length}); import more first.`,
      );
    }
    const result = walkForwardOptimize(candles, timeframe, options);
    return { symbol, timeframe, ...result };
  }

  /**
   * Portfolio backtest: for each coin, pick its best out-of-sample config and
   * collect its trades, then trade the whole basket together from one shared
   * balance. Reports the combined win rate, return and drawdown.
   */
  async portfolio(
    symbols: string[],
    timeframe: string,
    limit = 5000,
    options: TradeOptimizeOptions & { allocFraction?: number } = {},
  ): Promise<PortfolioResult & { timeframe: string; symbols: string[]; skipped: string[] }> {
    const inputs: PortfolioCoinInput[] = [];
    const skipped: string[] = [];
    for (const symbol of symbols) {
      const candles = await this.market.getCandles(symbol, timeframe, limit);
      if (candles.length < 300) {
        skipped.push(symbol);
        continue;
      }
      const best = bestConfigTestTrades(candles, timeframe, options);
      if (!best || best.trades.length === 0) {
        skipped.push(symbol);
        continue;
      }
      inputs.push({
        symbol,
        entryLabel: best.entryLabel,
        stopLossPct: best.stopLossPct,
        takeProfitRR: best.takeProfitRR,
        trades: best.trades,
      });
    }
    const result = simulatePortfolio(inputs, { allocFraction: options.allocFraction });
    return { timeframe, symbols, skipped, ...result };
  }

  /**
   * Live-style portfolio: trade each coin with its assigned strategy on ONE
   * shared, capital-constrained balance (a trade locks a fixed slice; no free
   * cash = skip the signal). Answers "with ₹X, how does my balance actually
   * grow when trades compete for the same funds?".
   */
  async livePortfolio(
    dipCoins: string[],
    breakoutCoins: string[],
    timeframe: string,
    limit = 930,
    options: LivePortfolioOptions = {},
    swingCoins: string[] = [],
  ): Promise<LivePortfolioResult & { timeframe: string }> {
    const assigned: { symbol: string; kind: StrategyKind }[] = [
      ...dipCoins.map((s) => ({ symbol: s.toUpperCase(), kind: "dip" as StrategyKind })),
      ...breakoutCoins.map((s) => ({ symbol: s.toUpperCase(), kind: "breakout" as StrategyKind })),
      ...swingCoins.map((s) => ({ symbol: s.toUpperCase(), kind: "swing" as StrategyKind })),
    ];

    const endOffset = options.endOffset ?? 0;
    const allTrades: { symbol: string; kind: StrategyKind; entryMs: number; exitMs: number; pnlPct: number }[] = [];
    const perCoin: { symbol: string; kind: StrategyKind; signals: number }[] = [];
    for (const a of assigned) {
      const fetched = await this.market.getCandles(a.symbol, timeframe, limit + endOffset);
      // Optionally end the window earlier (drop the most recent `endOffset` candles)
      // so we can replay a past period (e.g. a month during a past bull).
      const candles = endOffset > 0 ? fetched.slice(0, Math.max(0, fetched.length - endOffset)) : fetched;
      if (candles.length < 250) {
        perCoin.push({ symbol: a.symbol, kind: a.kind, signals: 0 });
        continue;
      }
      const trades = coinTrades(candles, a.kind).map((t) => ({ ...t, symbol: a.symbol }));
      perCoin.push({ symbol: a.symbol, kind: a.kind, signals: trades.length });
      allTrades.push(...trades);
    }

    const sim = simulateLivePortfolio(allTrades, options);
    return { timeframe, ...sim, perCoin };
  }
}
