import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class MonthQueryDto {
  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Kosong = bulan terbaru',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month harus YYYY-MM.' })
  month?: string;
}
