import { Module } from "@nestjs/common";
import { MarketClientService } from "../market/market-client.service";
import { BacktestController } from "./backtest.controller";
import { BacktestService } from "./backtest.service";

@Module({
  controllers: [BacktestController],
  providers: [BacktestService, MarketClientService],
})
export class BacktestModule {}
