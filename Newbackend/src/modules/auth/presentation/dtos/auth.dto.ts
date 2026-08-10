import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
  ValidateIf,
} from "class-validator";

export class LoginDto {
  // Wire name retained for existing clients; accepts email or phone.
  @IsString() @IsNotEmpty() email: string;
  @IsString() @MinLength(6) password: string;
}

export class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsPhoneNumber("IN") phone: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsIn(["customer", "owner"]) role?: "customer" | "owner";
  @ValidateIf((dto: RegisterDto) => dto.role === "owner")
  @IsString()
  @IsNotEmpty()
  govtIdType?: string;
  @ValidateIf((dto: RegisterDto) => dto.role === "owner")
  @IsString()
  @MinLength(4)
  govtIdNumber?: string;
  @IsOptional() @IsString() govtIdUrl?: string;
}

export class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsPhoneNumber("IN") phone?: string;
}

export class VerifyChallengeDto {
  @IsString() otpToken: string;
  @IsString() @MinLength(6) otp: string;
}
export class ResendOtpDto {
  @IsString() otpToken: string;
}
export class SendPhoneOtpDto {
  @IsPhoneNumber("IN") phone: string;
}
export class VerifyPhoneOtpDto {
  @IsPhoneNumber("IN") phone: string;
  @IsString() @MinLength(6) otp: string;
}
export class ForgotPasswordDto {
  @IsEmail() email: string;
}
export class ResetPasswordDto {
  @IsString() token: string;
  @IsString() @MinLength(6) newPassword: string;
}
export class GoogleCredentialDto {
  @IsString() credential: string;
}
export class VerifyGoogleDto {
  @IsString() googleToken: string;
  @IsString() @MinLength(6) otp: string;
}
export class ResendGoogleDto {
  @IsString() googleToken: string;
}
export class CompleteGoogleDto {
  @IsString() googleToken: string;
  @IsString() @MinLength(2) name: string;
  @IsPhoneNumber("IN") phone: string;
}
export class CreateOwnerStaffDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsPhoneNumber("IN") phone: string;
  @IsString() @MinLength(6) password: string;
  @IsIn(["owner", "manager", "reception", "housekeeping"]) role: string;
}
export class StaffPasswordDto {
  @IsString() @MinLength(6) password: string;
}
export class StaffStatusDto {
  @IsIn(["active", "suspended"]) status: string;
}
