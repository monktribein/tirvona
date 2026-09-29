import { PartialType } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  APPROVAL_STATUSES,
  AWAITING_APPROVAL_FILTER,
  BUSINESS_TYPES,
  FULFILLMENT_STATUSES,
  LISTING_STATUSES,
  MASTER_ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  VENDOR_DOCUMENT_TYPES,
  VENDOR_STATUSES,
} from "../domain/marketplace.constants";

const PINCODE = /^[1-9][0-9]{5}$/;
const PHONE = /^\+?[0-9]{10,13}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const upper = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

// ------------------------------------------------------------- shared
export class PageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AddressInputDto {
  @IsOptional() @IsString() @MaxLength(100) fullName?: string;
  @IsOptional() @Matches(PHONE, { message: "phone must be a valid mobile number" }) phone?: string;
  @IsString() @Length(3, 200) line1!: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(120) landmark?: string;
  @IsString() @Length(2, 80) city!: string;
  @IsString() @Length(2, 80) state!: string;
  @Matches(PINCODE, { message: "pincode must be a valid 6-digit Indian pincode" }) pincode!: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
}

// ------------------------------------------------------------- vendor
export class CreateVendorProfileDto {
  @IsString() @Length(3, 80) storeName!: string;
  @IsOptional() @IsString() @MaxLength(160) legalBusinessName?: string;
  @IsOptional() @IsIn(BUSINESS_TYPES) businessType?: (typeof BUSINESS_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @Matches(PHONE, { message: "contactPhone must be a valid mobile number" }) contactPhone?: string;
  @IsOptional() @ValidateNested() @Type(() => AddressInputDto) address?: AddressInputDto;
  @IsOptional() @IsUrl() logoUrl?: string;
  @IsOptional() @Transform(upper) @Matches(GSTIN, { message: "gstin is not a valid GSTIN" }) gstin?: string;
}
export class UpdateVendorProfileDto extends PartialType(CreateVendorProfileDto) {}

export class AddVendorDocumentDto {
  @IsIn(VENDOR_DOCUMENT_TYPES) type!: (typeof VENDOR_DOCUMENT_TYPES)[number];
  /** URL returned by the existing POST /uploads endpoint. */
  @IsUrl() fileUrl!: string;
  @IsOptional() @IsString() @MaxLength(160) fileName?: string;
  @IsOptional() @IsString() @MaxLength(40) documentNumberMasked?: string;
}

export class AddBankAccountDto {
  @IsString() @Length(2, 100) accountHolderName!: string;
  @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @Matches(/^[0-9]{9,18}$/, { message: "accountNumber must be 9-18 digits" }) accountNumber!: string;
  @Transform(upper) @Matches(IFSC, { message: "ifsc is not a valid IFSC code" }) ifsc!: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class ReasonDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class VendorAdminQueryDto extends PageQueryDto {
  /** A vendor status, or "awaiting" for draft + pending_verification + under_review. */
  @IsOptional() @IsIn([...VENDOR_STATUSES, AWAITING_APPROVAL_FILTER]) status?: string;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}

export class VendorActionDto {
  @IsIn(["start_review", "approve", "reject", "suspend", "reactivate"])
  action!: "start_review" | "approve" | "reject" | "suspend" | "reactivate";
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class VendorCommissionDto {
  /** null clears the override. */
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPercent!: number | null;
}

export class ReviewDocumentDto {
  @IsIn(["verified", "rejected"]) status!: "verified" | "rejected";
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class VerifyBankAccountDto {
  @IsIn(["verified", "rejected"]) status!: "verified" | "rejected";
}

// ----------------------------------------------------------- category
export class CreateCategoryDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "slug must be lowercase words separated by hyphens" }) slug?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsMongoId() parentId?: string;
  @IsOptional() @IsUrl() image?: string;
  @IsOptional() @IsIn(["active", "inactive"]) status?: "active" | "inactive";
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPercent?: number;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  /** null moves the category to the top level. */
  @IsOptional() @IsMongoId() declare parentId?: string;
}

class ReorderItemDto {
  @IsMongoId() id!: string;
  @IsInt() @Min(0) sortOrder!: number;
}
export class ReorderCategoriesDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ReorderItemDto)
  order!: ReorderItemDto[];
}

// ------------------------------------------------------------ product
class SpecificationDto {
  @IsString() @MaxLength(60) key!: string;
  @IsString() @MaxLength(300) value!: string;
}
class DimensionsDto {
  @IsOptional() @IsNumber() @Min(0) length?: number;
  @IsOptional() @IsNumber() @Min(0) width?: number;
  @IsOptional() @IsNumber() @Min(0) height?: number;
  @IsOptional() @IsIn(["cm", "mm", "in"]) unit?: string;
}

export class CreateProductDto {
  @IsString() @Length(3, 150) name!: string;
  @IsMongoId() categoryId!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(300) shortDescription?: string;
  @IsOptional() @Transform(upper) @Matches(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, { message: "sku must be 2-40 letters, digits, - or _" }) sku?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(10000000) price!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) salePrice?: number;
  @IsOptional() @IsNumber() @IsIn([0, 5, 12, 18, 28]) gstPercent?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsUrl({}, { each: true }) images?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => SpecificationDto) specifications?: SpecificationDto[];
  @IsOptional() @IsString() @MaxLength(40) weight?: string;
  @IsOptional() @ValidateNested() @Type(() => DimensionsDto) dimensions?: DimensionsDto;
  @IsOptional() @IsString() @MaxLength(160) templeSource?: string;
  @IsOptional() @IsString() @MaxLength(300) authenticityCertificate?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) stock?: number;
  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100000) lowStockThreshold?: number;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class SetListingDto {
  @IsIn(["active", "inactive", "archived"]) listingStatus!: "active" | "inactive" | "archived";
}

