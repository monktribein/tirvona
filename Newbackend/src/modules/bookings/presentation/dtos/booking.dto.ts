import { PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateBookingDto {
  @IsMongoId() ashramId: string;
  @IsMongoId() roomId: string;
  @IsString() checkInDate: string;
  @IsString() checkOutDate: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) guestsCount: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) roomsBookedCount: number;
  @IsOptional() @IsObject() services?: Record<string, any>;
  @IsOptional() @IsString() promoCode?: string;
  @IsOptional() @IsMongoId() appliedOfferId?: string;
  @IsOptional() @IsString() specialRequests?: string;
  @IsOptional() @IsArray() guests?: Record<string, any>[];
}

export class ConfirmBookingPaymentDto {
  @IsOptional() @IsString() razorpay_order_id?: string;
  @IsOptional() @IsString() razorpay_payment_id?: string;
  @IsOptional() @IsString() razorpay_signature?: string;
  @IsOptional()
  @IsIn(["razorpay", "upi", "cards", "net_banking", "cash", "demo"])
  method = "demo";
  @IsOptional() @IsString() idempotencyKey?: string;
  @IsOptional() @IsString() transactionId?: string;
}

export class BookingDashboardQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() paymentStatus?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class CheckinDto {
  @IsString() @MinLength(6) checkInCode: string;
  @IsOptional() @IsString() roomNumber?: string;
  @IsOptional() @IsString() notes?: string;
}
export class CheckoutDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) additionalCharges = 0;
  @IsOptional() @IsArray() damages?: Record<string, any>[];
}
export class CancelBookingDto {
  @IsString() @MinLength(2) reason: string;
}
export class AssignRoomDto {
  @IsString() @MinLength(1) roomNumber: string;
}
export class UpdateBookingStatusDto {
  @IsIn([
    "pending",
    "confirmed",
    "checked_in",
    "checked_out",
    "completed",
    "cancelled",
    "refunded",
    "no_show",
  ])
  status: string;
  @IsOptional() @IsString() note?: string;
}

export class AdminUpdateBookingDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50)
  assignedRoomNumber?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  specialRequests?: string;
}

export class ValidatePromoDto {
  @IsString() promoCode: string;
  @Type(() => Number) @IsNumber() @Min(0) bookingAmount: number;
  @IsOptional() @IsMongoId() ashramId?: string;
}
export class SaveOfferDto {
  @IsString() offerTitle: string;
  @IsString() description: string;
  @IsString() promoCode: string;
  @IsIn([
    "Percentage",
    "Flat Amount",
    "Free Upgrade",
    "Free Meal",
    "Free Prasad",
    "Free Donation Coupon",
  ])
  discountType: string;
  @Type(() => Number) @IsNumber() @Min(0) discountValue: number;
  @IsString() validTill: string;
  @IsOptional() @IsMongoId() ashramId?: string | null;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumBookingAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumRedemptions?: number;
  @IsOptional() @IsObject() extra?: Record<string, any>;
  @IsOptional() @IsString() shortTitle?: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() offerType?: string;
  @IsOptional() @IsArray() applicableAshrams?: string[];
  @IsOptional() @IsString() fullHtmlDescription?: string;
  @IsOptional() @IsArray() highlights?: string[];
  @IsOptional() @IsArray() termsAndConditions?: string[];
  @IsOptional() @IsString() bannerImage?: string;
  @IsOptional() @IsString() thumbnailImage?: string;
  @IsOptional() @IsString() desktopBanner?: string;
  @IsOptional() @IsString() mobileBanner?: string;
  @IsOptional() @IsArray() galleryImages?: string[];
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() targetRoute?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perUserLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() priority?: number;
  @IsOptional() featured?: boolean;
  @IsOptional()
  @IsIn(["draft", "scheduled", "active", "expired", "disabled"])
  status?: string;
}

export class UpdateOfferDto extends PartialType(SaveOfferDto) {}

export class UpdateOfferStatusDto {
  @IsIn(["draft", "scheduled", "active", "expired", "disabled"])
  status: string;
}

export class ReviewRatingDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(5) overall: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5)
  cleanliness?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5)
  service?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5)
  location?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5)
  valueForMoney?: number;
}
export class CreateReviewDto {
  @IsOptional() @IsMongoId() bookingId?: string;
  @IsMongoId() ashramId: string;
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewRatingDto)
  rating: ReviewRatingDto;
  @IsString() @MinLength(2) @MaxLength(1500) comment: string;
}
