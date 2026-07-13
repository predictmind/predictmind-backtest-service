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
    await this.attachOpenInterest(symbol, timeframe, candles);
    await this.attachLongShort(symbol, timeframe, candles);
    return candles;
  }

  /**
   * Attach a time-series signal to each candle: for every candle, take the most
   * recent point at/or before its openTime (a two-pointer walk over both
   * ascending series). Best-effort — a fetch/parse failure just leaves the field
   * untouched (null), so a missing signal never breaks a backtest.
   */
  private async attachSeries(
    url: string,
    candles: Candle[],
    parse: (raw: unknown) => { time: number; value: number }[],
    assign: (candle: Candle, value: number) => void,
    label: string,
  ): Promise<void> {
    if (candles.length === 0) return;
    let raw: unknown;
    try {
      raw = await this.getJson<unknown>(url);
    } catch {
      this.logger.warn(`No ${label} data; leaving it null`);
      return;
    }
    const points = parse(raw).sort((a, b) => a.time - b.time);
    if (points.length === 0) return;

    let p = 0;
    for (const candle of candles) {
      const t = candle.openTime.getTime();
      while (p + 1 < points.length && points[p + 1].time <= t) p++;
      if (points[p].time <= t) assign(candle, points[p].value);
    }
  }

  /** Funding rate is published ~every 8h; align it to each candle. */
  private attachFunding(symbol: string, candles: Candle[]): Promise<void> {
    const url = `${this.baseUrl()}/api/v1/market/funding?symbol=${encodeURIComponent(symbol)}&limit=2000`;
    return this.attachSeries(
      url,
      candles,
      (raw) =>
        (raw as { fundingRate: string; fundingTime: string }[]).map((f) => ({
          time: new Date(f.fundingTime).getTime(),
          value: Number(f.fundingRate),
        })),
      (candle, value) => {
        candle.fundingRate = value;
      },
      `funding for ${symbol}`,
    );
  }

  /** Open interest is per timeframe; align it to each candle. */
  private attachOpenInterest(
    symbol: string,
    timeframe: string,
    candles: Candle[],
  ): Promise<void> {
    const url = `${this.baseUrl()}/api/v1/market/oi?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=2000`;
    return this.attachSeries(
      url,
      candles,
      (raw) =>
        (raw as { openInterest: string; timestamp: string }[]).map((o) => ({
          time: new Date(o.timestamp).getTime(),
          value: Number(o.openInterest),
        })),
      (candle, value) => {
        candle.openInterest = value;
      },
      `open interest for ${symbol} ${timeframe}`,
    );
  }

  /** Global long/short account ratio is per timeframe; align it to each candle. */
  private attachLongShort(
    symbol: string,
    timeframe: string,
    candles: Candle[],
  ): Promise<void> {
    const url = `${this.baseUrl()}/api/v1/market/lsr?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=2000`;
    return this.attachSeries(
      url,
      candles,
      (raw) =>
        (raw as { longShortRatio: string; timestamp: string }[]).map((r) => ({
          time: new Date(r.timestamp).getTime(),
          value: Number(r.longShortRatio),
        })),
      (candle, value) => {
        candle.longShortRatio = value;
      },
      `long/short ratio for ${symbol} ${timeframe}`,
    );
  }
}
