import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { BacktestController } from "./backtest/backtest.controller";

@Module({
  imports: [],
  controllers: [HealthController, BacktestController],
  providers: [],
})
export class AppModule {}