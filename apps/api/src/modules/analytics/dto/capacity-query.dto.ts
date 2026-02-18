import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty } from "class-validator";

export class CapacityQueryDto {
    @ApiProperty({ example: "2026-01-01" })
    @IsDateString()
    @IsNotEmpty()
    from: string;

    @ApiProperty({ example: "2026-02-18" })
    @IsDateString()
    @IsNotEmpty()
    to: string;
}
