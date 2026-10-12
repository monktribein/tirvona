import { OmitType, PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { IsEntityId } from "../../../../common/decorators/is-entity-id.decorator";
import {
  CONSULTATION_CHANNELS,
  FULFILMENT_TYPES,
  MAX_AMOUNT_MINOR,
  OFFERABLE_FULFILMENT_TYPES,
  OFFERING_STATUSES,
  PROVIDER_SELF_STATUSES,
  PROVIDER_TYPES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_LANGUAGES,
  SUSPENSION_REASON_CODES,
  TRAVEL_CHARGE_POLICIES,
  TRAVEL_MODES,
  STAY_ARRANGEMENTS,
} from "../../domain/provider.constants";
import { PageQueryDto, QueryBoolean } from "./common.dto";

const trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

const PHONE = /^\+?[0-9][0-9\s-]{6,17}$/;
const STRING_LIST = (max: number, itemMax: number) => [
  IsArray(),
  ArrayMaxSize(max),
  IsString({ each: true }),
  MaxLength(itemMax, { each: true }),
  MinLength(1, { each: true }),
];
const apply =
  (...decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) =>
    decorators.forEach((decorator) => decorator(target, key));

// ------------------------------------------------------------------ profile
export class ServiceAreaDto {
  @trim() @IsString() @MinLength(2) @MaxLength(80) city: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) state?: string;
}

export class TravelProfileDto {
  @IsOptional() @IsBoolean() willingToTravel?: boolean;
  @IsOptional() @IsBoolean() overnightOk?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(TRAVEL_MODES, { each: true }) modes?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(24 * 30) minNoticeHours?: number;
  @IsOptional() @apply(...STRING_LIST(20, 80)) regions?: string[];
  /** How far the pandit will travel for a home visit. */
  @IsOptional() @IsInt() @Min(0) @Max(5000) maxDistanceKm?: number;
  /** Where the pandit stays when the puja needs an overnight visit. */
  @IsOptional() @IsIn(STAY_ARRANGEMENTS) stayArrangement?: string;
  /** e.g. "Travel and stay are arranged by the family; I bring all samagri." */
  @IsOptional() @trim() @IsString() @MaxLength(300) notes?: string;
}

export class LiveOnlineDto {
  @IsBoolean() enabled: boolean;
  /** The pandit's YouTube live link (channel live page or a stream). Required to switch on, unless already saved. */
  @IsOptional() @trim() @IsString() @MaxLength(300) youtubeUrl?: string;
}

export class ConsultationSettingsDto {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_AMOUNT_MINOR) feeMinor?: number;
  @IsOptional() @IsIn(SUPPORTED_CURRENCIES) currency?: string;
  @IsOptional() @IsInt() @Min(15) @Max(240) slotMinutes?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsIn(CONSULTATION_CHANNELS, { each: true }) channels?: string[];
}

export class ProviderAddressDto {
  @IsOptional() @trim() @IsString() @MaxLength(200) line1?: string;
  @trim() @IsString() @MinLength(2) @MaxLength(80) city: string;
  @trim() @IsString() @MinLength(2) @MaxLength(80) state: string;
  @IsOptional() @Matches(/^[0-9A-Za-z -]{3,10}$/) pincode?: string;
}

export class CreateProviderProfileDto {
  @IsOptional() @IsIn(PROVIDER_TYPES) providerType?: string;
  @trim() @IsString() @MinLength(2) @MaxLength(120) displayName: string;
  /** Name on the identity document. Defaults to the account name. */
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) legalName?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) bio?: string;
  @IsOptional() @trim() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(500) avatarUrl?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsIn(SUPPORTED_LANGUAGES, { each: true }) languages?: string[];
  @IsOptional() @apply(...STRING_LIST(10, 60)) traditions?: string[];
  @IsOptional() @apply(...STRING_LIST(30, 80)) specializations?: string[];
  @IsOptional() @IsInt() @Min(0) @Max(80) experienceYears?: number;
  @IsOptional() @trim() @IsString() @MaxLength(80) homeCity?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) homeState?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ServiceAreaDto) serviceAreas?: ServiceAreaDto[];
  @IsOptional() @ValidateNested() @Type(() => TravelProfileDto) travelProfile?: TravelProfileDto;
  @IsOptional() @ValidateNested() @Type(() => ConsultationSettingsDto) consultation?: ConsultationSettingsDto;
  /** Private contact (KYC profile). Never shown on the public profile. */
  @IsOptional() @IsEmail() @MaxLength(160) contactEmail?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone is not a valid phone number" }) contactPhone?: string;
  @IsOptional() @ValidateNested() @Type(() => ProviderAddressDto) address?: ProviderAddressDto;
}

export class UpdateProviderProfileDto extends PartialType(CreateProviderProfileDto) {}

/** Super Admin onboarding: an existing account plus the usual profile fields. No status or verification can be supplied. */
export class AdminCreateProviderDto extends CreateProviderProfileDto {
  /** An existing account to attach the profile to. Omit it to create a new login with email, phone and password. */
  @IsOptional() @IsEntityId() userId?: string;
  /** Login email of the new account (new accounts only). */
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  /** Login mobile number of the new account (new accounts only). */
  @IsOptional() @Matches(PHONE, { message: "phone is not a valid phone number" }) phone?: string;
  /** Initial password for the new account. The provider can sign in with it by email or mobile number. */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
}

export class AdminUpdateProviderDto extends PartialType(
  OmitType(CreateProviderProfileDto, ["legalName", "contactEmail", "contactPhone", "address", "consultation", "travelProfile", "serviceAreas"] as const),
) {
  @IsOptional() @IsIn(PROVIDER_SELF_STATUSES) status?: string;
}

