import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class MitraLoginDto {
  @ApiProperty({
    description: 'PIN dari perusahaan (3–6 digit)',
    example: '1234',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  pin!: string;
}
