import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class CreateGradeTariffDto {
  @ApiProperty()
  @IsUUID()
  gradeId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  rateRpPerGram: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
