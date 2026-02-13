import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, MinLength, Min } from "class-validator";

export class CreateWorkerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  capacityGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  trainerId?: string;
}
