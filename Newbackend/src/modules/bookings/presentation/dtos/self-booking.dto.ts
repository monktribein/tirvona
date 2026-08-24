import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import {
  BOOKING_SOURCES,
  OFFLINE_PAYMENT_METHODS,
} from "../../domain/booking.utils";

export class CreateSelfBookingDto {
  @IsIn(BOOKING_SOURCES) bookingType: string;
  @IsMongoId() ashramId: string;
  @IsMongoId() roomId: string;

  @IsString() @MinLength(2) guestName: string;
  @IsString() @IsNotEmpty() guestPhone: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() guestIdType?: string;
  @IsOptional() @IsString() guestIdNumber?: string;
  @IsOptional() @IsString() guestAddress?: string;

  @IsString() @IsNotEmpty() checkInDate: string;
  @IsString() @IsNotEmpty() checkOutDate: string;

  @Type(() => Number) @IsInt() @Min(1) guestsCount: number;
  @Type(() => Number) @IsInt() @Min(1) roomsBookedCount: number;

  @ValidateIf((dto: CreateSelfBookingDto) => dto.bookingType === "self")
  @IsIn(OFFLINE_PAYMENT_METHODS)
  paymentMethod?: string;

  @ValidateIf((dto: CreateSelfBookingDto) => dto.bookingType === "self")
  @Type(() => Number)
  @Min(0)
  amountCollected?: number;

  @IsOptional() @IsString() paymentReference?: string;
  @IsOptional() @IsString() specialRequests?: string;
}

export class SelfBookingAvailabilityDto {
  @IsMongoId() ashramId: string;
  @IsString() @IsNotEmpty() checkInDate: string;
  @IsString() @IsNotEmpty() checkOutDate: string;
}
