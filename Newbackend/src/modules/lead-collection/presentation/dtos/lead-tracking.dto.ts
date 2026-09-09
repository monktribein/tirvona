import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { LEAD_TRACKING } from "../../domain/lead-collection.constants";

export class TrackingConsentDto {
  /** True grants tracking, false revokes it. */
  @IsBoolean() granted: boolean;

  /** Shown back to the agent so they can tell which phone is reporting. */
  @IsOptional() @IsString() deviceLabel?: string;
}

export class LocationFixDto {
  @IsLatitude() lat: number;
  @IsLongitude() lng: number;

  /** Radius of uncertainty in metres, straight from the device. */
  @IsOptional() @IsNumber() @Min(0) @Max(100_000) accuracy?: number;

  @IsOptional() @IsNumber() speed?: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsNumber() altitude?: number;

  /** When the device took the fix, so a queued batch keeps its real times. */
  @IsISO8601() recordedAt: string;

  @IsOptional()
  @IsIn(["foreground", "background", "manual"])
  source?: string;
}

export class RecordFixesDto {
  /**
   * A batch rather than one point per request: a phone that loses signal
   * queues its fixes offline and uploads them together when it reconnects.
   */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LEAD_TRACKING.maxBatchSize)
  @ValidateNested({ each: true })
  @Type(() => LocationFixDto)
  fixes: LocationFixDto[];
}

export class TrackingDayQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "date must be formatted as YYYY-MM-DD",
  })
  date?: string;
}

export class TrackingHistoryQueryDto extends TrackingDayQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "startDate must be formatted as YYYY-MM-DD",
  })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "endDate must be formatted as YYYY-MM-DD",
  })
  endDate?: string;
}

export class AgentTrackingQueryDto extends TrackingDayQueryDto {
  @IsOptional() @IsMongoId() agentId?: string;
}
