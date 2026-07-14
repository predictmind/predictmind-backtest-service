import { Injectable, NotFoundException } from "@nestjs/common";
import { MarketClientService } from "../market/market-client.service";
import { generateAndRank, GeneratorOptions, GeneratorResult } from "./generator";
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
}
