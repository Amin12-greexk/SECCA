import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class ReceiveRawBatchDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiProperty()
  @IsDateString()
  receivedAt: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  wetWeightGram: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
