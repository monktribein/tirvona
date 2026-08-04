import { IsNumber, IsObject, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
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
}
