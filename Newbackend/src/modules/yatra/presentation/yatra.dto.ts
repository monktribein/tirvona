import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsObject,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { IsEntityId } from "../../../common/decorators/is-entity-id.decorator";
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  RATING_TAGS,
  DEPARTURE_STATUSES,
  DIETARY_PREFERENCES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  JOURNEY_LINK_MODULES,
  MEAL_TYPES,
  SERVICE_ADD_ON_KEYS,
  OPERATOR_STATUSES,
  ORGANISATION_TYPES,
  PASSENGER_GENDERS,
  PERMIT_TYPES,
  PRODUCT_TYPES,
  SEAT_KINDS,
  SEAT_LAYOUT_PATTERN,
  SEAT_MODES,
  SERVICE_REQUEST_STATUSES,
  SERVICE_TYPES,
  TOUR_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from "../domain/yatra.constants";

const PHONE = /^\+?[0-9][0-9 -]{7,15}$/;
const IMAGE_URL = { protocols: ["https"], require_protocol: true };

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class ReasonDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class OptionalNoteDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// ------------------------------------------------------------------ organiser
export class RegisterOperatorDto {
  @IsString() @Length(3, 120) organisationName!: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsIn(ORGANISATION_TYPES) organisationType?: string;
  @IsOptional() @IsString() @MaxLength(80) contactName?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone must be a phone number" }) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
}

/** Super Admin creates the partner's Tirvona login and its organisation together. */
export class CreateOrganiserAccountDto {
  @IsString() @Length(2, 80) name!: string;
  @IsEmail() email!: string;
  @Matches(PHONE, { message: "phone must be a phone number" }) phone!: string;
  @IsString() @Length(3, 120) organisationName!: string;
  @IsOptional() @IsIn(ORGANISATION_TYPES) organisationType?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  /** Leave empty to generate a strong one-time password. */
  @IsOptional() @IsString() @Length(8, 72) password?: string;
}

export class RatingDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) stars!: number;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ArrayUnique() @IsIn(RATING_TAGS as unknown as string[], { each: true }) tags?: string[];
}

export class UpdateOperatorDto {
  @IsOptional() @IsString() @Length(3, 120) organisationName?: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsIn(ORGANISATION_TYPES) organisationType?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUrl(IMAGE_URL) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(80) contactName?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone must be a phone number" }) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @Matches(/^[0-9]{6}$/, { message: "pincode must be 6 digits" }) pincode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) operatingRegions?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(200) yearsInBusiness?: number;
  @IsOptional() @Matches(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, { message: "panNumber must be a valid PAN" }) panNumber?: string;
  @IsOptional() @Matches(/^$|^[0-9]{2}[A-Za-z0-9]{13}$/, { message: "gstin must be a valid GSTIN" }) gstin?: string;
  @IsOptional() @IsString() @MaxLength(60) registrationNumber?: string;
}

export class PayoutDetailsDto {
  @IsString() @Length(2, 100) accountHolderName!: string;
  @IsOptional() @Matches(/^[0-9]{6,20}$/, { message: "accountNumber must be 6 to 20 digits" }) accountNumber?: string;
  @IsOptional() @Matches(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, { message: "ifsc must be a valid IFSC" }) ifsc?: string;
  @IsOptional() @IsString() @MaxLength(80) bankName?: string;
  @IsOptional() @Matches(/^$|^[\w.-]{2,}@[A-Za-z]{2,}$/, { message: "upiId must be a valid UPI id" }) upiId?: string;
}

export class SubmitOperatorDto {
  @IsBoolean() acceptTerms!: boolean;
}

export class AddStaffDto {
  @IsString() @Length(5, 120) emailOrPhone!: string;
  @IsIn(["manager", "staff"]) role!: string;
}

export class UpdateStaffDto {
  @IsIn(["manager", "staff"]) role!: string;
}

export class UploadDocumentDto {
  @IsIn(DOCUMENT_TYPES) documentType!: string;
  @IsOptional() @IsString() @MaxLength(60) documentNumber?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsEntityId() vehicleId?: string;
}

// ------------------------------------------------------------------- vehicles
export class SeatSpecDto {
  @IsString() @Matches(/^[A-Za-z0-9-]{1,6}$/) seatNo!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(60) row!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(8) col!: number;
  @IsOptional() @IsIn(["lower", "upper"]) deck?: string;
  @IsOptional() @IsIn(SEAT_KINDS) kind?: string;
}

