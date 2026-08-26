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
    description:
      'Tanggal awal (YYYY-MM-DD). Difilter pada COALESCE(FinishReceipt.returnedAt, PecahBonEntry.pecahBonDate) — sudah disetor pakai tanggal setoran, belum disetor pakai tanggal pecah bon.',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Tanggal akhir (YYYY-MM-DD). Difilter pada COALESCE(FinishReceipt.returnedAt, PecahBonEntry.pecahBonDate).',
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
    description:
      'Urutan berdasarkan nomor LP (PecahBonEntry.pecahBonId). "asc" = LP terkecil di baris pertama.',
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
