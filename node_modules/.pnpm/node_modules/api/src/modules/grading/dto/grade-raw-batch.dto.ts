import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { GradingItemDto } from "./grading-item.dto";

export class GradeRawBatchDto {
  @ApiProperty({ type: [GradingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GradingItemDto)
  items: GradingItemDto[];
}
