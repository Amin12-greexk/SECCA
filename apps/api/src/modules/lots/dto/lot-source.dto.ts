import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Min } from "class-validator";

export class LotSourceDto {
  @ApiProperty()
  @IsUUID()
  gradedStockId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  wetWeightGram: number;
}
