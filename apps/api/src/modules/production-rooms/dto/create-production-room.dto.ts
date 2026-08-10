import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RoomType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductionRoomDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: RoomType })
  @IsEnum(RoomType)
  @IsNotEmpty()
  type: RoomType;
}
