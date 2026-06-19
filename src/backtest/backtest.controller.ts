import { Controller, Get } from "@nestjs/common";

// Backtesting engine and performance metrics
@Controller("backtest")
export class BacktestController {
  @Get()
  info(): { service: string; description: string } {
    return {
      service: "backtest",
      description: "Backtesting engine and performance metrics",
    };
  }
}