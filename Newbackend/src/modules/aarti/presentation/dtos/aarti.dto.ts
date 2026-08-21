import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  AARTI_BOOKING_STATUSES,
  AARTI_FACILITIES,
  AARTI_KINDS,
  AARTI_ROLES,
  AARTI_SESSION_STATUSES,
  AARTI_STREAM_PROVIDERS,
} from "../../domain/aarti.constants";

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const csv = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
const bool = ({ value }: { value: unknown }): boolean =>
  value === true || value === "true";

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class AartiSearchDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsIn(AARTI_KINDS) kind?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(AARTI_FACILITIES, { each: true })
  facilities?: string[];
  @IsOptional()
  @IsIn(["recommended", "price_low", "price_high", "rating"])
  sort = "recommended";
}

export class StreamSearchDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @Transform(bool) @IsBoolean() liveOnly?: boolean;
}

export class AartiDateQueryDto {
  @IsOptional() @IsDateString() date?: string;
}

export class AartiCalendarQueryDto {
  @IsDateString() fromDate: string;
  @IsDateString() toDate: string;
}

export class AartiQuoteDto {
  @IsMongoId() sessionId: string;
  @IsMongoId() passTypeId: string;
  @IsDateString() sessionDate: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) passCount: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) donationAmount?: number;
}

export class DevoteeDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsString() @MaxLength(120) gotra?: string;
}

export class CreateAartiBookingDto extends AartiQuoteDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevoteeDto)
  devotees?: DevoteeDto[];
  @IsOptional() @IsString() @MaxLength(120) sankalpName?: string;
  @IsOptional() @IsString() @MaxLength(120) sankalpGotra?: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
}

export class ConfirmAartiPaymentDto {
  @IsOptional() @IsString() razorpay_order_id?: string;
  @IsOptional() @IsString() razorpay_payment_id?: string;
  @IsOptional() @IsString() razorpay_signature?: string;
  @IsOptional()
  @IsIn(["razorpay", "upi", "card", "netbanking", "wallet", "cash", "demo"])
  method?: string;
}

export class CancelAartiDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReviewAartiDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) arrangement?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) cleanliness?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) staff?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  valueForMoney?: number;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class PassFormatDto {
  @IsOptional() @IsIn(["png", "svg"]) format = "png";
}

export class GateScanDto {
  @IsOptional() @IsString() token?: string;
  @IsOptional() @IsString() @MaxLength(20) displayCode?: string;
  @IsOptional() @IsMongoId() sessionId?: string;
  @IsOptional() @IsIn(["entry", "verify"]) action?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) admitCount?: number;
  @IsOptional() @IsString() @MaxLength(200) deviceInfo?: string;
}

export class ManualCheckInDto {
  @IsString() @MaxLength(40) bookingReference: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) admitCount?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class GateRosterDto {
  @IsMongoId() sessionId: string;
  @IsDateString() date: string;
}

export class AartiVenueDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
}

export class CreateAartiSessionDto {
  @IsMongoId() ashramId: string;
  @IsString() @MaxLength(160) name: string;
  @IsIn(AARTI_KINDS) kind: string;
  @IsOptional() @IsString() @MaxLength(120) deity?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) ritualNotes?: string;
  @IsOptional() @IsString() @MaxLength(1000) dressCode?: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(4000) termsAndConditions?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AartiVenueDto)
  venue?: AartiVenueDto;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() googleMapsUrl?: string;
  @Matches(CLOCK, { message: "startTime must be HH:mm, e.g. 18:30" })
  startTime: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(720)
  durationMinutes?: number;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(AARTI_FACILITIES, { each: true })
  facilities?: string[];
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @Transform(bool) @IsBoolean() allowLiveStream?: boolean;
}

export class UpdateAartiSessionDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(AARTI_KINDS) kind?: string;
  @IsOptional() @IsString() @MaxLength(120) deity?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(2000) ritualNotes?: string;
  @IsOptional() @IsString() @MaxLength(1000) dressCode?: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(4000) termsAndConditions?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AartiVenueDto)
  venue?: AartiVenueDto;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() googleMapsUrl?: string;
  @IsOptional() @Matches(CLOCK) startTime?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(720)
  durationMinutes?: number;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(AARTI_FACILITIES, { each: true })
  facilities?: string[];
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @Transform(bool) @IsBoolean() allowLiveStream?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
}

