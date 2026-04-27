import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsString, Max, Min, MinLength } from "class-validator";

export class UiAccessEntryDto {
  @ApiProperty({ example: "stock" })
  @IsString()
  @MinLength(1)
  moduleKey: string;

  @ApiProperty({ example: 2, minimum: 0, maximum: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  level: number;
}
