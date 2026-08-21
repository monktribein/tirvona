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
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  CIRCUIT_DIFFICULTIES,
  CIRCUIT_SEASONS,
  CIRCUIT_STATUSES,
  CIRCUIT_TYPES,
  STOP_TYPES,
} from "../../domain/pilgrimage.constants";

const csv = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value : String(value).split(",").filter(Boolean);
const bool = ({ value }: { value: unknown }): boolean =>
  value === true || value === "true";

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class CircuitSearchDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(CIRCUIT_TYPES) circuitType?: string;
  @IsOptional() @IsIn(CIRCUIT_DIFFICULTIES) difficulty?: string;
  @IsOptional() @IsIn(CIRCUIT_SEASONS) season?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional()
  @Matches(/^\d{1,2}-\d{1,2}$/, { message: "duration must look like 4-7" })
  duration?: string;
  @IsOptional()
  @IsIn(["recommended", "duration_short", "duration_long", "newest"])
  sort = "recommended";
}

export class TemplateQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  durationDays?: number;
}

export class GenerateItineraryDto {
  @IsString() @MaxLength(120) circuitId: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) durationDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) travellers?: number;
  @IsOptional() @IsIn(["relaxed", "balanced", "packed"]) pace?: string;
}

export class ItineraryStopDto {
  @IsString() @MaxLength(160) name: string;
  @IsOptional() @IsIn(STOP_TYPES) stopType?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  suggestedDurationMinutes?: number;
}

export class ItineraryDayDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(60) dayNumber: number;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryStopDto)
  stops?: ItineraryStopDto[];
}

export class SaveItineraryDto {
  @IsString() @MaxLength(160) title: string;
  @IsOptional() @IsMongoId() circuitId?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) travellers?: number;
  @IsOptional() @IsIn(["relaxed", "balanced", "packed"]) pace?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItineraryDayDto)
  days?: ItineraryDayDto[];
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

class CircuitBodyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(CIRCUIT_TYPES) circuitType?: string;
  @IsOptional() @IsString() @MaxLength(400) summary?: string;
  @IsOptional() @IsString() @MaxLength(6000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsString() @MaxLength(120) startCity?: string;
  @IsOptional() @IsString() @MaxLength(120) endCity?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MaxLength(120) region?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) totalDistanceKm?: number;
  @IsOptional() @IsIn(CIRCUIT_DIFFICULTIES) difficulty?: string;
  @IsOptional()
  @Transform(csv)
  @IsArray()
  @IsIn(CIRCUIT_SEASONS, { each: true })
  bestSeasons?: string[];
  @IsOptional() @Transform(csv) @IsArray() @IsString({ each: true }) idealFor?: string[];
  @IsOptional() @IsString() @MaxLength(2000) travelTips?: string;
  @IsOptional() @Transform(bool) @IsBoolean() usableAsPlannerTemplate?: boolean;
}

export class CreateCircuitDto extends CircuitBodyDto {
  @IsMongoId() ashramId: string;
  @IsString() @MaxLength(160) declare name: string;
  @IsIn(CIRCUIT_TYPES) declare circuitType: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) durationDays: number;
}

export class UpdateCircuitDto extends CircuitBodyDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) durationDays?: number;
}

class StopBodyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsIn(STOP_TYPES) stopType?: string;
  @IsOptional() @IsString() @MaxLength(120) templeSlug?: string;
  @IsOptional() @IsMongoId() linkedAshramId?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() googleMapsUrl?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceFromPreviousKm?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) travelMinutes?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  suggestedDurationMinutes?: number;
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  arrivalTime?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
  @IsOptional() @Transform(bool) @IsBoolean() isOvernightStop?: boolean;
}

export class CreateStopDto extends StopBodyDto {
  @IsMongoId() circuitId: string;
  @IsString() @MaxLength(160) declare name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) dayNumber: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class UpdateStopDto extends StopBodyDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) dayNumber?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class ReorderStopEntryDto {
  @IsMongoId() _id: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) dayNumber: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) order?: number;
}

export class ReorderStopsDto {
  @IsMongoId() circuitId: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderStopEntryDto)
  stops: ReorderStopEntryDto[];
}

export class UpsertPilgrimageSettingDto {
  @IsIn(["platform", "ashram", "circuit"]) scope: string;
  @IsOptional() @IsMongoId() ashramId?: string;
  @IsOptional() @IsMongoId() circuitId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) maxDurationDays?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxStopsPerCircuit?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  defaultPaceStopsPerDay?: number;
}

export class ApproveCircuitDto {
  @IsIn(["approve", "reject"]) decision: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ToggleFlagDto {
  @Transform(bool) @IsBoolean() value: boolean;
}

export class SetCircuitStatusDto {
  @IsIn(CIRCUIT_STATUSES) status: string;
}

export class CircuitListQueryDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(CIRCUIT_STATUSES) status?: string;
  @IsOptional() @IsMongoId() ashramId?: string;
}
