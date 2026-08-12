import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PayrollSummaryQueryDto {
  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-02-29' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Filter ringkasan untuk 1 mitra tertentu',
    example: '89b2f2f0-8a4d-49fc-a5a0-1e60f55be2f2',
  })
  @IsOptional()
  @IsUUID()
  workerId?: string;
}
