import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

const OBJECTIVES = ["winRate", "profit", "profitFactor"] as const;

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

export class OptimizeDto {
  @ApiProperty({ example: "BTC" })
  @IsString()
  symbol!: string;

  @ApiProperty({ example: "4h" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ description: "Candles to use (train + test)", default: 2000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(120)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({ description: "In-sample fraction (0.5-0.9)", default: 0.7 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.5)
  @Max(0.9)
  trainFraction?: number;

  @ApiPropertyOptional({ description: "Min trades per slice to trust a config", default: 8 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(3)
  @Max(200)
  minTrades?: number;

  @ApiPropertyOptional({ description: "Min profit factor guard (winners/losers)", default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.5)
  @Max(5)
  minProfitFactor?: number;

  @ApiPropertyOptional({ description: "How many top configs to return", default: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(20)
  topN?: number;

  @ApiPropertyOptional({ description: "Rank by", enum: OBJECTIVES, default: "winRate" })
  @IsOptional()
  @IsIn(OBJECTIVES as unknown as string[])
  objective?: (typeof OBJECTIVES)[number];

  @ApiPropertyOptional({ description: "Only trade when market (BTC + coin) is in an uptrend" })
  @IsOptional()
  @IsBoolean()
  regimeFilter?: boolean;

  @ApiPropertyOptional({ description: "Trailing stop fraction (e.g. 0.08)" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.005)
  @Max(0.5)
  trailingStopPct?: number;

  @ApiPropertyOptional({ description: "Time-based exit after N candles" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(500)
  maxHoldBars?: number;

  @ApiPropertyOptional({ description: "Cooldown candles after an exit" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(100)
  cooldownBars?: number;

  @ApiPropertyOptional({ description: "Stop-loss widths to search (fractions)", type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  stopLossPcts?: number[];

  @ApiPropertyOptional({ description: "Take-profit ratios (TP = RR x stop)", type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  takeProfitRRs?: number[];
}

export class LivePortfolioDto {
  @ApiProperty({ description: "Coins traded with the dip-buy strategy", type: [String], example: ["ETH", "BNB", "LTC"] })
  @IsArray()
  @IsString({ each: true })
  dipCoins!: string[];

  @ApiProperty({ description: "Coins traded with the breakout strategy", type: [String], example: ["XLM", "XRP", "DOGE"] })
  @IsArray()
  @IsString({ each: true })
  breakoutCoins!: string[];

  @ApiProperty({ example: "1d" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ description: "Candles of the live period (incl. 200 warmup)", default: 930 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(250)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({ description: "Starting balance", default: 10000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  initialCapital?: number;

  @ApiPropertyOptional({ description: "Slice per trade = fraction of balance", default: 0.1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.02)
  @Max(1)
  allocFraction?: number;

  @ApiPropertyOptional({ description: "Reinvest profits: size each trade off the CURRENT balance", default: false })
  @IsOptional()
  @IsBoolean()
  compound?: boolean;

  @ApiPropertyOptional({ description: "End the window this many candles before now (replay a past period)", default: 0 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(3000)
  endOffset?: number;
}

export class PortfolioDto {
  @ApiProperty({ description: "Coins to trade as a basket", type: [String], example: ["DOT", "XRP", "BNB"] })
  @IsArray()
  @IsString({ each: true })
  symbols!: string[];

  @ApiProperty({ example: "4h" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ description: "Candles per coin (last ~5-6y)", default: 5000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(300)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({ description: "In-sample fraction", default: 0.6 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.5)
  @Max(0.9)
  trainFraction?: number;

  @ApiPropertyOptional({ description: "Min profit factor guard", default: 1.1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.5)
  @Max(5)
  minProfitFactor?: number;

  @ApiPropertyOptional({ description: "Rank by", enum: OBJECTIVES, default: "winRate" })
  @IsOptional()
  @IsIn(OBJECTIVES as unknown as string[])
  objective?: (typeof OBJECTIVES)[number];

  @ApiPropertyOptional({ description: "Robustness-first selection (consistent across train sub-periods)", default: false })
  @IsOptional()
  @IsBoolean()
  robust?: boolean;

  @ApiPropertyOptional({ description: "Train quality gate: keep coin only if config is this consistent across sub-periods (0-1)" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @Max(1)
  minConsistency?: number;

  @ApiPropertyOptional({ description: "Only trade when market (BTC + coin) is in an uptrend", default: false })
  @IsOptional()
  @IsBoolean()
  regimeFilter?: boolean;

  @ApiPropertyOptional({ description: "Trailing stop fraction (e.g. 0.05 = trail 5% below peak)" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.005)
  @Max(0.5)
  trailingStopPct?: number;

  @ApiPropertyOptional({ description: "Time-based exit after N candles" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(500)
  maxHoldBars?: number;

  @ApiPropertyOptional({ description: "Cooldown candles after an exit before re-entering" })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  @Max(100)
  cooldownBars?: number;

  @ApiPropertyOptional({ description: "Fraction of balance risked per trade", default: 0.1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.01)
  @Max(1)
  allocFraction?: number;

  @ApiPropertyOptional({ description: "Stop-loss widths to search (fractions)", type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  stopLossPcts?: number[];

  @ApiPropertyOptional({ description: "Take-profit ratios (TP = RR x stop)", type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  takeProfitRRs?: number[];
}

export class WalkForwardOptimizeDto {
  @ApiProperty({ example: "DOGE" })
  @IsString()
  symbol!: string;

  @ApiProperty({ example: "4h" })
  @IsString()
  timeframe!: string;

  @ApiPropertyOptional({ description: "Candles of history to walk through", default: 5000 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(200)
  @Max(5000)
  limit?: number;

  @ApiPropertyOptional({ description: "Number of out-of-sample windows", default: 6 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(2)
  @Max(12)
  folds?: number;

  @ApiPropertyOptional({ description: "Initial train block fraction (0.3-0.8)", default: 0.4 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.3)
  @Max(0.8)
  minTrainFraction?: number;

  @ApiPropertyOptional({ description: "Min trades per slice", default: 5 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(3)
  @Max(200)
  minTrades?: number;

  @ApiPropertyOptional({ description: "Min profit factor guard", default: 1.1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0.5)
  @Max(5)
  minProfitFactor?: number;

  @ApiPropertyOptional({ description: "Stop-loss widths to search (fractions)", type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  stopLossPcts?: number[];

  @ApiPropertyOptional({ description: "Take-profit ratios (TP = RR x stop)", type: [Number] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  takeProfitRRs?: number[];

  @ApiPropertyOptional({ description: "Rank by", enum: OBJECTIVES, default: "winRate" })
  @IsOptional()
  @IsIn(OBJECTIVES as unknown as string[])
  objective?: (typeof OBJECTIVES)[number];
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
  trailingStopPct?: number;
  maxHoldBars?: number;
  cooldownBars?: number;
  breakEvenAtR?: number;
} {
  if (!risk) return {};
  const out: Record<string, number> = {};
  for (const key of [
    "stopLossPct",
    "atrMult",
    "atrPeriod",
    "takeProfitRR",
    "riskPerTradePct",
    "trailingStopPct",
    "maxHoldBars",
    "cooldownBars",
    "breakEvenAtR",
  ]) {
    if (typeof risk[key] === "number") out[key] = risk[key];
  }
  return out;
}