export class VehicleDto {
  @IsString() @Length(6, 20) registrationNumber!: string;
  @IsOptional() @IsIn(VEHICLE_TYPES) vehicleType?: string;
  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(120) seatCapacity!: number;
  @IsOptional() @IsBoolean() isAc?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) amenities?: string[];
  @IsOptional() @IsIn(PERMIT_TYPES) permitType?: string;
  @IsOptional() @Matches(SEAT_LAYOUT_PATTERN, { message: "layoutTemplate must be like 2x2, 2x3, 1x2 or sleeper_2x1" }) layoutTemplate?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(120) @ValidateNested({ each: true }) @Type(() => SeatSpecDto) customSeats?: SeatSpecDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUrl(IMAGE_URL, { each: true }) images?: string[];
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() @Length(6, 20) registrationNumber?: string;
  @IsOptional() @IsIn(VEHICLE_TYPES) vehicleType?: string;
  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120) seatCapacity?: number;
  @IsOptional() @IsBoolean() isAc?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) amenities?: string[];
  @IsOptional() @IsIn(PERMIT_TYPES) permitType?: string;
  @IsOptional() @Matches(SEAT_LAYOUT_PATTERN, { message: "layoutTemplate must be like 2x2, 2x3, 1x2 or sleeper_2x1" }) layoutTemplate?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(120) @ValidateNested({ each: true }) @Type(() => SeatSpecDto) customSeats?: SeatSpecDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUrl(IMAGE_URL, { each: true }) images?: string[];
}

