import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Backtest, Prisma } from "@prisma/client";
import { EngineOptions, runBacktest } from "../engine/backtest-engine";
import { computeMetrics, Metrics } from "../engine/metrics";
import { RuleSpec } from "../engine/rule-strategy";
import { BENCHMARK_STRATEGIES, createStrategy } from "../engine/strategies";
import { Candle, Strategy } from "../engine/types";
import { MarketClientService } from "../market/market-client.service";
import { PrismaService } from "../prisma/prisma.service";

export interface BacktestSummary {
  id: string;
  symbol: string;
  timeframe: string;
  strategy: string;
  params: Record<string, number>;
  candleCount: number;
  metrics: Metrics;
}

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly market: MarketClientService,
  ) {}

  /** Run one strategy over historical candles, store it, and return the summary. */
  async run(
    symbol: string,
    timeframe: string,
    strategyName: string,
    params: Record<string, number> = {},
    limit = 500,
    rules?: RuleSpec,
    engine: EngineOptions = {},
  ): Promise<BacktestSummary> {
    const strategy = createStrategy(strategyName, params, rules);
    const candles = await this.market.getCandles(symbol, timeframe, limit);
    if (candles.length < 10) {
      throw new NotFoundException(
        `Not enough candles for ${symbol} ${timeframe} (got ${candles.length}); import more in the market service first.`,
      );
    }

    // For the "rule" strategy we store the whole rule spec; otherwise the params.
    const storageParams = (strategyName === "rule" ? rules : params) ?? {};
    const { metrics, backtest } = await this.execute(
      symbol,
      timeframe,
      strategy,
      candles,
      storageParams as Prisma.InputJsonValue,
      engine,
    );

    return {
      id: backtest.id,
      symbol,
      timeframe,
      strategy: strategy.name,
      params: storageParams as Record<string, number>,
      candleCount: candles.length,
      metrics,
    };
  }

  /** Run every benchmark strategy on the same data and rank them by net profit. */
  async benchmark(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ symbol: string; timeframe: string; candleCount: number; ranking: BacktestSummary[] }> {
    const candles = await this.market.getCandles(symbol, timeframe, limit);
    if (candles.length < 10) {
      throw new NotFoundException(
        `Not enough candles for ${symbol} ${timeframe} (got ${candles.length}).`,
      );
    }

    const summaries: BacktestSummary[] = [];
    for (const name of BENCHMARK_STRATEGIES) {
      const strategy = createStrategy(name);
      const { metrics, backtest } = await this.execute(
        symbol,
        timeframe,
        strategy,
        candles,
        strategy.params as Prisma.InputJsonValue,
      );
      summaries.push({
        id: backtest.id,
        symbol,
        timeframe,
        strategy: strategy.name,
        params: strategy.params,
        candleCount: candles.length,
        metrics,
      });
    }

    summaries.sort((a, b) => b.metrics.netProfitPct - a.metrics.netProfitPct);
    return { symbol, timeframe, candleCount: candles.length, ranking: summaries };
  }

  /** Shared: run the engine on prepared candles and persist backtest + result + trades. */
  private async execute(
    symbol: string,
    timeframe: string,
    strategy: Strategy,
    candles: Candle[],
    storageParams: Prisma.InputJsonValue,
    engine: EngineOptions = {},
  ): Promise<{ metrics: Metrics; backtest: Backtest }> {
    const signals = strategy.generate(candles);
    const run = runBacktest(candles, signals, engine);
    const metrics = computeMetrics(run, candles, timeframe);

    const backtest = await this.prisma.backtest.create({
      data: {
        coinSymbol: symbol.toUpperCase(),
        timeframe,
        strategyName: strategy.name,
        params: storageParams,
        candleCount: candles.length,
        startTime: candles[0].openTime,
        endTime: candles[candles.length - 1].openTime,
        status: "COMPLETED",
        result: {
          create: {
            netProfitPct: metrics.netProfitPct,
            buyHoldPct: metrics.buyHoldPct,
            winRate: metrics.winRate,
            profitFactor: metrics.profitFactor,
            maxDrawdownPct: metrics.maxDrawdownPct,
            sharpe: metrics.sharpe,
            sortino: metrics.sortino,
            expectancyPct: metrics.expectancyPct,
            avgTradePct: metrics.avgTradePct,
            tradesCount: metrics.tradesCount,
            finalEquity: metrics.finalEquity,
          },
        },
        trades: {
          create: run.trades.map((t) => ({
            entryTime: t.entryTime,
            entryPrice: t.entryPrice,
            exitTime: t.exitTime,
            exitPrice: t.exitPrice,
            pnlPct: t.pnlPct,
            bars: t.bars,
          })),
        },
      },
    });

    return { metrics, backtest };
  }

  async findOne(id: string) {
    const backtest = await this.prisma.backtest.findUnique({
      where: { id },
      include: { result: true },
    });
    if (!backtest) throw new NotFoundException(`Backtest ${id} not found`);
    return backtest;
  }

  async findResult(id: string) {
    const result = await this.prisma.backtestResult.findUnique({
      where: { backtestId: id },
    });
    if (!result) throw new NotFoundException(`No result for backtest ${id}`);
    return result;
  }

  findTrades(id: string) {
    return this.prisma.backtestTrade.findMany({
      where: { backtestId: id },
      orderBy: { entryTime: "asc" },
    });
  }

  list(limit = 50) {
    return this.prisma.backtest.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { result: true },
    });
  }
}
