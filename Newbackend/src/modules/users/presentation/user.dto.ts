import { Type } from "class-transformer";
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { USER_ROLES } from "../infrastructure/persistence/user.schema";
export class UserQueryDto {
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit = 100;
}
export class CreateStaffDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() phone: string;
  @IsString() @MinLength(6) password: string;
  @IsIn(["manager", "reception", "housekeeping"]) role: string;
  @IsMongoId() ashramId: string;
}
export class CreateAccountDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsIn(USER_ROLES) role?: string;
  @IsOptional() @IsString() designation?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() joiningDate?: string;
  @IsOptional() @IsArray() permissions?: string[];
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() username?: string;
}
export class UserStatusDto {
  @IsIn(["active", "suspended", "pending"]) status: string;
}
export class SuspendUserDto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsIn(["temporary", "permanent"]) suspensionType = "temporary";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationDays = 7;
  @IsOptional() @IsString() customEndDate?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() visibleMessage?: string;
}
export class ChangeRoleDto {
  @IsIn(USER_ROLES) role: string;
}
export class PermissionsDto {
  @IsArray() permissions: string[];
}
export class AdminResetPasswordDto {
  @IsOptional() @IsString() @MinLength(6) password?: string;
}
export class PermanentDeleteDto {
  @IsString() adminPassword: string;
  @IsIn(["DELETE"]) confirmText: string;
}
