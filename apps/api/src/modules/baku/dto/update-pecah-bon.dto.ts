import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class UpdatePecahBonDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  gradeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  featherGradeId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  colorGradeId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  featherCondition: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pieceCount: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  initialWeightGram: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  moisturePercent: number;

  @ApiPropertyOptional({
    example: '2026-10-15',
    description:
      'Tanggal pecah bon baru (YYYY-MM-DD, hari kalender WIB). Kosong = tidak diubah. Harus di tahun yang sama dan tidak di masa depan.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pecahBonDate harus YYYY-MM-DD.' })
  pecahBonDate?: string;

  @ApiPropertyOptional({
    description:
      'Kalau tanggal diubah: true = LP lain di kartu induk yang sama dan pada tanggal lama yang sama ikut digeser sejauh selisih hari yang sama.',
  })
  @IsOptional()
  @IsBoolean()
  applyToSiblings?: boolean;
}
