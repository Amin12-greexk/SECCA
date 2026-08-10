import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { RackType } from "@prisma/client";

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: RackType })
  @IsEnum(RackType)
  @IsOptional()
  type?: RackType;
}
