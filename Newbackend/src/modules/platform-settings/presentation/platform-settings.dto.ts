import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

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
  @IsOptional() @IsObject() platformFee?: {
    enabled?: boolean;
    type?: "flat" | "percentage";
    value?: number;
    label?: string;
  };
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
