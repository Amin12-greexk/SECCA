import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class LinkExcelNameDto {
  @ApiProperty({
    description: 'Nama lengkap di file PIN',
    example: 'SITI SARIAH',
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Nama di Excel performa; null untuk melepas hubungan',
    example: 'SARIAH',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  excelName?: string | null;
}