export class CreateAartiPassTypeDto {
  @IsMongoId() sessionId: string;
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(20) code: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @Type(() => Number) @IsInt() @Min(0) basePrice: number;
  @Type(() => Number) @IsInt() @Min(0) totalCapacity: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) maxPerBooking?: number;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(AARTI_FACILITIES, { each: true })
  perks?: string[];
  @IsOptional() @IsString() @MaxLength(60) zoneLabel?: string;
  @IsOptional() @Transform(bool) @IsBoolean() includesPrasad?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() includesSankalp?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
}

export class UpdateAartiPassTypeDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) basePrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalCapacity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) maxPerBooking?: number;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(AARTI_FACILITIES, { each: true })
  perks?: string[];
  @IsOptional() @IsString() @MaxLength(60) zoneLabel?: string;
  @IsOptional() @Transform(bool) @IsBoolean() includesPrasad?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() includesSankalp?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
}

export class UpsertAartiPricingDto {
  @IsOptional() @IsMongoId() _id?: string;
  @IsMongoId() sessionId: string;
  @IsOptional() @IsMongoId() passTypeId?: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) multiplier?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) overridePrice?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;
  @IsOptional() @Type(() => Number) @IsInt() priority?: number;
  @IsOptional() @Transform(bool) @IsBoolean() isActive?: boolean;
}

export class UpsertAartiHolidayDto {
  @IsOptional() @IsMongoId() _id?: string;
  @IsOptional() @IsMongoId() sessionId?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsString() @MaxLength(160) name: string;
  @IsOptional() @IsIn(["festival", "closure", "special"]) type?: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) peakMultiplier?: number;
  @IsOptional() @Transform(bool) @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @Transform(bool) @IsBoolean() isActive?: boolean;
}

export class BlockSeatsDto {
  @IsMongoId() sessionId: string;
  @IsMongoId() passTypeId: string;
  @IsDateString() date: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) blockedCount?: number;
  @IsOptional() @Transform(bool) @IsBoolean() isClosed?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) customPrice?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpsertAartiSettingDto {
  @IsIn(["platform", "ashram", "session"]) scope: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() sessionId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) reservationHoldMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) gateOpensBeforeMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) gateClosesAfterMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) noShowAfterMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) taxPercent?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) maxPassesPerBooking?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) bookingOpensDaysAhead?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bookingClosesBeforeMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) freeCancellationHours?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  refundPercentInsideWindow?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  refundPercentOutsideWindow?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) qrValidityBufferMinutes?: number;
  @IsOptional() @Transform(bool) @IsBoolean() allowOnlineBooking?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() allowCancellation?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() requireDevoteeNames?: boolean;
}

export class CreateAartiStaffDto {
  @IsMongoId() userId: string;
  @IsMongoId() ashramId: string;
  @IsIn(AARTI_ROLES) aartiRole: string;
  @IsOptional() @IsArray() @IsMongoId({ each: true }) sessionIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) capabilityOverrides?: string[];
  @IsOptional() @IsString() @MaxLength(40) employeeCode?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(60) shift?: string;
}

export class CreateAartiStreamDto {
  @IsMongoId() ashramId: string;
  @IsOptional() @IsMongoId() sessionId?: string;
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) deity?: string;
  @IsOptional() @IsIn(AARTI_STREAM_PROVIDERS) provider?: string;
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  streamUrl: string;
  @IsOptional() @IsUrl({ require_protocol: true }) embedUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) thumbnailUrl?: string;
  @IsOptional() @IsString() @MaxLength(160) venueName?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  recurrenceDays?: number[];
}

export class UpdateAartiStreamDto {
  @IsOptional() @IsMongoId() sessionId?: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) deity?: string;
  @IsOptional() @IsIn(AARTI_STREAM_PROVIDERS) provider?: string;
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  streamUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) embedUrl?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) thumbnailUrl?: string;
  @IsOptional() @IsString() @MaxLength(160) venueName?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  recurrenceDays?: number[];
  @IsOptional() @Type(() => Number) @IsInt() displayOrder?: number;
}

export class ApproveAartiDto {
  @IsIn(["approve", "reject"]) decision: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ToggleFlagDto {
  @Transform(bool) @IsBoolean() value: boolean;
}

export class SetSessionStatusDto {
  @IsIn(AARTI_SESSION_STATUSES) status: string;
}

export class AartiListQueryDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() sessionId?: string;
  @IsOptional() @IsDateString() date?: string;
}

export class AartiBookingListQueryDto extends AartiListQueryDto {
  @IsOptional() @IsIn(AARTI_BOOKING_STATUSES) declare status?: string;
}

export class ReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 30;
}

export class SettlementQueryDto {
  @IsOptional()
  @IsIn(["pending", "processing", "settled", "on_hold", "reversed"])
  status?: string;
}
