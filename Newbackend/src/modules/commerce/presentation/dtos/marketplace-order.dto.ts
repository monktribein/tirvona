import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
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

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(30) label?: string;
  @IsString() @MinLength(2) @MaxLength(80) fullName!: string;
  @Matches(/^[0-9+\-\s]{8,15}$/, { message: "phone must be a valid number" })
  phone!: string;
  @IsString() @MinLength(3) @MaxLength(120) line1!: string;
  @IsOptional() @IsString() @MaxLength(120) line2?: string;
  @IsOptional() @IsString() @MaxLength(80) landmark?: string;
  @IsString() @MinLength(2) @MaxLength(60) city!: string;
  @IsString() @MinLength(2) @MaxLength(60) state!: string;
  @Matches(/^[1-9][0-9]{5}$/, { message: "pincode must be 6 digits" })
  pincode!: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto extends AddressDto {}

class OrderItemDto {
  @IsMongoId() productId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) quantity!: number;
}

export class CreateMarketplaceOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional() @IsMongoId() addressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional() @IsBoolean() saveAddress?: boolean;

  @IsOptional() @IsIn(["online", "cod"]) paymentMode?: "online" | "cod";

  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class ConfirmMarketplacePaymentDto {
  @IsString() razorpay_order_id!: string;
  @IsString() razorpay_payment_id!: string;
  @IsString() razorpay_signature!: string;
}

export class MarketplaceOrderQueryDto {
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
