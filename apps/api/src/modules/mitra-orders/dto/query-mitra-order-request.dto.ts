import { ApiPropertyOptional } from "@nestjs/swagger";
import { MitraOrderRequestStatus, UserRole } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryMitraOrderRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @ApiPropertyOptional({ enum: MitraOrderRequestStatus })
  @IsOptional()
  @IsEnum(MitraOrderRequestStatus)
  status?: MitraOrderRequestStatus;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  requestedByRole?: UserRole;

  @ApiPropertyOptional({
    default: false,
    description: "Hanya ambil request template agregat (workerId = null)",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase();
    return normalized === "true" || normalized === "1";
  })
  @IsBoolean()
  aggregateOnly?: boolean = false;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