// ---------------------------------------------------------------------- tours
export class TourStopDto {
  @IsString() @Length(1, 120) name!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(30) dayNumber!: number;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(30) stopType?: string;
  @IsOptional() @IsString() @MaxLength(10) arrivalTime?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/** A halt during a day: where the bus stops, when, and what for (tea, meal, darshan...). */
export class DayBreakDto {
  @IsString() @Length(2, 120) place!: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be HH:mm" }) time?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(600) minutes?: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class ServiceAddOnDto {
  @IsIn(SERVICE_ADD_ON_KEYS) key!: string;
  @Type(() => Number) @IsNumber() @Min(1) @Max(100000) price!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class ItineraryDayDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(30) dayNumber!: number;
  @IsString() @Length(1, 120) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(MEAL_TYPES, { each: true }) meals?: string[];
  @IsOptional() @IsString() @MaxLength(120) overnightAt?: string;
  /** The calendar day (YYYY-MM-DD) and the time the day starts (HH:mm), 24-hour. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }) date?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be HH:mm" }) time?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => DayBreakDto) breaks?: DayBreakDto[];
}

export class PolicyWindowDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(2160) hoursBefore!: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(100) refundPercent!: number;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
}

export class CancellationPolicyDto {
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => PolicyWindowDto) windows!: PolicyWindowDto[];
  @Type(() => Number) @IsInt() @Min(0) @Max(100) defaultRefundPercent!: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class OtherPoliciesDto {
  @IsOptional() @IsString() @MaxLength(500) childPolicy?: string;
  @IsOptional() @IsString() @MaxLength(500) luggagePolicy?: string;
  @IsOptional() @IsString() @MaxLength(500) petsPolicy?: string;
  @IsOptional() @IsString() @MaxLength(500) alcoholPolicy?: string;
  @IsOptional() @IsString() @MaxLength(500) pickupPolicy?: string;
}

class TourFields {
  @IsOptional() @IsString() @MaxLength(300) summary?: string;
  @IsOptional() @IsString() @MaxLength(6000) description?: string;
  @IsOptional() @IsIn(PRODUCT_TYPES) productType?: string;
  @IsOptional() @IsString() @MaxLength(80) originState?: string;
  @IsOptional() @IsString() @MaxLength(80) destinationState?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30) durationNights?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => TourStopDto) stops?: TourStopDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ItineraryDayDto) itinerary?: ItineraryDayDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(200, { each: true }) highlights?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) inclusions?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(200, { each: true }) exclusions?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsUrl(IMAGE_URL, { each: true }) images?: string[];
  @IsOptional() @IsUrl(IMAGE_URL) coverImage?: string;
  @IsOptional() @ValidateNested() @Type(() => CancellationPolicyDto) cancellationPolicy?: CancellationPolicyDto;
  @IsOptional() @IsEntityId() circuitTemplateId?: string;
  @IsOptional() @ValidateNested() @Type(() => OtherPoliciesDto) otherPolicies?: OtherPoliciesDto;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => ServiceAddOnDto) serviceAddOns?: ServiceAddOnDto[];
}

export class CreateTourDto extends TourFields {
  @IsString() @Length(3, 140) title!: string;
  @IsString() @Length(2, 80) originCity!: string;
  @IsString() @Length(2, 80) destinationCity!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(30) durationDays!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500000) baseFare!: number;
}

export class UpdateTourDto extends TourFields {
  @IsOptional() @IsString() @Length(3, 140) title?: string;
  @IsOptional() @IsString() @Length(2, 80) originCity?: string;
  @IsOptional() @IsString() @Length(2, 80) destinationCity?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) durationDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500000) baseFare?: number;
}

// ----------------------------------------------------------------- departures
export class BoardingPointDto {
  @IsOptional() @IsString() @MaxLength(40) id?: string;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(120) landmark?: string;
  @IsOptional() @IsDateString() time?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) mapUrl?: string;
}

export class RestStopDto {
  @IsOptional() @IsString() @MaxLength(40) id?: string;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsDateString() time?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(240) durationMinutes?: number;
}

export class CreateDepartureDto {
  @IsEntityId() tourId!: string;
  @IsEntityId() vehicleId!: string;
  @IsDateString() departAt!: string;
  @IsOptional() @IsDateString() returnAt?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500000) fare?: number;
  @IsOptional() @IsIn(SEAT_MODES) seatMode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(120) @IsString({ each: true }) blockedSeats?: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BoardingPointDto) boardingPoints!: BoardingPointDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BoardingPointDto) droppingPoints?: BoardingPointDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => RestStopDto) restStops?: RestStopDto[];
  @IsOptional() @IsBoolean() charterEnabled?: boolean;
  @IsOptional() @IsObject() seatFares?: Record<string, number>;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateDepartureDto {
  @IsOptional() @IsDateString() departAt?: string;
  @IsOptional() @IsDateString() returnAt?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500000) fare?: number;
  @IsOptional() @IsIn(SEAT_MODES) seatMode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(120) @IsString({ each: true }) blockedSeats?: string[];
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BoardingPointDto) boardingPoints?: BoardingPointDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BoardingPointDto) droppingPoints?: BoardingPointDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => RestStopDto) restStops?: RestStopDto[];
  @IsOptional() @IsBoolean() charterEnabled?: boolean;
  @IsOptional() @IsObject() seatFares?: Record<string, number>;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class DepartureQueryDto {
  @IsOptional() @IsEntityId() tourId?: string;
  @IsOptional() @IsIn(DEPARTURE_STATUSES) status?: string;
  @IsOptional() @IsIn(["true", "false"]) upcoming?: string;
}

// ------------------------------------------------------------------- bookings
export class PassengerDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsIn(PASSENGER_GENDERS) gender?: string;
  @IsOptional() @Matches(PHONE, { message: "phone must be a phone number" }) phone?: string;
}

export class ContactDto {
  @IsString() @Length(2, 80) name!: string;
  @Matches(PHONE, { message: "phone must be a phone number" }) phone!: string;
  @IsOptional() @IsEmail() email?: string;
}

export class CreateBookingDto {
  @IsOptional() @IsString() @Matches(/^YD[0-9A-Z]{7}$/i) departureCode?: string;
  @IsOptional() @IsEntityId() departureId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) @Matches(/^[A-Za-z0-9-]{1,6}$/, { each: true }) seats?: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => PassengerDto) passengers!: PassengerDto[];
  @ValidateNested() @Type(() => ContactDto) contact!: ContactDto;
  @IsOptional() @IsString() @MaxLength(40) boardingPointId?: string;
  @IsOptional() @IsString() @MaxLength(40) droppingPointId?: string;
  /** Adds the cancellation-protection fee for a full-fare refund on an early cancellation. */
  @IsOptional() @IsBoolean() cancellationProtection?: boolean;
  /** Optional services of the tour (stay, food, taxi) the pilgrim wants, by key. */
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(SERVICE_ADD_ON_KEYS, { each: true }) addOns?: string[];
  @IsOptional() @IsString() @Matches(/^[0-9a-z]{6,12}$/i) linkCode?: string;
}

// ------------------------------------------------- live location and full-bus requests
export class ShareLocationDto {
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100000) accuracyM?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(400) speedKmph?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(360) heading?: number;
}

export class CreateCharterRequestDto {
  @IsString() @Matches(/^YD[0-9A-Z]{7}$/i) departureCode!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(120) groupSize!: number;
  @ValidateNested() @Type(() => ContactDto) contact!: ContactDto;
  @IsOptional() @IsString() @MaxLength(1000) message?: string;
}

export class RespondCharterDto {
  @IsIn(["accept", "decline"]) action!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ConfirmPaymentDto {
  @IsString() @MaxLength(80) razorpay_order_id!: string;
  @IsString() @MaxLength(80) razorpay_payment_id!: string;
  @IsOptional() @IsString() @MaxLength(256) razorpay_signature?: string;
}

export class BookingQueryDto extends PaginationDto {
  @IsOptional() @IsIn(BOOKING_STATUSES) status?: string;
  @IsOptional() @IsIn(BOOKING_SOURCES) source?: string;
  @IsOptional() @IsEntityId() departureId?: string;
  @IsOptional() @IsEntityId() operatorId?: string;
  @IsOptional() @IsString() @MaxLength(40) q?: string;
}

export class CheckInDto {
  @IsOptional() @IsString() @MaxLength(300) qr?: string;
  @IsOptional() @IsString() @MaxLength(40) bookingReference?: string;
  @IsOptional() @IsString() @MaxLength(20) ticketCode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsString({ each: true }) seatNos?: string[];
}

export class CancellationDecisionDto {
  @IsIn(["approve", "reject"]) decision!: "approve" | "reject";
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) refundPercent?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AdminCancelBookingDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) refundPercent!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

