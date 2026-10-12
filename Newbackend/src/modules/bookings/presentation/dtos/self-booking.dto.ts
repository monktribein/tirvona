import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  IsArray,
  ValidateNested,
} from "class-validator";
import { IsEntityId } from "../../../../common/decorators/is-entity-id.decorator";
import {
  BOOKING_SOURCES,
  OFFLINE_PAYMENT_METHODS,
} from "../../domain/booking.utils";

import { RoomBookingDto } from "./booking.dto";

export class CreateSelfBookingDto {
  @IsIn(BOOKING_SOURCES) bookingType: string;
  @IsEntityId() ashramId: string;
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomBookingDto)
  rooms?: RoomBookingDto[];

  @IsOptional()
  @IsEntityId()
  roomId?: string;

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
  @IsEntityId() ashramId: string;
  @IsString() @IsNotEmpty() checkInDate: string;
  @IsString() @IsNotEmpty() checkOutDate: string;
}
