import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SetMitraPasswordDto {
  @ApiProperty({ description: 'Password baru (8+ karakter, huruf dan angka)' })
  @IsString()
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({
    description: 'Password saat ini — wajib kalau sudah punya password',
  })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;
}
