import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  LEAD_INTERESTS,
  LEAD_MEETING_MODES,
  LEAD_STATUSES,
} from "../../domain/lead-collection.constants";

class LeadCoordinatesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number | null;
}

class LeadLocationDto {
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) googleMapsUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(120) district?: string;
  @IsOptional() @IsString() @MaxLength(120) state?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => LeadCoordinatesDto)
  coordinates?: LeadCoordinatesDto;
}

class LeadRoomInventoryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000)
  totalRooms?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(10_000_000)
  roomPrice?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000)
  onlineRooms?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100_000)
  offlineRooms?: number | null;
}

class LeadContactDto {
  @IsOptional() @IsString() @MaxLength(120) ownerName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

class LeadMeetingDto {
  @IsOptional() @IsBoolean() requested?: boolean;
  @IsOptional() @IsString() @MaxLength(60) time?: string;
  @IsOptional() @IsIn([...LEAD_MEETING_MODES, ""]) mode?: string;
}

export class SaveLeadDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) name?: string;
  @IsOptional() @ValidateNested() @Type(() => LeadLocationDto)
  location?: LeadLocationDto;
  @IsOptional() @ValidateNested() @Type(() => LeadRoomInventoryDto)
  roomInventory?: LeadRoomInventoryDto;
  @IsOptional() @ValidateNested() @Type(() => LeadContactDto)
  contact?: LeadContactDto;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsOptional() @IsString() @MaxLength(5000) agentNotes?: string;
  @IsOptional() @IsIn(LEAD_INTERESTS as unknown as string[]) interest?: string;
  @IsOptional() @ValidateNested() @Type(() => LeadMeetingDto)
  meeting?: LeadMeetingDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(1_500_000, { each: true })
  images?: string[];
  @IsOptional() @IsString() assignedAgentId?: string;
  @IsOptional() @IsString() @MaxLength(120) assignedAgentName?: string;
  @IsOptional() @IsString() @MaxLength(120) assignedAgentCode?: string;
  @IsOptional() @IsBoolean() fieldVerified?: boolean;
  @IsOptional() @IsString() @MaxLength(120) fieldVerifiedByName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastUpdatedByName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastUpdatedByRole?: string;
  @IsOptional() documentChecklist?: any;
  @IsOptional() @IsString() documentCategory?: string;
  @IsOptional() @IsString() docVerificationStatus?: string;
  @IsOptional() @IsBoolean() documentVerified?: boolean;
  @IsOptional() @IsString() docVerifiedAt?: string;
  @IsOptional() @IsString() docVerifiedByName?: string;
  @IsOptional() @IsString() docVerifiedById?: string;
  @IsOptional() @IsString() docVerificationNotes?: string;
  /**
   * Admin-only. Ignored on the agent routes, where the service always writes
   * `pending` — an agent must not be able to self-approve a lead.
   */
  @IsOptional() @IsIn(LEAD_STATUSES as unknown as string[]) status?:
    | "pending"
    | "approved"
    | "rejected"
    | "converted";
}

export class LeadDecisionDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class LeadQueryDto {
  @IsOptional() @IsIn(LEAD_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(LEAD_INTERESTS as unknown as string[]) interest?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsMongoId() capturedBy?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number =
    20;
}
