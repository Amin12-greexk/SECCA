import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Min } from "class-validator";

export class GradingItemDto {
  @ApiProperty()
  @IsUUID()
  gradeId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  wetWeightGram: number;
}
