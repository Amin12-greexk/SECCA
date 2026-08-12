import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class QueryTrainerWorkersDto {
  @ApiPropertyOptional({
    description:
      'Filter trainerId. Hanya dipakai manager/koreksi/baku bila perlu audit.',
  })
  @IsOptional()
  @IsUUID()
  trainerId?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Sertakan worker tanpa trainerId',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).toLowerCase();
    return normalized === 'true' || normalized === '1';
  })
  @IsBoolean()
  includeUnassigned?: boolean = false;
}
