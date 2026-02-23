import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateWorkerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string | null;

  @ApiPropertyOptional({
    description: "PIN karyawan/mitra untuk pendaftaran mandiri",
  })
  @IsOptional()
  @IsNumberString()
  @MinLength(3)
  @MaxLength(6)
  pin?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityGram?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  trainerId?: string | null;
}
