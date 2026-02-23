import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateMitraOrderRequestLineDto {
  @ApiProperty({ example: 75 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  weightGram: number;

  @ApiProperty({ example: 5 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  lpCount: number;
}

export class CreateMitraOrderRequestDto {
  @ApiPropertyOptional({
    description: "Target worker untuk order (wajib untuk role selain trainer)",
  })
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @ApiPropertyOptional({
    description: "Target gram order mitra (berat basah operasional)",
    example: 75,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  requestedGram?: number;

  @ApiPropertyOptional({
    type: [CreateMitraOrderRequestLineDto],
    description: "Template order per LP, misal 75 gr x 5 LP",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMitraOrderRequestLineDto)
  lines?: CreateMitraOrderRequestLineDto[];

  @ApiProperty({
    required: false,
    description: "Catatan tambahan dari mitra/pengawas",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
