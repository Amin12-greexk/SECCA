import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const CLOCK_MESSAGE = 'Jam harus berformat HH:MM (00:00–23:59).';

export class PresensiQueryDto {
  @ApiPropertyOptional({
    example: '2026-10',
    description: 'Bulan YYYY-MM; kosong = bulan terbaru',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month harus YYYY-MM.' })
  month?: string;

  @ApiPropertyOptional({
    example: '2026-10-15',
    description: 'Awal minggu (Kamis); kosong = sebulan penuh',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'weekStart harus YYYY-MM-DD.' })
  weekStart?: string;

  @ApiPropertyOptional({ enum: ['1', '2'] })
  @IsOptional()
  @IsIn(['1', '2'])
  shift?: string;

  @ApiPropertyOptional({ description: 'Cari nama atau PIN' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({
    description: '1 = sertakan catatan harian tiap orang',
  })
  @IsOptional()
  @IsIn(['0', '1'])
  detail?: string;
}

export class UpdatePresensiDto {
  @ApiPropertyOptional({ example: '07:31', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(CLOCK, { message: CLOCK_MESSAGE })
  clockIn?: string | null;

  @ApiPropertyOptional({ example: '16:10', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(CLOCK, { message: CLOCK_MESSAGE })
  clockOut?: string | null;
}

export class CreatePresensiDto extends UpdatePresensiDto {
  @ApiProperty({ example: '16525' })
  @IsString()
  @MaxLength(20)
  pin!: string;

  @ApiProperty({ example: 'YUNI WIDI ASTUTI' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '2026-10-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date harus YYYY-MM-DD.' })
  date!: string;

  @ApiPropertyOptional({ enum: [1, 2] })
  @IsOptional()
  @IsIn([1, 2])
  shift?: number;
}
