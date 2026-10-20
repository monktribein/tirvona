import { DELIVERY_MODES, PANDIT_SERVICE_TYPES, KATHA_TYPES, PANDIT_SHIFTS, MAX_MULTI_PANDIT_REQUESTS } from "../../domain/provider.constants";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsUrl,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { IsEntityId } from "../../../../common/decorators/is-entity-id.decorator";
import {
  BOOKING_STATUSES,
  CONSULTATION_CHANNELS,
  CONSULTATION_STATUSES,
  CONSULTATION_TYPES,
} from "../../domain/provider.constants";
import { PageQueryDto } from "./common.dto";

const trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));
const PHONE = /^\+?[0-9][0-9\s-]{6,17}$/;
/** ISO 8601 with an explicit offset or Z, so a booking instant is never ambiguous. */
const WITH_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

export class ServiceLocationDto {
  @IsOptional() @trim() @IsString() @MaxLength(300) line1?: string;
  @trim() @IsString() @MinLength(2) @MaxLength(80) city: string;
  @trim() @IsString() @MinLength(2) @MaxLength(80) state: string;
  @IsOptional() @Matches(/^[0-9A-Za-z -]{3,10}$/) pincode?: string;
}

export class KathaDetailsDto {
  @IsIn(KATHA_TYPES) kathaType: string;
  @IsOptional() @trim() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsInt() @Min(1) @Max(30) numberOfDays?: number;
  @IsOptional() @trim() @IsString() @MaxLength(500) dailyScheduleDescription?: string;
  @IsOptional() @IsBoolean() samagriIncluded?: boolean;
  @IsOptional() @trim() @IsString() @MaxLength(1000) samagriDetails?: string;
}

export class CreateProviderBookingDto {
  @IsEntityId() offeringId: string;
  @IsISO8601({ strict: true }) @Matches(WITH_OFFSET, { message: "scheduledStartAt must include a timezone offset (e.g. +05:30 or Z)" }) scheduledStartAt: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) customerName: string;
  @Matches(PHONE, { message: "customerPhone is not a valid phone number" }) customerPhone: string;
  @IsOptional() @trim() @IsString() @MaxLength(160) customerEmail?: string;
  /** Required when the service is performed at the customer's address. */
  @IsOptional() @ValidateNested() @Type(() => ServiceLocationDto) serviceLocation?: ServiceLocationDto;
  @IsOptional() @trim() @IsString() @MaxLength(500) notes?: string;
  /** LIVE_ONLINE: the pandit performs it live on video (only while their live-online switch is on). */
  @IsOptional() @IsIn(DELIVERY_MODES) deliveryMode?: string;
  @IsOptional() @IsIn(PANDIT_SERVICE_TYPES) serviceType?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) groupCapacity?: number;
  @IsOptional() @ValidateNested() @Type(() => KathaDetailsDto) kathaDetails?: KathaDetailsDto;
  @IsOptional() @IsIn(PANDIT_SHIFTS) shift?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsEntityId({ each: true }) candidateProviderIds?: string[];
}

export class CreateMultiPanditBookingRequestDto {
  @IsEntityId() offeringId: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MULTI_PANDIT_REQUESTS, { message: "A booking request can be sent to at most 5 pandits" })
  @IsEntityId({ each: true })
  candidateProviderIds: string[];
  @IsISO8601({ strict: true }) @Matches(WITH_OFFSET, { message: "scheduledStartAt must include a timezone offset (e.g. +05:30 or Z)" }) scheduledStartAt: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) customerName: string;
  @Matches(PHONE, { message: "customerPhone is not a valid phone number" }) customerPhone: string;
  @IsOptional() @trim() @IsString() @MaxLength(160) customerEmail?: string;
  @IsOptional() @ValidateNested() @Type(() => ServiceLocationDto) serviceLocation?: ServiceLocationDto;
  @IsOptional() @trim() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsIn(DELIVERY_MODES) deliveryMode?: string;
  @IsOptional() @IsIn(PANDIT_SERVICE_TYPES) serviceType?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) groupCapacity?: number;
  @IsOptional() @ValidateNested() @Type(() => KathaDetailsDto) kathaDetails?: KathaDetailsDto;
  @IsOptional() @IsIn(PANDIT_SHIFTS) shift?: string;
}

