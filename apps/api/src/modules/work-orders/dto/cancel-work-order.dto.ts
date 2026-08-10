import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelWorkOrderDto {
  @ApiPropertyOptional({ description: 'Target worker ID for reassignment (optional)' })
  @IsString()
  @IsOptional()
  reassignToWorkerId?: string;
}
