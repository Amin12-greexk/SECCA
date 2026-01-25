import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class FinishDto {
  @ApiProperty()
  @IsUUID()
  workOrderItemId: string;

  @ApiProperty()
  @IsDateString()
  returnedAt: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  mainOutWeightGram: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  byProductWeightGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
