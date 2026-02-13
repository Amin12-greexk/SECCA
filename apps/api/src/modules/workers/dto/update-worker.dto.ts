import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";

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
