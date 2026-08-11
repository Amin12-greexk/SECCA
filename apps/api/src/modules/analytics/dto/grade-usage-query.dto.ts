import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsDateString,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
} from "class-validator";

export class GradeUsageQueryDto {
    @ApiProperty({ example: "2026-01-01" })
    @IsDateString()
    @IsNotEmpty()
    from: string;

    @ApiProperty({ example: "2026-02-18" })
    @IsDateString()
    @IsNotEmpty()
    to: string;

    @ApiPropertyOptional({ enum: ["combo", "shape", "feather", "color"], default: "combo" })
    @IsOptional()
    @IsIn(["combo", "shape", "feather", "color"])
    groupBy?: string;

    @ApiPropertyOptional({ enum: ["initial", "dry"], default: "initial" })
    @IsOptional()
    @IsIn(["initial", "dry"])
    metric?: string;

    @ApiPropertyOptional({ description: "Limit rows returned", example: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    top?: number;

    @ApiPropertyOptional({ description: "ALL, FACTORY_ONLY, MINIPLANT_ONLY, or specific productionRoomId" })
    @IsString()
    @IsOptional()
    scope?: string;
}
