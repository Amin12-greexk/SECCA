import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CapacityQueryDto {
    @ApiProperty({ example: "2026-01-01" })
    @IsDateString()
    @IsNotEmpty()
    from: string;

    @ApiProperty({ example: "2026-02-18" })
    @IsDateString()
    @IsNotEmpty()
    to: string;

    @ApiProperty({ required: false, description: "ALL, FACTORY_ONLY, MINIPLANT_ONLY, or specific productionRoomId" })
    @IsString()
    @IsOptional()
    scope?: string;
}