// ---------------------------------------------------------------------- links
export class CreateLinkDto {
  @IsEntityId() tourId!: string;
  @IsOptional() @IsEntityId() departureId?: string;
  @IsOptional() @IsString() @MaxLength(80) campaign?: string;
}

export class LinkActiveDto {
  @IsBoolean() active!: boolean;
}

// -------------------------------------------------------------------- journey
export class JourneyLinkDto {
  @IsIn(JOURNEY_LINK_MODULES) module!: "stay" | "parking" | "aarti";
  @IsEntityId() refId!: string;
}

export class ServiceRequestDto {
  @IsIn(SERVICE_TYPES) serviceType!: "food" | "puja";
  @IsDateString() serviceDate!: string;
  @IsString() @Length(2, 300) location!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  // food
  @IsOptional() @IsIn(MEAL_TYPES) mealType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) quantity?: number;
  @IsOptional() @IsIn(DIETARY_PREFERENCES) dietaryPreference?: string;
  @IsOptional() @IsEntityId() foodVendorId?: string;
  // puja
  @IsOptional() @IsString() @MaxLength(120) ritualName?: string;
  @IsOptional() @IsString() @MaxLength(40) preferredTime?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) attendees?: number;
  @IsOptional() @IsEntityId() providerId?: string;
}

export class SupplierResponseDto {
  @IsIn(["accept", "reject"]) decision!: "accept" | "reject";
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500000) quotedAmount?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AssignSupplierDto {
  @IsOptional() @IsEntityId() foodVendorId?: string;
  @IsOptional() @IsEntityId() providerId?: string;
}

export class ServiceRequestQueryDto extends PaginationDto {
  @IsOptional() @IsIn(SERVICE_REQUEST_STATUSES) status?: string;
  @IsOptional() @IsIn(SERVICE_TYPES) serviceType?: string;
}

// ---------------------------------------------------------------------- admin
export class OperatorReviewDto {
  @IsIn(["start_review", "approve", "reject", "suspend", "reinstate"]) action!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class SimpleReviewDto {
  @IsIn(["approve", "reject"]) decision!: "approve" | "reject";
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class VehicleReviewDto {
  @IsIn(["approve", "reject", "suspend"]) action!: "approve" | "reject" | "suspend";
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class TourReviewDto {
  @IsIn(["approve", "reject", "publish", "unpublish"]) action!: "approve" | "reject" | "publish" | "unpublish";
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class BlockSeatsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(120) @IsString({ each: true }) seatNos!: string[];
  @IsBoolean() blocked!: boolean;
}

export class AdminListDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsEntityId() operatorId?: string;
}

export class OperatorStatusQueryDto extends PaginationDto {
  @IsOptional() @IsIn(OPERATOR_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

export class DocumentStatusQueryDto extends PaginationDto {
  @IsOptional() @IsIn(DOCUMENT_STATUSES) status?: string;
}

export class VehicleStatusQueryDto extends PaginationDto {
  @IsOptional() @IsIn(VEHICLE_STATUSES) status?: string;
}

export class TourStatusQueryDto extends PaginationDto {
  @IsOptional() @IsIn(TOUR_STATUSES) status?: string;
  @IsOptional() @IsEntityId() operatorId?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
}

export class AdminDepartureQueryDto extends PaginationDto {
  @IsOptional() @IsIn(DEPARTURE_STATUSES) status?: string;
  @IsOptional() @IsEntityId() operatorId?: string;
}

export class DateRangeDto extends PaginationDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

export class LedgerQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(40) type?: string;
  @IsOptional() @IsEntityId() operatorId?: string;
}

export class AuditQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(80) action?: string;
}

export class SettingsDto {
  @IsOptional() @Type(() => Number) @IsInt() holdMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() paymentLinkMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() maxSeatsPerBooking?: number;
  @IsOptional() @Type(() => Number) @IsInt() salesCloseMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() rideFullRefundHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() ridePartnerResponseHours?: number;
  @IsOptional() @Type(() => Number) @IsInt() reminderHours?: number;
  @IsOptional() @IsString() @MaxLength(20) supportPhone?: string;
}

export class SearchDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(80) origin?: string;
  @IsOptional() @IsString() @MaxLength(80) destination?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(40) seats?: number;
}
