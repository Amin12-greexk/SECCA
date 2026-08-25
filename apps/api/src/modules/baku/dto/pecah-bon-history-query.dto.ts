import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PecahBonHistoryQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Tanggal setoran awal (YYYY-MM-DD) — filter pada FinishReceipt.returnedAt',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Tanggal setoran akhir (YYYY-MM-DD) — filter pada FinishReceipt.returnedAt',
    example: '2026-02-29',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Cari berdasarkan ID LP, batch, grade, atau kondisi',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'asc',
    description: 'Urutan data berdasarkan tanggal setoran (FinishReceipt.returnedAt)',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({
    enum: ['all', 'yes', 'no'],
    default: 'all',
    description:
      'Filter status setoran: "yes" cuma yang sudah disetor (FinishReceipt.returnedAt terisi), "no" cuma yang belum disetor',
  })
  @IsOptional()
  @IsIn(['all', 'yes', 'no'])
  submitted?: 'all' | 'yes' | 'no' = 'all';
}
