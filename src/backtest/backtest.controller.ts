import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BacktestService } from "./backtest.service";
import { BenchmarkDto, RunBacktestDto } from "./dto/run-backtest.dto";

@ApiTags("backtests")
@Controller("backtests")
export class BacktestController {
  constructor(private readonly backtest: BacktestService) {}

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
    );
  }

  @Post("benchmark")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Run all benchmark strategies and rank them (beat-the-field test)" })
  benchmark(@Body() dto: BenchmarkDto) {
    return this.backtest.benchmark(dto.symbol, dto.timeframe, dto.limit ?? 500);
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
