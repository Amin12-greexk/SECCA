import { ApiPropertyOptional } from '@nestjs/swagger';
import { RackType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createDefaults?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: RackType })
  @IsOptional()
  @IsEnum(RackType)
  type?: RackType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productionRoomId?: string;
}
