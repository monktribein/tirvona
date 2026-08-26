import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { OFFLINE_ROOM_STATUSES } from "../../infrastructure/persistence/ashram.schemas";

export class OfflineRoomQueryDto {
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() roomId?: string;
  @IsOptional() @IsIn([...OFFLINE_ROOM_STATUSES, "all"]) status?: string;
}

export class SaveOfflineRoomDto {
  @IsMongoId() ashramId: string;
  @IsMongoId() roomId: string;
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
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) units: number;
  @IsString() @IsNotEmpty() fromDate: string;
  @IsString() @IsNotEmpty() toDate: string;
  @IsOptional() @IsString() reason?: string;
}

export class OfflineTransferHistoryQueryDto {
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() offlineRoomId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit = 50;
}
