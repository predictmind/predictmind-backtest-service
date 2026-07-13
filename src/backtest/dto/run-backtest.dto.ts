import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";

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
