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

/**
 * The fee engine's configuration.
 *
 * Previously a bare `@IsObject()`, which meant none of these fields were
 * validated at all: `type` accepted any string and `value` accepted any type,
 * so a malformed save could silently park a value the pricing path could not
 * interpret. `@ValidateNested` gives the inner fields the same guarantees the
 * rest of the payload already had.
 */
export class PlatformFeeDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(["flat", "percentage"]) type?: "flat" | "percentage";
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) value?: number;
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  /**
   * Booking systems the fee is levied on. An empty array is meaningful — it
   * turns the fee off everywhere without discarding the configured amount.
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PLATFORM_FEE_SCOPE_VALUES, { each: true })
  appliesTo?: PlatformFeeScope[];
}

export class NotificationSoundDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  /**
   * An https URL only. The value is handed straight to `new Audio(...)` in
   * every dashboard, so allowing `javascript:` or `data:` here would turn a
   * settings field into a delivery channel for arbitrary content.
   */
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
  /** GST on the platform fee. The stay itself is never taxed. */
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
