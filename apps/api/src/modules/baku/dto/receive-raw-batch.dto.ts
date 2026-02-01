import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export enum RawBatchOrigin {
  KAL = "KAL",
  SBY = "SBY",
  RBI = "RBI",
  LPG = "LPG",
  OTHER = "OTHER",
}

export enum FeatherConditionInput {
  Light = "Light",
  Medium = "Medium",
  Heavy = "Heavy",
}

export class ReceiveRawBatchDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty({ enum: RawBatchOrigin })
  @IsEnum(RawBatchOrigin)
  @IsNotEmpty()
  origin: RawBatchOrigin;

  @ApiProperty({ enum: FeatherConditionInput })
  @IsEnum(FeatherConditionInput)
  @IsNotEmpty()
  featherCondition: FeatherConditionInput;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  wetWeightGram: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  moisturePercent: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pieceCount: number;
}
