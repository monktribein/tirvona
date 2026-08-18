import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  LEAD_USER_ROLES,
  LEAD_USER_STATUSES,
} from "../../domain/lead-collection.constants";

export class CreateLeadUserDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(10) @MaxLength(20) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsOptional() @IsIn(LEAD_USER_ROLES as unknown as string[]) role?:
    | "field_agent"
    | "field_supervisor";
  @IsOptional() @IsIn(LEAD_USER_STATUSES as unknown as string[]) status?: string;
  @IsString() @MinLength(2) @MaxLength(120) state!: string;
  @IsString() @MinLength(2) @MaxLength(120) district!: string;
  @IsOptional() @IsString() @MaxLength(40) employeeCode?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

/**
 * Everything optional — the console sends only what changed. The password is
 * deliberately absent: it moves through `resetPassword`, which also has to
 * invalidate live sessions.
 */
export class UpdateLeadUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MinLength(10) @MaxLength(20) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsIn(LEAD_USER_ROLES as unknown as string[]) role?:
    | "field_agent"
    | "field_supervisor";
  @IsOptional() @IsIn(LEAD_USER_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) state?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) district?: string;
  @IsOptional() @IsString() @MaxLength(40) employeeCode?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateLeadRegionDto {
  @IsString() @MinLength(2) @MaxLength(120) state!: string;
  @IsString() @MinLength(2) @MaxLength(120) district!: string;
}

export class ResetLeadUserPasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

export class LeadUserQueryDto {
  @IsOptional() @IsIn(LEAD_USER_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(LEAD_USER_ROLES as unknown as string[]) role?: string;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number =
    20;
}
