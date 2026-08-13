import { Type } from "class-transformer";
import { PartialType } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
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
} from "class-validator";

export class AshramQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsString() query?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) guests?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @IsString() amenities?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsString() verified?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class SaveAshramDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() tagline?: string;
  @IsOptional()
  @IsIn(["ashram", "dharamshala", "homestay"])
  ashramType?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() history?: string;
  @IsOptional() @IsString() foundedBy?: string;
  @IsOptional() @IsString() establishedYear?: string;
  @IsObject() address: Record<string, any>;
  @IsObject() contact: Record<string, any>;
  @IsObject() trust: Record<string, any>;
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsArray() amenities?: string[];
  @IsOptional() @IsArray() activities?: string[];
  @IsOptional() @IsString() dailySchedule?: string;
  @IsOptional() @IsString() specialEvents?: string;
  @IsOptional() @IsArray() rooms?: Record<string, any>[];
  @IsOptional() @IsObject() pricing?: Record<string, any>;
  @IsOptional() @IsObject() policies?: Record<string, any>;
  @IsOptional() @IsArray() rules?: string[];
  @IsOptional() @IsObject() food?: Record<string, any>;
  @IsOptional() @IsArray() nearbyAttractions?: Record<string, any>[];
  @IsOptional() @IsObject() medical?: Record<string, any>;
  @IsOptional() @IsObject() transport?: Record<string, any>;
  @IsOptional() @IsObject() documents?: Record<string, any>;
}

/**
 * Owner edit screens (the wizard's edit mode, the manage-ashram inline editor)
 * each submit a different subset of the profile, so an update accepts any
 * subset of the create payload.
 */
export class UpdateAshramDto extends PartialType(SaveAshramDto) {}

export class SaveAddOnDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @Type(() => Number) @IsNumber() @Min(0) price: number;
  @IsOptional()
  @IsIn(["per_day", "per_meal", "per_person", "one_time", "per_box"])
  unit?: string;
  @IsOptional() @IsString() @MaxLength(60) unitLabel?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  maxQuantity?: number;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() iconUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class UpdateAddOnDto extends PartialType(SaveAddOnDto) {}

export class AshramDocumentsDto {
  @IsOptional() @IsString() trustDeedUrl?: string;
  @IsOptional() @IsString() fireSafetyCertificateUrl?: string;
  @IsOptional() @IsString() landOwnershipUrl?: string;
  @IsOptional() @IsString() uploadNotes?: string;
}

export class CreateRoomDto {
  @IsMongoId() ashramId: string;
  @IsString() name: string;
  @IsIn(["dormitory", "private_room", "family_room", "hall"]) type: string;
  @IsIn(["AC", "Non-AC"]) acType: string;
  @Type(() => Number) @IsInt() @Min(1) capacity: number;
  @Type(() => Number) @IsInt() @Min(0) totalInventory: number;
  @Type(() => Number) @IsNumber() @Min(0) basePrice: number;
  @IsOptional() @IsArray() amenities?: string[];
  @IsOptional() @IsArray() images?: string[];
}

/**
 * Editing a room is a partial write.
 *
 * `CreateRoomDto` demands every field because a room without a capacity or a
 * rate is meaningless. Reusing it for PUT forced the console to resend the
 * whole record — including `ashramId` — to change a single price.
 */
export class UpdateRoomDto extends PartialType(CreateRoomDto) {
  /**
   * Rooms cannot be moved between ashrams. Availability, bookings, inventory
   * and pricing rules are all keyed to the original ashram, so re-parenting a
   * room would orphan every one of them.
   */
  ashramId?: never;
  @IsOptional()
  @IsIn(["active", "under_maintenance"])
  status?: string;
}

export class RoomAvailabilityDto {
  @IsString() date: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) customPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maintenanceCount = 0;
}
