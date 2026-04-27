import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class FindLocationLotsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  @ApiPropertyOptional({ description: "Search by lotNumber/externalId" })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Primary shape grade id (UUID)" })
  @IsOptional()
  @IsUUID()
  gradeId?: string;

  @ApiPropertyOptional({ enum: ["all", "printed", "unprinted"], default: "all" })
  @IsOptional()
  @IsIn(["all", "printed", "unprinted"])
  printed?: "all" | "printed" | "unprinted" = "all";
}
