import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { GradeType } from '@prisma/client';

export class UpdateGradeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @ApiPropertyOptional({ enum: GradeType })
  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(GradeType)
  type?: GradeType;
}
