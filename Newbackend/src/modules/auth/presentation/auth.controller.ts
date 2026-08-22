import { Body, Controller, Get, Param, Post, Put, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../../../common/decorators/current-user.decorator";
import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import {
  DefaultSensitiveThrottle,
  SensitiveThrottle,
} from "../../../common/throttling/rate-limit.decorators";
import {
  USER_REPOSITORY,
  UserRepository,
} from "../../users/domain/user.repository";
import { Inject } from "@nestjs/common";
import { AuthService } from "../application/auth.service";
import {
  ChangeMyPasswordDto,
  CompleteGoogleDto,
  CreateOwnerStaffDto,
  ForgotPasswordDto,
  GoogleCredentialDto,
  LoginDto,
  RegisterDto,
  ResendGoogleDto,
  ResendOtpDto,
  ResetPasswordDto,
  SendPhoneOtpDto,
  StaffPasswordDto,
  StaffStatusDto,
  UpdateMeDto,
  VerifyChallengeDto,
  VerifyGoogleDto,
  VerifyPhoneOtpDto,
} from "./dtos/auth.dto";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  @Public()
  @Post("login")
  @DefaultSensitiveThrottle("email")
  async login(@Body() dto: LoginDto) {
    return { success: true, data: await this.auth.login(dto) };
  }

  @Public()
  @Post("register")
  @DefaultSensitiveThrottle("email", "phone")
  async register(@Body() dto: RegisterDto) {
    const result = await this.auth.register(dto);
    return result.otpRequired
      ? {
          success: true,
          otpRequired: true,
          message: "Verification code sent to your email.",
          data: result.challenge,
        }
      : { success: true, data: result };
  }

  @Public()
  @Post("register/verify-otp")
  @SensitiveThrottle(30, 900_000, "otpToken")
  async registerOtp(@Body() dto: VerifyChallengeDto) {
    return {
      success: true,
      data: await this.auth.verifyChallenge(dto.otpToken, dto.otp, "register"),
    };
  }
  @Public()
  @Post("login/verify-otp")
  @SensitiveThrottle(30, 900_000, "otpToken")
  async loginOtp(@Body() dto: VerifyChallengeDto) {
    return {
      success: true,
      data: await this.auth.verifyChallenge(dto.otpToken, dto.otp, "login"),
    };
  }
  @Public()
  @Post("resend-otp")
  @SensitiveThrottle(10, 900_000, "otpToken")
  async resend(@Body() dto: ResendOtpDto) {
    return {
      success: true,
      message: "A new verification code was sent.",
      data: await this.auth.resend(dto.otpToken),
    };
  }
  @Public()
  @Post("otp/send")
  @SensitiveThrottle(10, 900_000, "phone")
  async sendPhone(
    @Body() dto: SendPhoneOtpDto,
    @Req() request: Request & { id?: string },
  ) {
    return {
      success: true,
      message: "OTP sent.",
      data: await this.auth.sendPhoneOtp(dto.phone, request.id),
    };
  }
  @Public()
  @Post("otp/verify")
  @SensitiveThrottle(30, 900_000, "phone")
  async verifyPhone(@Body() dto: VerifyPhoneOtpDto) {
    return {
      success: true,
      data: await this.auth.verifyPhoneOtp(dto.phone, dto.otp),
    };
  }
  @Public()
  @Post("forgot-password")
  @DefaultSensitiveThrottle("email")
  async forgot(
    @Body() dto: ForgotPasswordDto,
  ) {
    await this.auth.forgotPassword(dto.email);
    return {
      success: true,
      message: "If that account exists, a reset link has been sent.",
    };
  }
  @Public()
  @Get("reset-password/:token")
  @DefaultSensitiveThrottle("token")
  async verifyReset(
    @Param("token") token: string,
  ) {
    await this.auth.resetUser(token);
    return { success: true, message: "Reset token is valid." };
  }
  @Public()
  @Post("reset-password")
  @DefaultSensitiveThrottle("token")
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetUser(dto.token, dto.newPassword);
    return { success: true, message: "Password reset successfully." };
  }
  @Public()
  @Post("google")
  @DefaultSensitiveThrottle("credential")
  async google(@Body() dto: GoogleCredentialDto) {
    const result = await this.auth.google(dto.credential);
    return result.otpRequired
      ? {
          success: true,
          otpRequired: true,
          message: "Verify your email to continue.",
          data: result.challenge,
        }
      : { success: true, data: result.session };
  }
  @Public()
  @Post("google/verify-otp")
  @SensitiveThrottle(30, 900_000, "googleToken")
  async googleVerify(
    @Body() dto: VerifyGoogleDto,
  ) {
    return {
      success: true,
      message: "Email verified.",
      data: await this.auth.verifyGoogle(dto.googleToken, dto.otp),
    };
  }
  @Public()
  @Post("google/resend-otp")
  @SensitiveThrottle(10, 900_000, "googleToken")
  async googleResend(
    @Body() dto: ResendGoogleDto,
  ) {
    return {
      success: true,
      message: "A new code was sent.",
      data: await this.auth.resend(dto.googleToken),
    };
  }
  @Public()
  @Post("google/complete")
  @DefaultSensitiveThrottle("googleToken", "phone")
  async googleComplete(
    @Body() dto: CompleteGoogleDto,
  ) {
    return {
      success: true,
      message: "Google account created.",
      data: await this.auth.completeGoogle(
        dto.googleToken,
        dto.name,
        dto.phone,
      ),
    };
  }

  @Get("me")
  @ApiBearerAuth()
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.users.findById(current.id);
    if (!user) return { success: false, message: "User not found" };
    return { success: true, data: await this.auth.session(user) };
  }

  @Put("me")
  @ApiBearerAuth()
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ) {
    const user = await this.users.findById(current.id);
    if (!user) return { success: false, message: "User not found" };
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.phone !== undefined) user.phone = dto.phone;
    await user.save();
    return { success: true, data: await this.auth.session(user) };
  }

  @Put("me/password")
  @ApiBearerAuth()
  async changeMyPassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: ChangeMyPasswordDto,
  ) {
    const user = await this.auth.changeMyPassword(
      current.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return {
      success: true,
      message: "Password updated successfully.",
      data: await this.auth.session(user),
    };
  }

  @Get("owner-staff") @Roles("super_admin") async staff(
    @CurrentUser() current: AuthenticatedUser,
  ) {
    return { success: true, data: await this.auth.ownerStaff(current) };
  }
  @Post("owner-staff") @Roles("super_admin") async createStaff(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateOwnerStaffDto,
  ) {
    return {
      success: true,
      message: "Staff member created successfully",
      data: await this.auth.createStaff(current, dto),
    };
  }
  @Put("owner-staff/:id/password")
  @Roles("super_admin")
  async staffPassword(
    @CurrentUser() current: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: StaffPasswordDto,
  ) {
    await this.auth.staffPassword(current, id, dto.password);
    return { success: true, message: "Password updated successfully" };
  }
  @Put("owner-staff/:id/status")
  @Roles("super_admin")
  async staffStatus(
    @CurrentUser() current: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: StaffStatusDto,
  ) {
    return {
      success: true,
      message: `Status updated to ${dto.status}`,
      data: await this.auth.staffStatus(current, id, dto.status),
    };
  }
}
