import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from "class-validator";

export class RunBacktestDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  symbol!: string;

  @ApiProperty({ example: "1h" })
  @IsString()
  timeframe!: string;

  @ApiProperty({ example: "sma_crossover", description: "Strategy name" })
  @IsString()
  strategy!: string;

  @ApiPropertyOptional({
    description: "Strategy parameters, e.g. { fast: 20, slow: 50 }",
    type: "object",
    additionalProperties: { type: "number" },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, number>;

  @ApiPropertyOptional({
    description:
      'For strategy "rule": a { entry, exit } spec combining indicators and patterns',
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Risk controls: { stopLossPct, atrMult, atrPeriod, takeProfitRR, riskPerTradePct }",
    type: "object",
    additionalProperties: { type: "number" },
  })
  @IsOptional()
  @IsObject()
  risk?: Record<string, number>;

  @ApiPropertyOptional({ description: "Number of candles to test", default: 500 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(5000)
  limit?: number;
}

export class BenchmarkDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  symbol!: string;

  @ApiProperty({ example: "1h" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ default: 500 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(5000)
  limit?: number;
}

export class GenerateDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  symbol!: string;

  @ApiProperty({ example: "4h" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ description: "Candles to use (train + test)", default: 1000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(60)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({ description: "In-sample fraction (0.5-0.9)", default: 0.7 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.5)
  @Max(0.9)
  trainFraction?: number;

  @ApiPropertyOptional({ description: "Min trades in-sample to consider a candidate", default: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  minTrades?: number;

  @ApiPropertyOptional({ description: "How many finalists to return", default: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  topN?: number;

  @ApiPropertyOptional({
    description: "Risk controls applied to every candidate (same shape as backtest risk)",
    type: "object",
    additionalProperties: { type: "number" },
  })
  @IsOptional()
  @IsObject()
  risk?: Record<string, number>;
}

export class WalkForwardDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  symbol!: string;

  @ApiProperty({ example: "1d" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ description: "Candles of history to walk through", default: 1000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(120)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({ description: "Number of out-of-sample windows", default: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2)
  @Max(12)
  folds?: number;

  @ApiPropertyOptional({ description: "Initial train block fraction (0.3-0.8)", default: 0.5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.3)
  @Max(0.8)
  minTrainFraction?: number;

  @ApiPropertyOptional({ description: "Min in-sample trades to trust a candidate", default: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  minTrades?: number;

  @ApiPropertyOptional({
    description: "Risk controls applied to every candidate (same shape as backtest risk)",
    type: "object",
    additionalProperties: { type: "number" },
  })
  @IsOptional()
  @IsObject()
  risk?: Record<string, number>;
}

/** Map a plain risk object (from a request) to engine options. */
export function toEngineOptions(risk?: Record<string, number>): {
  stopLossPct?: number;
  atrMult?: number;
  atrPeriod?: number;
  takeProfitRR?: number;
  riskPerTradePct?: number;
} {
  if (!risk) return {};
  const out: Record<string, number> = {};
  for (const key of ["stopLossPct", "atrMult", "atrPeriod", "takeProfitRR", "riskPerTradePct"]) {
    if (typeof risk[key] === "number") out[key] = risk[key];
  }
  return out;
}