export class AdminOfferingStatusDto {
  @IsIn(OFFERING_STATUSES) status: string;
}

export class AdminOfferingQueryDto extends PageQueryDto {
  @IsOptional() @IsEntityId() providerId?: string;
  @IsOptional() @IsIn(OFFERING_STATUSES) status?: string;
}

export class ProviderStatusDto {
  @IsIn(PROVIDER_SELF_STATUSES) status: string;
}

export class ProviderAdminActionDto {
  @IsIn(SUSPENSION_REASON_CODES) reasonCode: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) note?: string;
}

// ---------------------------------------------------------------- offerings
export class TravelChargeDto {
  @IsIn(TRAVEL_CHARGE_POLICIES) policy: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_AMOUNT_MINOR) flatMinor?: number;
  @IsOptional() @trim() @IsString() @MaxLength(300) notes?: string;
}

export class OfferingDestinationDto {
  @trim() @IsString() @MinLength(2) @MaxLength(80) city: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @trim() @IsString() @MaxLength(160) label?: string;
}

export class CreateOfferingDto {
  @IsEntityId() ritualVariantId: string;
  @IsIn(OFFERABLE_FULFILMENT_TYPES) fulfilmentType: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @ValidateNested() @Type(() => OfferingDestinationDto) destination?: OfferingDestinationDto;
  @IsInt() @Min(1) @Max(2880) durationMinutes: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) teamSize?: number;
  @IsOptional() @IsInt() @Min(0) @Max(24 * 90) minNoticeHours?: number;
  /** Mandatory professional fee in minor units (paise). Voluntary dakshina is never included. */
  @IsInt() @Min(0) @Max(MAX_AMOUNT_MINOR) baseProfessionalFeeMinor: number;
  @IsOptional() @IsIn(SUPPORTED_CURRENCIES) currency?: string;
  @IsOptional() @ValidateNested() @Type(() => TravelChargeDto) travelCharge?: TravelChargeDto;
  @IsOptional() @apply(...STRING_LIST(20, 200)) inclusions?: string[];
  @IsOptional() @apply(...STRING_LIST(20, 200)) exclusions?: string[];
  @IsOptional() @IsBoolean() samagriIncluded?: boolean;
  @IsOptional() @IsBoolean() voluntaryDakshinaAllowed?: boolean;
  @IsOptional() @apply(...STRING_LIST(10, 40)) tags?: string[];
  @IsOptional() @IsIn(["ACTIVE", "PAUSED"]) status?: string;
}

/** Variant and fulfilment type are fixed once created: bookings snapshot them. */
export class UpdateOfferingDto extends PartialType(
  OmitType(CreateOfferingDto, ["ritualVariantId", "fulfilmentType", "status"] as const),
) {
  @IsOptional() @IsIn(OFFERING_STATUSES) status?: string;
}

// ------------------------------------------------------------- availability
export class SlotDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be HH:MM (24-hour)" }) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be HH:MM (24-hour)" }) endTime: string;
}

export class WeeklyRuleDto {
  @IsString() dayOfWeek: string;
  @IsBoolean() isAvailable: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => SlotDto) slots?: SlotDto[];
}

export class PutAvailabilityRulesDto {
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => WeeklyRuleDto) rules: WeeklyRuleDto[];
}

export class CreateCalendarBlockDto {
  /** Exact instants (ISO 8601 with offset)... */
  @IsOptional() @IsString() @MaxLength(40) startAt?: string;
  @IsOptional() @IsString() @MaxLength(40) endAt?: string;
  /** ...or whole local dates in the provider's timezone (end date inclusive). */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) endDate?: string;
  @IsOptional() @IsIn(["MANUAL", "TRAVEL"]) blockType?: string;
  @IsOptional() @trim() @IsString() @MaxLength(200) reason?: string;
}

export class AvailabilityQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "from must be YYYY-MM-DD" }) from: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "to must be YYYY-MM-DD" }) to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(1440) durationMinutes?: number;
}

export class CalendarQueryDto extends PageQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
}

// ------------------------------------------------------------------ search
export const PROVIDER_SORTS = [
  "relevance",
  "verification",
  "price_asc",
  "price_desc",
  "newest",
  "experience",
] as const;

export class ProviderSearchQueryDto extends PageQueryDto {
  /** Free text matched against name and declared specialisations. */
  @IsOptional() @trim() @IsString() @MaxLength(80) q?: string;
  /** Ritual id or slug. */
  @IsOptional() @trim() @IsString() @MaxLength(80) ritual?: string;
  @IsOptional() @IsEntityId() ritualVariantId?: string;
  @IsOptional() @IsIn(SUPPORTED_LANGUAGES) language?: string;
  @IsOptional() @IsIn(PROVIDER_TYPES) providerType?: string;
  @IsOptional() @IsIn(FULFILMENT_TYPES) fulfilmentType?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @trim() @IsString() @MaxLength(80) state?: string;
  /** Minimum verification level required. */
  @IsOptional() @IsString() @MaxLength(30) minVerification?: string;
  @IsOptional() @QueryBoolean() @IsBoolean() hasConsultation?: boolean;
  /** Only providers with a free window of `durationMinutes` on this local date. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(1440) durationMinutes?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_AMOUNT_MINOR) minFeeMinor?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(MAX_AMOUNT_MINOR) maxFeeMinor?: number;
  @IsOptional() @IsIn(PROVIDER_SORTS) sort?: string;
}

export class PublicOfferingsQueryDto {
  @IsOptional() @IsIn(FULFILMENT_TYPES) fulfilmentType?: string;
  @IsOptional() @IsEntityId() ritualVariantId?: string;
}
