import { Injectable, NotFoundException } from "@nestjs/common";
import { MarketClientService } from "../market/market-client.service";
import { generateAndRank, GeneratorOptions, GeneratorResult } from "./generator";

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
}
