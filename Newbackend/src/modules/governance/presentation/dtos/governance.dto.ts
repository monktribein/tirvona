import { Type } from "class-transformer";
import { PartialType } from "@nestjs/swagger";
import {
  Allow,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class ApprovalRequestDto {
  @IsIn([
    "ashram",
    "room_category",
    "room",
    "amenities",
    "pricing",
    "offer",
    "gallery",
    "volunteer",
    "marketplace",
    "service",
    "blog",
    "event",
    "temple",
    "banner",
    "other",
  ])
  module: string;
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() ashramId?: string;
  @IsString() @MaxLength(240) title: string;
  @IsObject() requestedData: Record<string, unknown>;
  @IsOptional() @IsObject() currentData?: Record<string, unknown>;
  @IsOptional() @IsIn(["low", "normal", "high", "urgent"]) priority?: string;
}
export class ReviewApprovalDto {
  @IsIn(["approve", "reject", "request_changes", "under_review"])
  action: string;
  @IsOptional() @IsString() @MaxLength(2000) reviewComment?: string;
}
export class ApprovalCommentDto {
  @IsString() @MaxLength(2000) text: string;
}
export class RoomCategoryRequestDto {
  @IsString() @MaxLength(160) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxGuests?: number;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultAmenities?: string[];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  suggestedBasePrice?: number;
  @IsOptional() @IsString() @MaxLength(2000) reasonForRequest?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() ashramId?: string;
  @IsOptional() @IsString() @MaxLength(240) title?: string;
  @IsOptional() @IsIn(["low", "normal", "high", "urgent"]) priority?: string;
}
export class ResubmitRoomCategoryRequestDto extends PartialType(
  RoomCategoryRequestDto,
) {}
export class InstitutionDto {
  @IsString() @MaxLength(200) legalName: string;
  @IsOptional() @IsString() trustName?: string;
  @IsOptional() @IsString() registrationNo?: string;
  @IsOptional() @IsString() trustType?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3000)
  establishedYear?: number;
  @IsOptional() @Allow() taxExemption80G?: boolean;
  @IsOptional() @Allow() fcraRegistered?: boolean;
  @IsOptional() @IsString() ashramId?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional()
  @IsIn(["onboarding", "pending", "verified", "suspended", "rejected"])
  status?: string;
}
export class UpdateInstitutionDto extends PartialType(InstitutionDto) {}
export class BulkNotificationDto {
  @IsArray() @IsString({ each: true }) ids: string[];
  @IsIn(["delete", "mark_read", "mark_unread", "archive"]) action: string;
}
