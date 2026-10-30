import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class MitraPasswordLoginDto {
  @ApiProperty({ description: 'Nama lengkap mitra', example: 'SITI AMINAH' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ description: 'Password buatan mitra sendiri' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
