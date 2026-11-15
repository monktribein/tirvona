import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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
  COMMISSION_APPLIES_TO,
  COMMISSION_CHANNELS,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  PAYEE_TYPES,
  PAYOUT_STATUSES,
  RIDE_STATUSES,
  RIDE_TYPES,
  TRANSFER_METHODS,
} from "../domain/yatra.constants";
import { PaginationDto } from "./yatra.dto";

const PHONE = /^\+?[0-9][0-9 -]{7,15}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ------------------------------------------------------------- ride partners
export class RidePartnerAvailabilityDto {
  @IsOptional() @IsArray() @ArrayMaxSize(7) @Type(() => Number) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekdays?: number[];
  @IsOptional() @Matches(CLOCK, { message: "startTime must be HH:MM" }) startTime?: string;
  @IsOptional() @Matches(CLOCK, { message: "endTime must be HH:MM" }) endTime?: string;
  @IsOptional() @IsBoolean() accepting?: boolean;
}

export class RegisterRidePartnerDto {
  @IsString() @Length(3, 120) businessName!: string;
  @IsString() @Length(2, 80) city!: string;
  @IsOptional() @IsString() @MaxLength(80) contactName?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone must be a phone number" }) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) serviceAreas?: string[];
}

export class UpdateRidePartnerDto {
  @IsOptional() @IsString() @Length(3, 120) businessName?: string;
  @IsOptional() @IsString() @Length(2, 80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) contactName?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone must be a phone number" }) contactPhone?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(80, { each: true }) serviceAreas?: string[];
  @IsOptional() @ValidateNested() @Type(() => RidePartnerAvailabilityDto) availability?: RidePartnerAvailabilityDto;
  @IsOptional() @Matches(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, { message: "panNumber must be a valid PAN" }) panNumber?: string;
  @IsOptional() @IsString() @Length(6, 20) drivingLicenceNumber?: string;
}

export class RideVehicleDto {
  @IsOptional() @IsString() @MaxLength(20) id?: string;
  @IsString() @Length(6, 20) registrationNumber!: string;
  @IsIn(RIDE_TYPES.filter((t) => t !== "any")) vehicleType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) seats!: number;
  @IsOptional() @IsBoolean() isAc?: boolean;
}

export class RideVehiclesDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => RideVehicleDto) vehicles!: RideVehicleDto[];
}

export class RidePartnerQueryDto extends PaginationDto {
  @IsOptional() @IsIn(["draft", "submitted", "approved", "rejected", "suspended"]) status?: string;
}

export class PartnerReviewDto {
  @IsIn(["approve", "reject", "suspend", "reinstate"]) action!: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// --------------------------------------------------------------------- rides
export class RideRequestDto {
  @IsString() @Length(3, 300) pickupAddress!: string;
  @IsOptional() @IsString() @MaxLength(120) pickupLandmark?: string;
  @IsString() @Length(3, 300) dropAddress!: string;
  @IsOptional() @IsString() @MaxLength(120) dropLandmark?: string;
  @IsDateString() pickupAt!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) passengers!: number;
  @IsOptional() @IsIn(RIDE_TYPES) rideType?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsEntityId() partnerId?: string;
}

export class RideAcceptDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(200000) fare!: number;
  @IsString() @MaxLength(20) vehicleId!: string;
  @IsOptional() @IsString() @MaxLength(80) driverName?: string;
  @IsOptional() @Matches(PHONE, { message: "driverPhone must be a phone number" }) driverPhone?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class IssueReportDto {
  @IsOptional() @IsIn(ISSUE_CATEGORIES) category?: string;
  @IsOptional() @IsIn(ISSUE_SEVERITIES) severity?: string;
  @IsOptional() @IsString() @MaxLength(140) title?: string;
  @IsString() @Length(5, 2000) description!: string;
}

export class AssignRidePartnerDto {
  @IsEntityId() partnerId!: string;
}

export class AdminRideCancelDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) refundPercent?: number;
}

export class RideQueryDto extends PaginationDto {
  @IsOptional() @IsIn(RIDE_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}

// ------------------------------------------------------------------- finance
export class CommissionRuleDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsIn(COMMISSION_APPLIES_TO) appliesTo!: string;
  @IsOptional() @IsIn(COMMISSION_CHANNELS) channel?: string;
  @IsOptional() @IsEntityId() operatorId?: string;
  @IsOptional() @IsEntityId() ridePartnerId?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10000) commissionBps!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) flatFee?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) taxOnCommissionBps?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000) tdsBps?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class RuleQueryDto {
  @IsOptional() @IsIn(["active", "retired"]) status?: string;
  @IsOptional() @IsIn(COMMISSION_APPLIES_TO) appliesTo?: string;
}

export class PayoutRequestDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

export class FinancePayoutRequestDto extends PayoutRequestDto {
  @IsIn(PAYEE_TYPES) payeeType!: "operator" | "ride_partner";
  @IsEntityId() payeeId!: string;
}

export class PayoutReviewDto {
  @IsIn(["start_review", "approve", "reject"]) action!: "start_review" | "approve" | "reject";
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class TransferDto {
  @IsIn(TRANSFER_METHODS) method!: string;
  @IsDateString() transferDate!: string;
  @IsString() @Length(6, 40) @Matches(/^[A-Za-z0-9-]+$/, { message: "reference must be the bank UTR / reference number" }) reference!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ReconcilePayoutDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) bankAmount!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AdjustmentDto {
  @IsIn(PAYEE_TYPES) payeeType!: "operator" | "ride_partner";
  @IsEntityId() payeeId!: string;
  @IsIn(["credit", "debit"]) direction!: "credit" | "debit";
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(1000000) amount!: number;
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class PayoutQueryDto extends PaginationDto {
  @IsOptional() @IsIn(PAYOUT_STATUSES) status?: string;
  @IsOptional() @IsIn(PAYEE_TYPES) payeeType?: string;
  @IsOptional() @IsEntityId() payeeId?: string;
}

export class PayeeTypeQueryDto {
  @IsOptional() @IsIn(PAYEE_TYPES) payeeType?: "operator" | "ride_partner";
}

export class ReconRunDto {
  @Matches(DAY) date!: string;
}

export class ReportRangeDto {
  @Matches(DAY) from!: string;
  @Matches(DAY) to!: string;
}

export class OptionalRangeDto {
  @IsOptional() @Matches(DAY) from?: string;
  @IsOptional() @Matches(DAY) to?: string;
}

// ---------------------------------------------------------------- operations
export class OpsQueryDto {
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @Matches(DAY) date?: string;
}

export class OpsReportDto extends ReportRangeDto {
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}

export class OpsIssueDto {
  @IsString() @Length(2, 80) city!: string;
  @IsString() @Length(3, 140) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(ISSUE_CATEGORIES) category?: string;
  @IsOptional() @IsIn(ISSUE_SEVERITIES) severity?: string;
  @IsOptional() @IsString() @MaxLength(40) bookingReference?: string;
}

export class IssueUpdateDto {
  @IsIn(ISSUE_STATUSES) status!: string;
  @IsOptional() @IsString() @MaxLength(1000) resolution?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class IssueQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsIn(ISSUE_STATUSES) status?: string;
}
