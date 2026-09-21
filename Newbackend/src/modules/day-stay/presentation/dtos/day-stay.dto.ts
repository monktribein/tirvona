import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  IsDateString,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";

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

  @IsDateString()
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

  @IsDateString()
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
