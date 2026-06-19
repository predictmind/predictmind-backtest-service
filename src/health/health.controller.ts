import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: "ok",
      service: "predictmind-backtest-service",
      timestamp: new Date().toISOString(),
    };
  }
}