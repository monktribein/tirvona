import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { ASHRAM_OWNER_ROLE } from "../../../common/auth/ashram-access";
import { USER_ROLES } from "../infrastructure/persistence/user.schema";

const ASHRAM_SCOPED_ACCOUNT_ROLES = [
  ASHRAM_OWNER_ROLE,
  "manager",
  "reception",
  "housekeeping",
];
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
  @IsString() @MinLength(8) password: string;
  @IsIn(["manager", "reception", "housekeeping"]) role: string;
  @IsMongoId() ashramId: string;
}
export class CreateAccountDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @MinLength(8) password: string;
  @IsIn(USER_ROLES) role: string;
  @IsIn(["Male", "Female", "Other"]) gender: string;
  @IsOptional() @IsString() aadhaarCardUrl?: string;
  @IsOptional() @IsString() panCardUrl?: string;
  @ValidateIf((dto: CreateAccountDto) =>
    ASHRAM_SCOPED_ACCOUNT_ROLES.includes(dto.role),
  )
  @IsMongoId({ message: "Select the ashram this account will be assigned to" })
  assignedAshramId?: string;
}
export class UserStatusDto {
  @IsIn([
    "active",
    "pending",
    "pending_approval",
    "suspended",
    "disabled",
    "archived",
  ])
  status: string;
}
export class UpdateAccountDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsIn(["Male", "Female", "Other"]) gender: string;
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
  @IsOptional() @IsString() aadhaarCardUrl?: string;
  @IsOptional() @IsString() panCardUrl?: string;
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
export class BulkDeleteUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids: string[];
}
