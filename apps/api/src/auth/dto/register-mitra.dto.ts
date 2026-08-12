import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNumberString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterMitraDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty()
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email: string;

  @ApiProperty({
    description: 'Nomor WhatsApp (gunakan format angka atau +62...)',
    example: '628123456789',
  })
  @IsString()
  @MinLength(8)
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'PIN mesin finger mitra (3-6 digit angka)',
    example: '123456',
  })
  @IsNumberString()
  @MinLength(3)
  @MaxLength(6)
  pinKaryawan: string;
}
