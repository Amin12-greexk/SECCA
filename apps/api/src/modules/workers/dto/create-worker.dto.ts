import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWorkerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'PIN karyawan/mitra untuk pendaftaran mandiri',
  })
  @IsOptional()
  @IsNumberString()
  @MinLength(3)
  @MaxLength(6)
  pin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  trainerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productionRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isMiniplant?: boolean;
}
