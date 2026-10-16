import { Transform, Type } from "class-transformer";
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
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  FOOD_DIETARY_TAGS,
  FOOD_FULFILMENT_TYPES,
  FOOD_MEAL_FAMILIES,
} from "../domain/food.constants";

const PHONE = /^\+?[0-9][0-9\s-]{6,17}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const trim = () =>
  Transform(({ value }) => (typeof value === "string" ? value.trim() : value));

export class FoodOutletInputDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) brandName: string;
  @trim() @IsString() @MinLength(5) @MaxLength(300) address: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  serviceZoneCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(FOOD_FULFILMENT_TYPES as unknown as string[], { each: true })
  fulfilmentModes?: string[];

  @IsOptional() @Matches(TIME, { message: "openTime must be HH:MM" }) openTime?: string;
  @IsOptional() @Matches(TIME, { message: "closeTime must be HH:MM" }) closeTime?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone is not a valid phone number" }) contactPhone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) minOrderPaise?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) avgPrepMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5000) capacityPerHour?: number;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) imageUrl?: string;
}

export class FoodOutletUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) brandName?: string;
  @IsOptional() @trim() @IsString() @MinLength(5) @MaxLength(300) address?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  serviceZoneCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(FOOD_FULFILMENT_TYPES as unknown as string[], { each: true })
  fulfilmentModes?: string[];

  @IsOptional() @Matches(TIME, { message: "openTime must be HH:MM" }) openTime?: string;
  @IsOptional() @Matches(TIME, { message: "closeTime must be HH:MM" }) closeTime?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone is not a valid phone number" }) contactPhone?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) minOrderPaise?: number;
  @IsOptional() @IsInt() @Min(1) @Max(240) avgPrepMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(5000) capacityPerHour?: number;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) lat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) lng?: number;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) imageUrl?: string;
}

export class RegisterFoodVendorDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) businessName: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone is not a valid phone number" }) contactPhone?: string;
  @IsOptional() @IsEmail() @MaxLength(160) contactEmail?: string;
  @IsOptional() @trim() @IsString() @MaxLength(40) fssaiReference?: string;

  /** First kitchen/outlet; more can be added later from the dashboard. */
  @IsOptional()
  @ValidateNested()
  @Type(() => FoodOutletInputDto)
  outlet?: FoodOutletInputDto;
}

export class UpdateFoodVendorDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) businessName?: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone is not a valid phone number" }) contactPhone?: string;
  @IsOptional() @IsEmail() @MaxLength(160) contactEmail?: string;
  @IsOptional() @trim() @IsString() @MaxLength(40) fssaiReference?: string;
  @IsOptional()
  @trim()
  @Matches(/^\d{9,18}$/, { message: "bankAccountNumber must be 9 to 18 digits" })
  bankAccountNumber?: string;
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: "bankIfscCode is not a valid IFSC code" })
  bankIfscCode?: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) bankAccountHolderName?: string;
  @IsOptional() @trim() @IsString() @MaxLength(120) bankName?: string;
}

/**
 * Super Admin creates the owner's login and the restaurant together.
 * The password has no strength rules on purpose: the admin hands it over and
 * the owner can change it later.
 */
export class AdminCreateFoodVendorDto extends RegisterFoodVendorDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) ownerName: string;
  @IsEmail() @MaxLength(160) email: string;
  @Matches(PHONE, { message: "phone is not a valid phone number" }) phone: string;
  @IsString() @MinLength(1) @MaxLength(128) password: string;
  /** Approve straight away instead of leaving the restaurant pending. */
  @IsOptional() @IsBoolean() approve?: boolean;
}

export class FoodVendorStatusDto {
  @IsIn(["active", "rejected", "suspended", "pending_verification"])
  status: "active" | "rejected" | "suspended" | "pending_verification";
  @IsOptional() @trim() @IsString() @MaxLength(500) reason?: string;
}

export class FoodVendorListQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}

export class FoodMenuItemDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) label: string;
  @IsIn(FOOD_MEAL_FAMILIES as unknown as string[]) family: string;
  @IsInt() @Min(100) @Max(10_000_000) pricePaise: number;
  @IsOptional() @trim() @IsString() @MaxLength(1000) contents?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
  @IsOptional()
  @IsArray()
  @IsIn(FOOD_DIETARY_TAGS as unknown as string[], { each: true })
  dietaryTags?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(240) prepMinutes?: number;
  @IsOptional() @trim() @IsString() @MaxLength(60) portion?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) dailyCapacity?: number;
  @IsOptional() @Matches(TIME, { message: "cutOffTime must be HH:MM" }) cutOffTime?: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class FoodMenuItemUpdateDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(120) label?: string;
  @IsOptional() @IsIn(FOOD_MEAL_FAMILIES as unknown as string[]) family?: string;
  @IsOptional() @IsInt() @Min(100) @Max(10_000_000) pricePaise?: number;
  @IsOptional() @trim() @IsString() @MaxLength(1000) contents?: string;
  @IsOptional() @trim() @IsString() @MaxLength(1000) description?: string;
  @IsOptional()
  @IsArray()
  @IsIn(FOOD_DIETARY_TAGS as unknown as string[], { each: true })
  dietaryTags?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(240) prepMinutes?: number;
  @IsOptional() @trim() @IsString() @MaxLength(60) portion?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) dailyCapacity?: number;
  @IsOptional() @Matches(TIME, { message: "cutOffTime must be HH:MM" }) cutOffTime?: string;
  @IsOptional() @trim() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

/** What Razorpay checkout hands back to the browser after a successful payment. */
export class ConfirmFoodPaymentDto {
  @IsString() @MaxLength(80) razorpay_order_id: string;
  @IsString() @MaxLength(80) razorpay_payment_id: string;
  @IsOptional() @IsString() @MaxLength(200) razorpay_signature?: string;
}

export class GenerateFoodSettlementsDto {
  @IsDateString() from: string;
  @IsDateString() to: string;
  @IsOptional() @IsString() @MaxLength(40) outletId?: string;
}

/** Attach a login to a restaurant that has none (for example the seeded launch kitchens). */
export class AdminOwnerLoginDto {
  @trim() @IsString() @MinLength(2) @MaxLength(120) ownerName: string;
  @IsEmail() @MaxLength(160) email: string;
  @Matches(PHONE, { message: "phone is not a valid phone number" }) phone: string;
  @IsString() @MinLength(1) @MaxLength(128) password: string;
}

/** Any non-empty password is accepted, by design. */
export class AdminSetPasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) password: string;
}
