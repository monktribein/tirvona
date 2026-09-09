import { IsIn, IsMongoId, IsOptional, IsString, Matches } from "class-validator";

export const ROOM_SUMMARY_TYPES = [
  "dormitory",
  "private_room",
  "family_room",
  "hall",
] as const;

export const ROOM_SUMMARY_AC_TYPES = ["AC", "Non-AC"] as const;

export const ROOM_SUMMARY_STATUSES = ["active", "under_maintenance"] as const;

export class RoomSummaryQueryDto {
  /** Narrows to one ashram. Omitted, the caller sees everything in their scope. */
  @IsOptional() @IsMongoId() ashramId?: string;

  /**
   * The night the occupancy columns are measured on, as YYYY-MM-DD. Availability
   * only exists per date, so every date-bound count below is read for this one.
   * Omitted, it is today.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: "date must be formatted as YYYY-MM-DD",
  })
  date?: string;

  @IsOptional() @IsIn([...ROOM_SUMMARY_TYPES, "all"]) type?: string;
  @IsOptional() @IsIn([...ROOM_SUMMARY_AC_TYPES, "all"]) acType?: string;
  @IsOptional() @IsIn([...ROOM_SUMMARY_STATUSES, "all"]) status?: string;

  /** Free-text match on the room category name. */
  @IsOptional() @IsString() search?: string;
}