export class SetStockDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) stock!: number;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}

export class ProductQueryDto extends PageQueryDto {
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @IsOptional() @IsMongoId() categoryId?: string;
  @IsOptional() @IsMongoId() vendorId?: string;
  @IsOptional() @IsString() @MaxLength(80) vendorSlug?: string;
  @IsOptional() @IsIn(APPROVAL_STATUSES) approvalStatus?: string;
  @IsOptional() @IsIn(LISTING_STATUSES) listingStatus?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @Transform(({ value }) => value === true || value === "true") @IsBoolean() inStock?: boolean;
  @IsOptional() @IsIn(["featured", "price_low", "price_high", "newest", "rating"]) sortBy?: string;
}

export class ProductReviewDecisionDto {
  @IsIn(["approve", "reject"]) decision!: "approve" | "reject";
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ProductDisableDto {
  @IsBoolean() disabled!: boolean;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

// -------------------------------------------------------------- orders
export class CartItemDto {
  @IsMongoId() productId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) quantity!: number;
}

export class QuoteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CartItemDto)
  items!: CartItemDto[];
}

export class CheckoutAddressDto extends AddressInputDto {
  @IsString() @Length(2, 100) declare fullName: string;
  @Matches(PHONE, { message: "phone must be a valid mobile number" }) declare phone: string;
}

export class CheckoutDto extends QuoteDto {
  /** A saved address from the existing /marketplace/addresses book. */
  @IsOptional() @IsMongoId() addressId?: string;
  @IsOptional() @ValidateNested() @Type(() => CheckoutAddressDto) address?: CheckoutAddressDto;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  /** Client-generated key; retrying checkout with the same key returns the same order. */
  @IsOptional() @IsString() @Length(8, 80) idempotencyKey?: string;
}

export class ConfirmPaymentDto {
  @IsString() @Length(4, 80) razorpay_order_id!: string;
  @IsString() @Length(4, 80) razorpay_payment_id!: string;
  @IsOptional() @IsString() @MaxLength(200) razorpay_signature?: string;
}

export class OrderQueryDto extends PageQueryDto {
  @IsOptional() @IsIn([...MASTER_ORDER_STATUSES, ...FULFILLMENT_STATUSES]) status?: string;
  @IsOptional() @IsIn(PAYMENT_STATUSES) paymentStatus?: string;
  @IsOptional() @IsMongoId() vendorId?: string;
  @IsOptional() @IsMongoId() customerId?: string;
}

class TrackingDto {
  @IsOptional() @IsString() @MaxLength(60) carrier?: string;
  @IsOptional() @IsString() @MaxLength(80) trackingNumber?: string;
  @IsOptional() @IsUrl() trackingUrl?: string;
}

export class UpdateFulfillmentDto {
  @IsIn(FULFILLMENT_STATUSES) status!: (typeof FULFILLMENT_STATUSES)[number];
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @ValidateNested() @Type(() => TrackingDto) tracking?: TrackingDto;
}

export class ReturnRequestDto {
  @IsString() @Length(5, 500) reason!: string;
}

export class ResolveReturnDto {
  @IsBoolean() approve!: boolean;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// ------------------------------------------------------------- finance
export class RequestPayoutDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount!: number;
  @IsOptional() @IsMongoId() bankAccountId?: string;
  @IsOptional() @IsIn(["IMPS", "NEFT", "RTGS"]) mode?: "IMPS" | "NEFT" | "RTGS";
}

export class PayoutQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(PAYOUT_STATUSES) status?: string;
  @IsOptional() @IsMongoId() vendorId?: string;
}

export class MarkPayoutPaidDto {
  @IsString() @Length(6, 40) utr!: string;
}

export class LedgerQueryDto extends PageQueryDto {
  @IsOptional() @IsString() type?: string;
}

export class AdjustmentDto {
  @IsIn(["credit", "debit"]) direction!: "credit" | "debit";
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @IsString() @Length(5, 300) reason!: string;
}

export class UpdateSettingsDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) defaultCommissionPercent?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) settlementHoldDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(90) returnWindowDays?: number;
  @IsOptional() @IsNumber() @IsIn([0, 5, 12, 18, 28]) defaultGstPercent?: number;
  @IsOptional() @IsNumber() @Min(0) shippingFee?: number;
  @IsOptional() @IsNumber() @Min(0) freeShippingAbove?: number;
  @IsOptional() @IsInt() @Min(5) @Max(60) reservationMinutes?: number;
  @IsOptional() @IsNumber() @Min(1) minimumPayoutAmount?: number;
}

// -------------------------------------------------------------- reviews
export class CreateReviewDto {
  @IsMongoId() vendorOrderId!: string;
  @IsMongoId() productId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating!: number;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class ReviewStatusDto {
  @IsIn(["published", "hidden"]) status!: "published" | "hidden";
}

export class ReviewQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(["published", "hidden"]) status?: string;
  @IsOptional() @IsMongoId() vendorId?: string;
}
