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
}
