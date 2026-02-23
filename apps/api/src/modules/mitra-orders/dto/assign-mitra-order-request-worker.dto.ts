import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AssignMitraOrderRequestWorkerDto {
  @ApiProperty()
  @IsUUID()
  workerId: string;
}
