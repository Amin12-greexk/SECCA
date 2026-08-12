import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SummaryQueryDto {
  @ApiPropertyOptional({
    description: 'Kosongkan untuk memakai periode terbaru.',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;
}
