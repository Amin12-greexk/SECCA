import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdatePecahBonDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  gradeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  featherGradeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  colorGradeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  featherCondition: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pieceCount: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  initialWeightGram: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  moisturePercent: number;
}
