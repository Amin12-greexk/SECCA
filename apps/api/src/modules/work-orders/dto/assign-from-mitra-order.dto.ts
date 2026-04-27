import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";

export class AssignFromMitraOrderDto {
  @ApiProperty()
  @IsUUID()
  workerId: string;

  @ApiProperty({ type: [String], description: "Daftar lotId dari Rak Mitra Order" })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID("all", { each: true })
  lotIds: string[];
}

