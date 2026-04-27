import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { WorkLane } from "@prisma/client";

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsUUID()
  workerId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  lotNumbers: string[];

  @ApiPropertyOptional({ enum: WorkLane, description: "Default: NEXT_DAY" })
  @IsOptional()
  @IsEnum(WorkLane)
  lane?: WorkLane;
}
