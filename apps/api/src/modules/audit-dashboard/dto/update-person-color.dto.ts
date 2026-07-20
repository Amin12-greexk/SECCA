import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, Matches, ValidateIf } from "class-validator";

export class UpdatePersonColorDto {
  @ApiPropertyOptional({
    description: "Hex color 6 digit, mis. #059833. Kirim null untuk reset ke warna default.",
    example: "#059833",
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "colorHex harus format hex 6 digit, contoh #059833.",
  })
  colorHex?: string | null;
}
