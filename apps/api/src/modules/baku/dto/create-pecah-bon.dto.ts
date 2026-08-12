import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePecahBonDto {
  @ApiPropertyOptional({
    description: 'Aggregate trainer order used for this pecah bon',
  })
  @IsOptional()
  @IsUUID()
  trainerOrderRequestId?: string;

  @ApiPropertyOptional({
    description: 'Direct mitra order used for this pecah bon',
  })
  @IsOptional()
  @IsUUID()
  mitraOrderRequestId?: string;

  @ApiPropertyOptional({
    description: 'Nama mitra yang diorder (untuk cetak kartu)',
  })
  @IsString()
  @IsOptional()
  orderedForName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productionRoomId?: string;

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
  @IsDateString()
  @IsNotEmpty()
  pecahBonDate: string;

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
