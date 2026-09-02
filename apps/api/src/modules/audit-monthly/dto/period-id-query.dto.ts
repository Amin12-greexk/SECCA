import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class PeriodIdQueryDto {
  @ApiPropertyOptional({
    description: 'Kosongkan untuk memakai bulan terbaru.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
