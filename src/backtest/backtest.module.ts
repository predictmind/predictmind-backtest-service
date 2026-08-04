import { Module } from "@nestjs/common";
import { GeneratorService } from "../generator/generator.service";
import { MarketClientService } from "../market/market-client.service";
import { BacktestController } from "./backtest.controller";
import { BacktestService } from "./backtest.service";

@Module({
  controllers: [BacktestController],
  providers: [BacktestService, MarketClientService, GeneratorService],
})
export class BacktestModule {}
