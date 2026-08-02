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
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  bookingCommissionPercent?: number;
}
