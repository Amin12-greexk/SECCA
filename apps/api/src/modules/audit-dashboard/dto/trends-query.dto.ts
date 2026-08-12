import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsIn, IsUUID } from 'class-validator';

export const TREND_METRICS = [
  'totalBakuBasah',
  'totalBjd',
  'rendemen',
  'sp',
  'sh',
  'hk',
] as const;

export type TrendMetric = (typeof TREND_METRICS)[number];

/** Batas seri: di atas ini chart jadi spaghetti dan warna sulit dibedakan. */
export const MAX_TREND_SERIES = 8;

export class TrendsQueryDto {
  @ApiProperty({
    description: 'Satu atau beberapa id mitra, dipisah koma.',
    example: 'uuid-a,uuid-b',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : (value as string[]),
  )
  @ArrayNotEmpty({ message: 'personIds tidak boleh kosong.' })
  @ArrayMaxSize(MAX_TREND_SERIES, {
    message: `Maksimal ${MAX_TREND_SERIES} mitra untuk sekali banding.`,
  })
  @IsUUID('4', { each: true })
  personIds: string[];

  @ApiPropertyOptional({ enum: TREND_METRICS, default: 'rendemen' })
  @IsIn(TREND_METRICS)
  metric?: TrendMetric = 'rendemen';
}
