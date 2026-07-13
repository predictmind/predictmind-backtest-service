import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Candle } from "../engine/types";

/** Candle shape returned by the market service (numbers arrive as strings). */
interface RawCandle {
  openTime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

/**
 * Reads historical candles from the market service (east-west call). The
 * backtest engine never touches the market database directly — it asks the
 * owning service over HTTP, honouring the "each service owns its data" rule.
 */
@Injectable()
export class MarketClientService {
  private readonly logger = new Logger(MarketClientService.name);

  constructor(private readonly config: ConfigService) {}

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    const baseUrl = this.config.get<string>(
      "MARKET_SERVICE_URL",
      "http://localhost:3003",
    );
    const url = `${baseUrl}/api/v1/market/candles?symbol=${encodeURIComponent(
      symbol,
    )}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`market service returned ${res.status}`);
      }
      const raw = (await res.json()) as RawCandle[];
      return raw
        .map((c) => ({
          openTime: new Date(c.openTime),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
        }))
        // Ensure ascending chronological order for the engine.
        .sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Failed to fetch candles for ${symbol} ${timeframe}: ${message}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
