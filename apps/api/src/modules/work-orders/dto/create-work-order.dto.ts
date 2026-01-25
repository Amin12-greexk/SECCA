import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsString, IsUUID } from "class-validator";

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsUUID()
  workerId: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  lotNumbers: string[];
}
