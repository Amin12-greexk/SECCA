import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export type EvaluationGroupBy = 'mitra' | 'grade' | 'day' | 'week' | 'month';

export class QueryEvaluationSummaryDto {
  @ApiPropertyOptional({
    description: 'Tanggal mulai (YYYY-MM-DD), berdasarkan returnedAt',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Tanggal akhir (YYYY-MM-DD), berdasarkan returnedAt',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: ['mitra', 'grade', 'day', 'week', 'month'],
    default: 'mitra',
    description: 'Dimensi pengelompokan rekap evaluasi',
  })
  @IsOptional()
  @IsIn(['mitra', 'grade', 'day', 'week', 'month'])
  groupBy?: EvaluationGroupBy;
}
