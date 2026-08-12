import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { FinishResultGradeEntryDto } from './finish-result-grade-entry.dto';

export class UpdateFinishReceiptDto {
  @ApiPropertyOptional({ description: 'Timestamp setoran ISO string' })
  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber()
  @Min(0)
  mainOutWeightGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber()
  @Min(0)
  byProductWeightGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  barangJadiId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [FinishResultGradeEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinishResultGradeEntryDto)
  resultGrades?: FinishResultGradeEntryDto[];
}
