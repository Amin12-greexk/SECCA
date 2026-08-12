import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MoveLotDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  toLocationCode: string;
}