export class AcceptBookingRequestDto {
  @IsOptional() @trim() @IsString() @MaxLength(500) note?: string;
}

export class DeclineBookingRequestDto {
  @IsOptional() @trim() @IsString() @MaxLength(60) reasonCode?: string;
}

/** The YouTube link for this booking's live katha / puja. */
export class BookingLiveStreamDto {
  @trim() @IsString() @MaxLength(300) youtubeUrl: string;
}

export class BookingTransitionDto {
  @trim() @IsString() @MinLength(2) @MaxLength(40) command: string;
  @IsOptional() @trim() @IsString() @MaxLength(60) reasonCode?: string;
}

export class BookingListQueryDto extends PageQueryDto {
  /** Whose bookings to list: the ones you made (default) or the ones made with you as provider. */
  @IsOptional() @IsIn(["customer", "provider"]) role?: string;
  @IsOptional() @IsIn(BOOKING_STATUSES) status?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsEntityId() providerId?: string;
}

// ------------------------------------------------------------- consultations
export class CreateConsultationDto {
  @IsIn(CONSULTATION_TYPES) consultationType: string;
  @IsEntityId() expertProviderId: string;
  @IsIn(CONSULTATION_CHANNELS) channel: string;
  @IsISO8601({ strict: true }) @Matches(WITH_OFFSET, { message: "scheduledStartAt must include a timezone offset (e.g. +05:30 or Z)" }) scheduledStartAt: string;
  /** Defaults to the expert's configured slot length. */
  @IsOptional() @IsInt() @Min(15) @Max(240) durationMinutes?: number;
  /** Customer's question; readable only by the customer and the expert. */
  @IsOptional() @trim() @IsString() @MaxLength(1000) questionSummary?: string;
  /** Optional related provider booking (must be the same customer and expert). */
  @IsOptional() @IsEntityId() bookingId?: string;
}

export class ScheduleConsultationDto {
  /** Omit to confirm the requested time; supply to move it. */
  @IsOptional() @IsISO8601({ strict: true }) @Matches(WITH_OFFSET, { message: "scheduledStartAt must include a timezone offset (e.g. +05:30 or Z)" }) scheduledStartAt?: string;
  @IsOptional() @IsInt() @Min(15) @Max(240) durationMinutes?: number;
}

export class CompleteConsultationDto {
  @IsOptional() @trim() @IsString() @MaxLength(4000) expertNotes?: string;
  /** Mark the customer as absent instead of completing the session. */
  @IsOptional() @IsBoolean() noShow?: boolean;
}

export class CancelWithReasonDto {
  @trim() @IsString() @MinLength(2) @MaxLength(60) reasonCode: string;
}

export class ConsultationListQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(CONSULTATION_STATUSES) status?: string;
}

export class CreatePaymentOrderDto {
  @IsOptional() @IsBoolean() useWallet?: boolean;
}

export class ConfirmProviderPaymentDto {
  @IsString() @MinLength(2) razorpay_order_id: string;
  @IsString() @MinLength(2) razorpay_payment_id: string;
  @IsString() @MinLength(2) razorpay_signature: string;
}

/** A file already stored by the upload service; only Tirvona's media host is accepted. */
export class MessageAttachmentDto {
  @IsUrl({ protocols: ["https"], require_protocol: true, host_whitelist: ["res.cloudinary.com"] }) @MaxLength(500) url: string;
  @trim() @IsString() @MinLength(1) @MaxLength(100) name: string;
  @IsOptional() @IsIn(["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/ogg", "video/mp4"]) mimeType?: string;
}

export class SendConsultationMessageDto {
  @trim() @IsString() @MinLength(1) @MaxLength(4000) content: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => MessageAttachmentDto) attachments?: MessageAttachmentDto[];
}

export class MessageListQueryDto {
  /** Return only messages created after this message id (for polling and reconnects). */
  @IsOptional() @IsEntityId() after?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
