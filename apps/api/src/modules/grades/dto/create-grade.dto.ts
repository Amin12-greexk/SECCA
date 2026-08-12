import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { GradeType } from '@prisma/client';

export class CreateGradeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  code: string;

  @ApiProperty({ enum: GradeType })
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(GradeType)
  type: GradeType;
}
