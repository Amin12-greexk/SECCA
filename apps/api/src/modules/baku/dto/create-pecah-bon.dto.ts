import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsString,
    IsUUID,
    Min,
} from "class-validator";

export class CreatePecahBonDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    gradeId: string;

    @ApiProperty()
    @IsDateString()
    @IsNotEmpty()
    pecahBonDate: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    featherCondition: string;

    @ApiProperty()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pieceCount: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0.1)
    initialWeightGram: number;

    @ApiProperty()
    @Type(() => Number)
    @IsNumber({ maxDecimalPlaces: 2 })
    @Min(0)
    moisturePercent: number;
}
