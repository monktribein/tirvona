import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from "class-validator";
import {
  PARKING_AMENITIES,
  PARKING_VEHICLE_TYPES,
} from "../../domain/parking.constants";

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class ParkingSearchDto extends PaginationDto {
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() templeSlug?: string;
  @IsOptional() @IsIn(PARKING_VEHICLE_TYPES) vehicleType?: string;
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value) ? value : String(value).split(","),
  )
  @IsArray()
  @IsIn(PARKING_AMENITIES, { each: true })
  amenities?: string[];
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  covered?: boolean;
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  evCharging?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  radiusKm?: number;
  @IsOptional() @IsDateString() entryAt?: string;
  @IsOptional() @IsDateString() exitAt?: string;
  @IsOptional() @IsIn(["recommended", "rating", "newest", "name"]) sortBy =
    "recommended";
}

export class ParkingWindowDto {
  @IsDateString() entryAt: string;
  @IsDateString() exitAt: string;
  @IsOptional() @IsIn(PARKING_VEHICLE_TYPES) vehicleType?: string;
}

export class ParkingQuoteDto extends ParkingWindowDto {
  @IsMongoId() locationId: string;
  @IsMongoId() slotTypeId: string;
  @IsIn(PARKING_VEHICLE_TYPES) declare vehicleType: string;
}

export class CreateParkingBookingDto extends ParkingQuoteDto {
  @IsString()
  @Matches(/^[A-Za-z]{2}[0-9]{1,2}[A-Za-z]{0,3}[0-9]{4}$/, {
    message: "Please enter a valid vehicle number, e.g. MH12AB1234",
  })
  vehicleNumber: string;
  @IsOptional() @IsString() vehicleModel?: string;
  @IsOptional() @IsString() driverName?: string;
  @IsOptional() @IsString() driverPhone?: string;
}

export class ConfirmParkingPaymentDto {
  @IsOptional() @IsString() razorpay_order_id?: string;
  @IsOptional() @IsString() razorpay_payment_id?: string;
  @IsOptional() @IsString() razorpay_signature?: string;
  @IsOptional() @IsString() method?: string;
}

export class CancelParkingDto {
  @IsOptional() @IsString() reason?: string;
}

export class ReviewParkingDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @Type(() => Number) @Min(1) @Max(5) safety?: number;
  @IsOptional() @Type(() => Number) @Min(1) @Max(5) cleanliness?: number;
  @IsOptional() @Type(() => Number) @Min(1) @Max(5) staff?: number;
  @IsOptional() @Type(() => Number) @Min(1) @Max(5) valueForMoney?: number;
}

export class ParkingScanDto {
  @IsString() token: string;
  @IsMongoId() locationId: string;
}
export class ParkingCheckoutScanDto extends ParkingScanDto {
  @IsOptional() @IsString() overstayPaymentMethod = "cash";
}
export class ParkingVehicleLookupDto {
  @IsString() vehicleNumber: string;
  @IsMongoId() locationId: string;
}
