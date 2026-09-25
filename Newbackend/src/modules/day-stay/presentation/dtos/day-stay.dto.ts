import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Matches,
  IsObject,
  IsInt,
  Max,
  IsArray,
} from "class-validator";

// Plain calendar date only (no time-of-day / timezone component). The
// services build UTC instants by string-concatenating this with a
// separately-validated "HH:mm" time (e.g. `${date}T${startTime}:00.000Z`),
// so a full ISO datetime string here (which @IsDateString() would accept)
// produces a malformed double-"T" string and an Invalid Date.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IsDateOnly = () =>
  Matches(DATE_ONLY_PATTERN, { message: "date must be in YYYY-MM-DD format" });

export class CreateDayStayProductDto {
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsEnum(["freshen_up", "day_rest"])
  productType: "freshen_up" | "day_rest";

  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsNumber()
  @IsPositive()
  durationMinutes: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class DayStayAvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  ashramId: string;

  @IsDateOnly()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  productCode?: string;
}

export class DayStayHoldDto {
  @IsString()
  @IsNotEmpty()
  ashramId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  productCode: string;

  @IsDateOnly()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "startTime must be in HH:mm 24-hour format",
  })
  @IsNotEmpty()
  startTime: string; // e.g. "09:30"

  @IsNumber()
  @Min(1)
  guestsCount: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;
}

export class DayStayConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @IsString()
  @IsNotEmpty()
  razorpayPaymentId: string;

  @IsString()
  @IsOptional()
  razorpaySignature?: string;
}

export class DayStayVendorBlockDto {
  @IsString()
  @IsNotEmpty()
  ashramId: string;

  @IsEnum(["today", "tomorrow", "custom_dates", "unblock_today", "unblock_tomorrow"])
  action: "today" | "tomorrow" | "custom_dates" | "unblock_today" | "unblock_tomorrow";

  @IsOptional()
  dates?: string[];
}

export class DayStayConfigUpdateDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  // { start: "HH:mm", end: "HH:mm" } — validated in DayStayVendorService.
  @IsOptional()
  @IsObject()
  operatingHours?: { start: string; end: string };

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  defaultGraceMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  defaultHousekeepingBufferMinutes?: number;

  // Per-room settings: { roomId, enabled?, allocatedInventory?, products? } —
  // validated in DayStayVendorService.
  @IsOptional()
  @IsArray()
  rooms?: Array<{
    roomId: string;
    enabled?: boolean;
    allocatedInventory?: number;
    products?: Array<{
      productCode: string;
      productType: "freshen_up" | "day_rest";
      durationMinutes: number;
      price: number;
      discountPrice?: number;
      enabled?: boolean;
    }>;
  }>;
}
