import { ApiPropertyOptional } from "@nestjs/swagger";
import { MitraOrderRequestStatus, UserRole } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

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
