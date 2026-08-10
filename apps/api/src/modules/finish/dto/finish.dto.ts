import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { FinishResultGradeEntryDto } from "./finish-result-grade-entry.dto";

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
  @IsUUID()
  barangJadiId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  byProductWeightGram?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetLocationId?: string;

  @ApiPropertyOptional({ type: [FinishResultGradeEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinishResultGradeEntryDto)
  resultGrades?: FinishResultGradeEntryDto[];
}
