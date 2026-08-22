import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
  SMART_CONTACT_BRANDS,
  SMART_CONTACT_CATEGORIES,
  SMART_CONTACT_QR_FORMATS,
  SMART_CONTACT_QR_SOURCES,
  SMART_CONTACT_STATUSES,
} from "../../domain/smart-contact.constants";

const trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  );

export class CreateSmartContactProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @trim()
  firstName!: string;

  @IsOptional() @IsString() @MaxLength(80) @trim() lastName?: string;

  @ApiPropertyOptional({ description: "Defaults to first + last name." })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @trim()
  displayName?: string;

  @ApiPropertyOptional({
    description:
      "Permanent URL segment. Derived from the display name when omitted. " +
      "Printed QR codes encode it, so it cannot be changed casually later.",
  })
  @IsOptional()
  @IsString()
  @MinLength(SLUG_MIN_LENGTH)
  @MaxLength(SLUG_MAX_LENGTH)
  @Matches(SLUG_PATTERN, {
    message:
      "slug may contain only lowercase letters, numbers and single hyphens",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  slug?: string;

  @IsOptional() @IsString() @MaxLength(40) @trim() employeeId?: string;

  @IsOptional() @IsString() @MaxLength(120) @trim() organization?: string;
  @IsOptional() @IsString() @MaxLength(120) @trim() designation?: string;
  @IsOptional() @IsString() @MaxLength(120) @trim() department?: string;
  @IsOptional() @IsString() @MaxLength(160) @trim() roleLine?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-()]{6,20}$/, { message: "primaryPhone is not a valid number" })
  @trim()
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-()]{6,20}$/, { message: "secondaryPhone is not a valid number" })
  @trim()
  secondaryPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-()]{6,20}$/, { message: "whatsappPhone is not a valid number" })
  @trim()
  whatsappPhone?: string;

  @IsOptional() @IsEmail() @MaxLength(160) @trim() email?: string;

  @IsOptional() @IsString() @MaxLength(300) @trim() website?: string;

  @IsOptional() @IsString() @MaxLength(200) @trim() addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(200) @trim() addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(80) @trim() city?: string;
  @IsOptional() @IsString() @MaxLength(80) @trim() district?: string;
  @IsOptional() @IsString() @MaxLength(80) @trim() state?: string;
  @IsOptional() @IsString() @MaxLength(16) @trim() postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) @trim() country?: string;

  @IsOptional() @IsString() @MaxLength(500) @trim() photoUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) @trim() photoAssetId?: string;

  @IsOptional() @IsIn(SMART_CONTACT_BRANDS as unknown as string[]) brandId?: string;
  @IsOptional()
  @IsIn(SMART_CONTACT_CATEGORIES as unknown as string[])
  category?: string;
}

export class UpdateSmartContactProfileDto extends CreateSmartContactProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) @trim() declare firstName: string;

  @ApiPropertyOptional({
    description:
      "Required to confirm a slug change, which invalidates printed QR codes.",
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  allowSlugChange?: boolean;
}

export class SmartContactProfileQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() @MaxLength(120) @trim() search?: string;
  @IsOptional() @IsIn(SMART_CONTACT_STATUSES as unknown as string[]) status?: string;
  @IsOptional()
  @IsIn(SMART_CONTACT_CATEGORIES as unknown as string[])
  category?: string;
  @IsOptional() @IsIn(SMART_CONTACT_BRANDS as unknown as string[]) brandId?: string;
}

export class GenerateQrDto {
  @IsOptional()
  @IsIn(SMART_CONTACT_QR_SOURCES as unknown as string[])
  source?: string;

  @IsOptional()
  @IsArray()
  @IsIn(SMART_CONTACT_QR_FORMATS as unknown as string[], { each: true })
  formats?: string[];

  @IsOptional() @IsString() @MaxLength(120) @trim() label?: string;
}

export class QrRenderQueryDto {
  @ApiPropertyOptional({
    description:
      "`qr` (default) renders the bare symbol for dropping into an existing " +
      "design. `card` renders a print-ready 88×55mm contact card with the " +
      "identity laid out around it (SVG/PDF only).",
    enum: ["qr", "card"],
  })
  @IsOptional()
  @IsIn(["qr", "card"])
  layout?: string;

  @ApiPropertyOptional({
    description: "Include the photograph on a card layout. SVG only.",
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  photo?: boolean;

  @ApiPropertyOptional({ description: "Pixel width for PNG output." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(4000)
  size?: number;

  @IsOptional() @IsString() @MaxLength(60) @trim() caption?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  frame?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => value === true || value === "true")
  logo?: boolean;
}

export class DeleteSmartContactProfilesDto {
  @ApiPropertyOptional({
    description: "Profile ids to permanently remove.",
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids!: string[];
}
