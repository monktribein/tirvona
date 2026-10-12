import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { IsEntityId } from "../../../../common/decorators/is-entity-id.decorator";
import { OFFLINE_ROOM_STATUSES } from "../../infrastructure/persistence/ashram.schemas";

export class OfflineRoomQueryDto {
  @IsOptional() @IsEntityId() ashramId?: string;
  @IsOptional() @IsEntityId() roomId?: string;
  @IsOptional() @IsIn([...OFFLINE_ROOM_STATUSES, "all"]) status?: string;
}

export class SaveOfflineRoomDto {
  @IsEntityId() ashramId: string;
  @IsEntityId() roomId: string;
  @IsString() @MinLength(2) label: string;
  @Type(() => Number) @IsInt() @Min(0) totalUnits: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) blockedUnits?: number;
  @IsOptional() @IsIn(OFFLINE_ROOM_STATUSES) status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateOfflineRoomDto {
  @IsOptional() @IsString() @MinLength(2) label?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) blockedUnits?: number;
  @IsOptional() @IsIn(OFFLINE_ROOM_STATUSES) status?: string;
  @IsOptional() @IsString() notes?: string;
}

export class TransferOfflineInventoryDto {
  @IsOptional() @IsEntityId() roomId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) units: number;
  @IsString() @IsNotEmpty() fromDate: string;
  @IsString() @IsNotEmpty() toDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class OfflineTransferHistoryQueryDto {
  @IsOptional() @IsEntityId() ashramId?: string;
  @IsOptional() @IsEntityId() offlineRoomId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
}

export class RequestReturnDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) units: number;
  @IsString() @IsNotEmpty() fromDate: string;
  @IsString() @IsNotEmpty() toDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class DecideReturnRequestDto {
  @IsIn(["approve", "reject"]) action: "approve" | "reject";
  @IsOptional() @IsString() rejectionReason?: string;
}

export class DirectReturnRequestDto {
  @IsEntityId() ashramId: string;
  @IsEntityId() roomId: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) units: number;
  @IsString() @IsNotEmpty() fromDate: string;
  @IsString() @IsNotEmpty() toDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class ReturnRequestQueryDto {
  @IsOptional() @IsEntityId() ashramId?: string;
  @IsOptional() @IsEntityId() offlineRoomId?: string;
  @IsOptional()
  @IsIn(["pending", "approved", "rejected", "cancelled", "all"])
  status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
}

