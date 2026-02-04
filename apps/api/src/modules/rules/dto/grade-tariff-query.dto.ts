import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class GradeTariffQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shapeGradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  featherGradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  colorGradeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  at?: string;
}
