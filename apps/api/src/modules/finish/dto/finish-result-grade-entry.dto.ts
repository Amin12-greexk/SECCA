import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class FinishResultGradeEntryDto {
  @ApiProperty({ example: 'uuid-grade-result' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  resultGradeTypeId: string;

  @ApiProperty({ example: 12, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  weightGram: number;
}
