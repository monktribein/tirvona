import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  PLATFORM_FEE_SCOPE_VALUES,
  type PlatformFeeScope,
} from "../domain/platform-fee";

export class PlatformFeeDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(["flat", "percentage"]) type?: "flat" | "percentage";
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PLATFORM_FEE_SCOPE_VALUES, { each: true })
  appliesTo?: PlatformFeeScope[];
}

export class NotificationSoundDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(600)
  @Matches(/^(https:\/\/.+)?$/, {
    message: "notificationSound.url must be an https URL",
  })
  url?: string;
  @IsOptional() @IsString() @MaxLength(200) fileName?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) volume?: number;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformFeeDto)
  platformFee?: PlatformFeeDto;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gstRate?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeeGstRate?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  bookingCommissionPercent?: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSoundDto)
  notificationSound?: NotificationSoundDto;
}
