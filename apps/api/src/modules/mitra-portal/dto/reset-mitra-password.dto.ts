import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResetMitraPasswordDto {
  @ApiProperty({ description: 'Nama lengkap mitra (sesuai file PIN)' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
