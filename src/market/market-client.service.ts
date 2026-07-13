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
  takerBuyVolume?: string | null;
  trades?: number | null;
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

  private baseUrl(): string {
    return this.config.get<string>("MARKET_SERVICE_URL", "http://localhost:3003");
  }

  private async getJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`market service returned ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async getCandles(
    symbol: string,
    timeframe: string,
    limit: number,
  ): Promise<Candle[]> {
    const url = `${this.baseUrl()}/api/v1/market/candles?symbol=${encodeURIComponent(
      symbol,
    )}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`;

    let candles: Candle[];
    try {
      const raw = await this.getJson<RawCandle[]>(url);
      candles = raw
        .map((c) => ({
          openTime: new Date(c.openTime),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
          takerBuyVolume: c.takerBuyVolume != null ? Number(c.takerBuyVolume) : null,
          trades: c.trades ?? null,
          fundingRate: null as number | null,
        }))
        // Ensure ascending chronological order for the engine.
        .sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Failed to fetch candles for ${symbol} ${timeframe}: ${message}`);
      throw error;
    }

    await this.attachFunding(symbol, candles);
    return candles;
  }

  /**
   * Attach the funding rate active at each candle's time. Funding is published
   * ~every 8h, so for each candle we use the most recent funding at/or before its
   * openTime (a two-pointer walk over both ascending series). Best-effort: if
   * funding can't be fetched, candles keep fundingRate = null.
   */
  private async attachFunding(symbol: string, candles: Candle[]): Promise<void> {
    if (candles.length === 0) return;
    const url = `${this.baseUrl()}/api/v1/market/funding?symbol=${encodeURIComponent(symbol)}&limit=2000`;
    let funding: { fundingRate: string; fundingTime: string }[];
    try {
      funding = await this.getJson<{ fundingRate: string; fundingTime: string }[]>(url);
    } catch {
      this.logger.warn(`No funding data for ${symbol}; leaving fundingRate null`);
      return;
    }
    const points = funding
      .map((f) => ({ rate: Number(f.fundingRate), time: new Date(f.fundingTime).getTime() }))
      .sort((a, b) => a.time - b.time);
    if (points.length === 0) return;

    let p = 0;
    for (const candle of candles) {
      const t = candle.openTime.getTime();
      while (p + 1 < points.length && points[p + 1].time <= t) p++;
      candle.fundingRate = points[p].time <= t ? points[p].rate : null;
    }
  }
}
