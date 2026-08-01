import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RuleSpec } from "../engine/rule-strategy";
import { GeneratorService } from "../generator/generator.service";
import { BacktestService } from "./backtest.service";
import {
  BenchmarkDto,
  GenerateDto,
  LivePortfolioDto,
  OptimizeDto,
  PortfolioDto,
  RunBacktestDto,
  toEngineOptions,
  WalkForwardDto,
  WalkForwardOptimizeDto,
} from "./dto/run-backtest.dto";

@ApiTags("backtests")
@Controller("backtests")
export class BacktestController {
  constructor(
    private readonly backtest: BacktestService,
    private readonly generator: GeneratorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Run a backtest of one strategy on a coin/timeframe" })
  run(@Body() dto: RunBacktestDto) {
    return this.backtest.run(
      dto.symbol,
      dto.timeframe,
      dto.strategy,
      dto.params ?? {},
      dto.limit ?? 500,
      dto.rules as unknown as RuleSpec | undefined,
      toEngineOptions(dto.risk),
    );
  }

  @Post("benchmark")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Run all benchmark strategies and rank them (beat-the-field test)" })
  benchmark(@Body() dto: BenchmarkDto) {
    return this.backtest.benchmark(dto.symbol, dto.timeframe, dto.limit ?? 500);
  }

  @Post("generate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Generate strategies: search the candidate space, rank in-sample, report out-of-sample (E10)",
  })
  generate(@Body() dto: GenerateDto) {
    return this.generator.generate(dto.symbol, dto.timeframe, dto.limit ?? 1000, {
      trainFraction: dto.trainFraction,
      minTrades: dto.minTrades,
      topN: dto.topN,
      engine: toEngineOptions(dto.risk),
    });
  }

  @Post("walkforward")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Walk-forward validation: success rate of the selection process across many out-of-sample windows (E13)",
  })
  walkForward(@Body() dto: WalkForwardDto) {
    return this.generator.walkForward(dto.symbol, dto.timeframe, dto.limit ?? 1000, {
      folds: dto.folds,
      minTrainFraction: dto.minTrainFraction,
      minTrades: dto.minTrades,
      engine: toEngineOptions(dto.risk),
    });
  }

  @Post("optimize")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Trade-quality optimizer: best entry + take-profit + stop-loss by out-of-sample win rate (PF>=1)",
  })
  optimize(@Body() dto: OptimizeDto) {
    return this.generator.optimizeTrades(dto.symbol, dto.timeframe, dto.limit ?? 2000, {
      trainFraction: dto.trainFraction,
      minTrades: dto.minTrades,
      minProfitFactor: dto.minProfitFactor,
      topN: dto.topN,
      objective: dto.objective,
      regimeFilter: dto.regimeFilter,
      trailingStopPct: dto.trailingStopPct,
      maxHoldBars: dto.maxHoldBars,
      cooldownBars: dto.cooldownBars,
      stopLossPcts: dto.stopLossPcts,
      takeProfitRRs: dto.takeProfitRRs,
    });
  }

  @Post("optimize/walkforward")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Walk-forward trade optimizer: win rate across ALL windows (re-optimised each window) + losing windows",
  })
  optimizeWalkForward(@Body() dto: WalkForwardOptimizeDto) {
    return this.generator.walkForwardOptimize(dto.symbol, dto.timeframe, dto.limit ?? 5000, {
      folds: dto.folds,
      minTrainFraction: dto.minTrainFraction,
      minTrades: dto.minTrades,
      minProfitFactor: dto.minProfitFactor,
      stopLossPcts: dto.stopLossPcts,
      takeProfitRRs: dto.takeProfitRRs,
      objective: dto.objective,
    });
  }

  @Post("portfolio")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Portfolio backtest: trade a basket of coins together (best OOS config each)",
  })
  portfolio(@Body() dto: PortfolioDto) {
    return this.generator.portfolio(dto.symbols, dto.timeframe, dto.limit ?? 5000, {
      trainFraction: dto.trainFraction,
      minProfitFactor: dto.minProfitFactor,
      objective: dto.objective,
      robust: dto.robust,
      minConsistency: dto.minConsistency,
      regimeFilter: dto.regimeFilter,
      trailingStopPct: dto.trailingStopPct,
      maxHoldBars: dto.maxHoldBars,
      cooldownBars: dto.cooldownBars,
      allocFraction: dto.allocFraction,
      stopLossPcts: dto.stopLossPcts,
      takeProfitRRs: dto.takeProfitRRs,
    });
  }

  @Post("portfolio/live")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Live-style portfolio: shared capital-constrained balance across coins (trades lock funds)",
  })
  livePortfolio(@Body() dto: LivePortfolioDto) {
    return this.generator.livePortfolio(
      dto.dipCoins,
      dto.breakoutCoins,
      dto.timeframe,
      dto.limit ?? 930,
      { initialCapital: dto.initialCapital, allocFraction: dto.allocFraction },
    );
  }

  @Get()
  @ApiOperation({ summary: "List recent backtests" })
  list(@Query("limit") limit?: string) {
    return this.backtest.list(limit ? Number(limit) : 50);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a backtest and its metrics" })
  findOne(@Param("id") id: string) {
    return this.backtest.findOne(id);
  }

  @Get(":id/results")
  @ApiOperation({ summary: "Get a backtest's performance metrics" })
  results(@Param("id") id: string) {
    return this.backtest.findResult(id);
  }

  @Get(":id/trades")
  @ApiOperation({ summary: "Get a backtest's simulated trade log" })
  trades(@Param("id") id: string) {
    return this.backtest.findTrades(id);
  }
}
