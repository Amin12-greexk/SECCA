import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { ArrayUnique, IsArray, IsString, MinLength } from "class-validator";

export class CreateBarangJadiDto {
  @ApiProperty({ example: "INDOMIE" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    type: [String],
    example: ["uuid-1", "uuid-2"],
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? Array.from(
          new Set(
            value.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            ),
          ),
        ).map((item) => item.trim())
      : [],
  )
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  byProductTypeIds: string[];

  @ApiProperty({
    type: [String],
    example: ["uuid-3", "uuid-4"],
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? Array.from(
          new Set(
            value.filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            ),
          ),
        ).map((item) => item.trim())
      : [],
  )
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  resultGradeTypeIds: string[];
}
