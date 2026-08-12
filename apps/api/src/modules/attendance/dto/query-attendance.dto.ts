import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class QueryAttendanceDto {
  @ApiPropertyOptional({
    description: 'Tanggal mulai (YYYY-MM-DD)',
    example: '2026-02-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Tanggal akhir (YYYY-MM-DD)',
    example: '2026-02-29',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
