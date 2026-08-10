import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from "class-validator";
import { UserRole } from "@prisma/client";
import { UiAccessEntryDto } from "./ui-access-entry.dto";

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole })
  @Transform(({ value }) => String(value).toUpperCase())
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productionRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  useCustomUiAccess?: boolean;

  @ApiPropertyOptional({ type: [UiAccessEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UiAccessEntryDto)
  uiAccesses?: UiAccessEntryDto[];
}
