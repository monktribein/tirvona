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
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  EVENT_FACILITIES,
  EVENT_REGISTRATION_STATUSES,
  EVENT_ROLES,
  EVENT_STATUSES,
  EVENT_TYPES,
} from "../../domain/event.constants";

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const csv = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
const bool = ({ value }: { value: unknown }): boolean =>
  value === true || value === "true";

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class EventSearchDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsIn(EVENT_TYPES) eventType?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @Transform(bool) @IsBoolean() includePast?: boolean;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(EVENT_FACILITIES, { each: true })
  facilities?: string[];
  @IsOptional() @IsIn(["upcoming", "recommended", "newest"]) sort = "upcoming";
}

export class EventAttendeeDto {
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) age?: number;
}

export class CreateRegistrationDto {
  @IsMongoId() eventId: string;
  @IsDateString() attendDate: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) seats: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventAttendeeDto)
  attendees?: EventAttendeeDto[];
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
}

export class CancelRegistrationDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class PassFormatDto {
  @IsOptional() @IsIn(["png", "svg"]) format = "png";
}

export class EventScanDto {
  @IsOptional() @IsString() token?: string;
  @IsOptional() @IsString() @MaxLength(20) displayCode?: string;
  @IsOptional() @IsMongoId() eventId?: string;
  @IsOptional() @IsIn(["entry", "verify"]) action?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) admitCount?: number;
  @IsOptional() @IsString() @MaxLength(200) deviceInfo?: string;
}

export class EventManualCheckInDto {
  @IsString() @MaxLength(40) registrationReference: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) admitCount?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class EventGateRosterDto {
  @IsMongoId() eventId: string;
  @IsDateString() date: string;
}

export class EventVenueDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() line1?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
}

export class EventScheduleItemDto {
  @IsString() @MaxLength(120) label: string;
  @IsOptional() @Matches(CLOCK) startTime?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class EventBodyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(EVENT_TYPES) eventType?: string;
  @IsOptional() @IsString() @MaxLength(120) deity?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsString() @MaxLength(1000) dressCode?: string;
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string;
  @IsOptional() @IsString() @MaxLength(4000) termsAndConditions?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EventVenueDto)
  venue?: EventVenueDto;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() googleMapsUrl?: string;
  @IsOptional() @Matches(CLOCK) startTime?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1440)
  durationMinutes?: number;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventScheduleItemDto)
  dailySchedule?: EventScheduleItemDto[];
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(EVENT_FACILITIES, { each: true })
  facilities?: string[];
  @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @Transform(bool) @IsBoolean() requiresRegistration?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) dailyCapacity?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxSeatsPerRegistration?: number;
}

export class CreateEventDto extends EventBodyDto {
  @IsMongoId() ashramId: string;
  @IsString() @MaxLength(160) declare name: string;
  @IsIn(EVENT_TYPES) declare eventType: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
}

export class UpdateEventDto extends EventBodyDto {
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}

export class BlockEventDayDto {
  @IsMongoId() eventId: string;
  @IsDateString() date: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalCapacity?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) blockedCount?: number;
  @IsOptional() @Transform(bool) @IsBoolean() isClosed?: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpsertEventSettingDto {
  @IsIn(["platform", "ashram", "event"]) scope: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() eventId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) gateOpensBeforeMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) noShowAfterMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxSeatsPerRegistration?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registrationOpensDaysAhead?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  registrationClosesBeforeMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) qrValidityBufferMinutes?: number;
  @IsOptional() @Transform(bool) @IsBoolean() allowRegistration?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() allowCancellation?: boolean;
  @IsOptional() @Transform(bool) @IsBoolean() requireAttendeeNames?: boolean;
}

export class CreateEventStaffDto {
  @IsMongoId() userId: string;
  @IsMongoId() ashramId: string;
  @IsIn(EVENT_ROLES) eventRole: string;
  @IsOptional() @IsArray() @IsMongoId({ each: true }) eventIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) capabilityOverrides?: string[];
  @IsOptional() @IsString() @MaxLength(40) employeeCode?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(60) shift?: string;
}

export class ApproveEventDto {
  @IsIn(["approve", "reject"]) decision: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ToggleFlagDto {
  @Transform(bool) @IsBoolean() value: boolean;
}

export class SetEventStatusDto {
  @IsIn(EVENT_STATUSES) status: string;
}

export class EventListQueryDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() eventId?: string;
  @IsOptional() @IsDateString() date?: string;
}

export class EventRegistrationListQueryDto extends EventListQueryDto {
  @IsOptional() @IsIn(EVENT_REGISTRATION_STATUSES) declare status?: string;
}

export class ReportQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) days = 30;
}
