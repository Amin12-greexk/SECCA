import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class MergeRawBatchesDto {
  @ApiProperty({ type: [String], minItems: 2 })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsUUID(4, { each: true })
  sourceRawBatchIds: string[];

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  supplierId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  featherCondition: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  moisturePercent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty()
  @IsBoolean()
  confirmSupplier: boolean;

  @ApiProperty()
  @IsBoolean()
  confirmFeatherCondition: boolean;

  @ApiProperty()
  @IsBoolean()
  confirmMoisturePercent: boolean;

  @ApiProperty()
  @IsBoolean()
  confirmMerge: boolean;
}
