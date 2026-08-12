import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class WeeklyReportQueryDto {
  @ApiProperty({
    description: 'Tanggal mulai (YYYY-MM-DD)',
    example: '2026-08-06',
  })
  @IsDateString()
  from!: string;

  @ApiProperty({
    description: 'Tanggal akhir (YYYY-MM-DD)',
    example: '2026-08-12',
  })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({
    description:
      'Hari kerja dalam JSON array (YYYY-MM-DD). Jika tidak diisi, default semua hari kecuali Minggu. Contoh: ["2026-08-06","2026-08-07","2026-08-08","2026-08-09","2026-08-11","2026-08-12"]',
    example: '["2026-08-06","2026-08-07"]',
  })
  @IsOptional()
  @IsString()
  workDays?: string;
}
