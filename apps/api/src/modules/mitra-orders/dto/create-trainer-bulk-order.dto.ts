import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TrainerBulkWorkerOrderDto {
  @ApiProperty({ description: 'Worker tujuan order' })
  @IsUUID()
  workerId: string;

  @ApiProperty({ example: 75, description: 'Berat per LP (gram)' })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  weightGram: number;

  @ApiProperty({ example: 5, description: 'Jumlah LP untuk worker ini' })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  lpCount: number;
}

export class CreateTrainerBulkOrderDto {
  @ApiProperty({ type: [TrainerBulkWorkerOrderDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TrainerBulkWorkerOrderDto)
  assignments: TrainerBulkWorkerOrderDto[];

  @ApiPropertyOptional({ description: 'Catatan tambahan' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  @ApiPropertyOptional({
    default: true,
    description:
      'Jika true, sistem membuat request per mitra selain template agregat',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).toLowerCase();
    return normalized === 'true' || normalized === '1';
  })
  @IsBoolean()
  createIndividualRequests?: boolean = true;
}
