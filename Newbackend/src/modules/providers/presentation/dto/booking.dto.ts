import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsUrl,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
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

export class CreateProviderBookingDto {
  @IsMongoId() offeringId: string;
  @IsISO8601({ strict: true }) @Matches(WITH_OFFSET, { message: "scheduledStartAt must include a timezone offset (e.g. +05:30 or Z)" }) scheduledStartAt: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) customerName: string;
  @Matches(PHONE, { message: "customerPhone is not a valid phone number" }) customerPhone: string;
  /** Required when the service is performed at the customer's address. */
  @IsOptional() @ValidateNested() @Type(() => ServiceLocationDto) serviceLocation?: ServiceLocationDto;
  @IsOptional() @trim() @IsString() @MaxLength(500) notes?: string;
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
  @IsOptional() @IsMongoId() providerId?: string;
}

// ------------------------------------------------------------- consultations
export class CreateConsultationDto {
  @IsIn(CONSULTATION_TYPES) consultationType: string;
  @IsMongoId() expertProviderId: string;
  @IsIn(CONSULTATION_CHANNELS) channel: string;
  @IsISO8601({ strict: true }) @Matches(WITH_OFFSET, { message: "scheduledStartAt must include a timezone offset (e.g. +05:30 or Z)" }) scheduledStartAt: string;
  /** Defaults to the expert's configured slot length. */
  @IsOptional() @IsInt() @Min(15) @Max(240) durationMinutes?: number;
  /** Customer's question; readable only by the customer and the expert. */
  @IsOptional() @trim() @IsString() @MaxLength(1000) questionSummary?: string;
  /** Optional related provider booking (must be the same customer and expert). */
  @IsOptional() @IsMongoId() bookingId?: string;
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
  @IsOptional() @IsMongoId() after?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
