import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { LotSourceDto } from "./lot-source.dto";

export class CreateLotDto {
  @ApiProperty()
  @IsUUID()
  gradeId: string;

  @ApiProperty({ type: [LotSourceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LotSourceDto)
  sources: LotSourceDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  moistureBps?: number;
}
