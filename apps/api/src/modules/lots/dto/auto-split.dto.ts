import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class AutoSplitDto {
  @ApiProperty()
  @IsUUID()
  gradedStockId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  presetWeightGram: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  count: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  moistureBps?: number;
}
