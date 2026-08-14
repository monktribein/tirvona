import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";
import {
  USER_REPOSITORY,
  UserRepository,
} from "../../users/domain/user.repository";
import type { UserDocument } from "../../users/infrastructure/persistence/user.schema";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";
import type { LoginDto, RegisterDto } from "../presentation/dtos/auth.dto";
import {
  ASHRAM_ADMIN_ROLE,
  ASHRAM_OWNER_ROLE,
  canonicalAshramRole,
} from "../../../common/auth/ashram-access";

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectModel("AuthChallenge") private readonly challenges: Model<any>,
    @InjectModel("User") private readonly userModel: Model<any>,
    @InjectModel(PARKING_MODEL.Staff) private readonly parkingStaff: Model<any>,
  ) {}

  /**
   * The parking roles an account currently holds.
   *
   * Parking authorisation is a grant in `parking_staff`, not a value of
   * `User.role` — the enum has no parking entries at all — so a security guard
   * or parking partner still reads `role: "customer"`. Nothing downstream can
   * tell them apart from a pilgrim without this, which is why it travels on the
   * session: the client uses it to route to the right dashboard.
   *
   * Only ACTIVE grants count; a revoked one leaves the account an ordinary
   * Visitor. Covered by `parking_staff`'s `{ userId: 1, status: 1 }` index.
   */
  private async activeParkingRoles(userId: unknown): Promise<string[]> {
    const grants = await this.parkingStaff
      .find({ userId, status: "active" })
      .select("parkingRole")
      .lean();
    return [
      ...new Set(grants.map((grant: any) => String(grant.parkingRole))),
    ];
  }

  async login(dto: LoginDto): Promise<Record<string, any>> {
    const identifier = dto.email.trim();
    const phoneDigits = identifier.replace(/\D/g, "");
    const localPhone = phoneDigits.replace(/^91(?=\d{10}$)/, "");
    const phoneCandidates = [
      identifier,
      localPhone,
      localPhone ? `+91${localPhone}` : "",
    ].filter(Boolean);
    const user = identifier.includes("@")
      ? await this.users.findByEmail(identifier.toLowerCase(), true)
      : await this.userModel
          .findOne({ phone: { $in: phoneCandidates } })
          .select("+passwordHash");
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException(
        "Invalid email, phone number, or password",
      );
    }
    if (user.status !== "active" || user.isDeleted || user.isSuspended) {
      throw new UnauthorizedException(
        `Your account is ${String(user.status).replace(/_/g, " ")}. Contact support.`,
      );
    }
    // Signing in is password-only. The email OTP belongs to registration,
    // where it proves the address is reachable before an account exists.
    // Parking grants are resolved because they ride on the session, not
    // because they gate anything here.
    const parkingRoles = await this.activeParkingRoles(user._id);
    const normalizedRole = canonicalAshramRole({
      role: user.role,
      name: user.name,
      permissions: user.permissions ?? [],
    });
    if (normalizedRole !== user.role) {
      user.role = normalizedRole;
      if (normalizedRole === ASHRAM_ADMIN_ROLE) {
        user.permissions = [
          ...new Set([...(user.permissions ?? []), "ashrams.manage_all"]),
        ];
      }
      user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    }
    user.lastLoginAt = new Date();
    await user.save();
    return this.session(user, parkingRoles);
  }

  async register(dto: RegisterDto): Promise<Record<string, any>> {
    if (await this.users.findByEmail(dto.email))
      throw new ConflictException("Email is already registered");
    if (await this.users.findByPhone(dto.phone))
      throw new ConflictException("Phone number is already registered");
    const role =
      dto.role === "owner" ? ASHRAM_OWNER_ROLE : dto.role ?? "customer";
    const email = dto.email.trim().toLowerCase();
    return {
      otpRequired: true,
      challenge: await this.createChallenge("register", email, {
        name: dto.name.trim(),
        email,
        phone: dto.phone,
        passwordHash: await bcrypt.hash(dto.password, 12),
        role,
        status: role === ASHRAM_OWNER_ROLE ? "pending_approval" : "active",
        isVerified: role !== ASHRAM_OWNER_ROLE,
        govtIdType: role === ASHRAM_OWNER_ROLE ? dto.govtIdType?.trim() : undefined,
        govtIdNumber: role === ASHRAM_OWNER_ROLE ? dto.govtIdNumber?.trim() : undefined,
        govtIdUrl: role === ASHRAM_OWNER_ROLE ? dto.govtIdUrl?.trim() : undefined,
      }),
    };
  }

  /**
   * `parkingRoles` is passed in by callers that have already resolved it, so a
   * login costs one lookup rather than two.
   */
  async session(
    user: UserDocument,
    parkingRoles?: string[],
  ): Promise<Record<string, unknown>> {
    const token = this.jwt.sign({
      id: user._id.toString(),
      sub: user._id.toString(),
      tv: user.tokenVersion ?? 0,
    });
    return {
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      permissions: user.permissions ?? [],
      // Grant-based roles the account holds. Empty for everyone else, so the
      // client can treat "has parking roles" as the whole test.
      parkingRoles: parkingRoles ?? (await this.activeParkingRoles(user._id)),
      token,
    };
  }

  async changeMyPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<any> {
    const user = await this.userModel.findById(userId).select("+passwordHash");
    if (!user?.passwordHash)
      throw new BadRequestException(
        "This account does not have a password. Use password recovery to create one.",
      );
    if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
      throw new UnauthorizedException("Current password is incorrect");
    if (await bcrypt.compare(newPassword, user.passwordHash))
      throw new BadRequestException(
        "New password must be different from the current password",
      );
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    await user.save();
    return user;
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
  private codeDigest(value: string): string {
    return createHmac(
      "sha256",
      this.config.get<string>("jwtSecret") || "development-only-secret",
    )
      .update(value)
      .digest("hex");
  }
  private safeEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async deliverCode(identifier: string, code: string): Promise<void> {
    const resendApiKey = this.config.get<string>("resendApiKey");
    const msg91AuthKey = this.config.get<string>("msg91AuthKey");
    if (identifier.includes("@") && resendApiKey)
      await new Resend(resendApiKey).emails.send({
        from: this.config.getOrThrow<string>("resendFromEmail"),
        replyTo: this.config.get<string>("resendReplyTo"),
        to: identifier,
        subject: "Your Tirvona verification code",
        html: `<p>Your Tirvona verification code is <strong>${code}</strong>. It expires in ${this.config.get<number>("otpExpiryMinutes") ?? 5} minutes.</p>`,
      });
    if (
      !identifier.includes("@") &&
      this.config.get<boolean>("otpSmsEnabled") &&
      msg91AuthKey
    )
      await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: msg91AuthKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          template_id: this.config.get<string>("msg91OtpTemplateId"),
          short_url: "0",
          recipients: [
            {
              mobiles: `${this.config.get<string>("msg91CountryCode") ?? "91"}${identifier.replace(/\D/g, "").replace(/^91/, "")}`,
              otp: code,
            },
          ],
        }),
      });
  }

  private async createChallenge(
    purpose: string,
    identifier: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const token = randomBytes(32).toString("hex");
    const otpLength = this.config.get<number>("otpLength") ?? 6;
    const code = randomInt(10 ** (otpLength - 1), 10 ** otpLength).toString();
    const expiryMinutes = this.config.get<number>("otpExpiryMinutes") ?? 5;
    const resendCooldownSeconds =
      this.config.get<number>("otpResendCooldownSeconds") ?? 30;
    await this.challenges.create({
      tokenHash: this.digest(token),
      codeHash: this.codeDigest(code),
      purpose,
      identifier,
      payload,
      maxAttempts: this.config.get<number>("otpMaxAttempts") ?? 5,
      expiresAt: new Date(Date.now() + expiryMinutes * 60_000),
      resendAvailableAt: new Date(Date.now() + resendCooldownSeconds * 1_000),
    });
    await this.deliverCode(identifier, code);
    return {
      ...(purpose === "google" ? { googleToken: token } : { otpToken: token }),
      channel: identifier.includes("@") ? "email" : "sms",
      expiresIn: expiryMinutes * 60,
      resendAfter: resendCooldownSeconds,
    };
  }

  private async challenge(
    token: string,
    otp?: string,
    requireVerified = false,
  ): Promise<any> {
    const row = await this.challenges
      .findOne({
        tokenHash: this.digest(token),
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .select("+codeHash +payload");
    if (!row)
      throw new UnauthorizedException("OTP challenge is invalid or expired");
    if (requireVerified) {
      if (!row.verifiedAt)
        throw new UnauthorizedException("Email verification is incomplete");
      return row;
    }
    if (row.attempts >= row.maxAttempts)
      throw new UnauthorizedException("Too many invalid OTP attempts");
    row.attempts += 1;
    if (!otp || !this.safeEqual(row.codeHash, this.codeDigest(otp))) {
      await row.save();
      throw new UnauthorizedException("Invalid OTP");
    }
    return row;
  }

  async verifyChallenge(
    token: string,
    otp: string,
    purpose: "login" | "register",
  ): Promise<Record<string, unknown>> {
    const row = await this.challenge(token, otp);
    if (row.purpose !== purpose)
      throw new UnauthorizedException("OTP challenge purpose is invalid");
    let user: any;
    if (purpose === "register") {
      if (await this.users.findByEmail(row.payload.email))
        throw new ConflictException("Email is already registered");
      user = await this.users.create({
        ...row.payload,
        status: row.payload.status ?? "active",
        isVerified: row.payload.isVerified ?? true,
      });
    } else {
      user = await this.users.findById(row.payload.userId);
      if (!user) throw new NotFoundException("User not found");
    }
    row.consumedAt = new Date();
    await row.save();
    user.lastLoginAt = new Date();
    await user.save();
    return this.session(user);
  }
  async sendPhoneOtp(phone: string): Promise<Record<string, unknown>> {
    if (!(await this.users.findByPhone(phone)))
      throw new NotFoundException("No account was found for this phone number");
    return this.createChallenge("phone_login", phone, {});
  }
  async verifyPhoneOtp(
    phone: string,
    otp: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.challenges
      .findOne({
        purpose: "phone_login",
        identifier: phone,
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .select("+codeHash +payload");
    if (!row || !this.safeEqual(row.codeHash, this.codeDigest(otp)))
      throw new UnauthorizedException("Invalid OTP");
    const user = await this.users.findByPhone(phone);
    if (!user) throw new NotFoundException("User not found");
    row.consumedAt = new Date();
    await row.save();
    user.lastLoginAt = new Date();
    await user.save();
    return this.session(user);
  }
  async resend(token: string): Promise<Record<string, unknown>> {
    const old = await this.challenges
      .findOne({
        tokenHash: this.digest(token),
        consumedAt: null,
        expiresAt: { $gt: new Date() },
      })
      .select("+payload");
    if (!old)
      throw new UnauthorizedException("OTP challenge is invalid or expired");
    if (old.resendAvailableAt > new Date())
      throw new BadRequestException(
        "Please wait before requesting another OTP",
      );
    old.consumedAt = new Date();
    await old.save();
    return this.createChallenge(old.purpose, old.identifier, old.payload ?? {});
  }

  /**
   * The site origin the emailed reset link points at.
   *
   * `FRONTEND_URL`/`CLIENT_URL` are documented as comma-separated (they double
   * as a CORS-style list), and operators do set more than one — so the raw
   * value is not a URL. The first entry is the canonical site; a trailing
   * slash is dropped so the link never comes out with `//reset-password`.
   */
  private siteOrigin(): string {
    return (this.config.get<string>("frontendUrl") ?? "")
      .split(",")[0]
      .trim()
      .replace(/\/+$/, "");
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    const token = randomBytes(32).toString("hex");
    user.resetTokenHash = this.digest(token);
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60_000);
    await user.save();
    const resendApiKey = this.config.get<string>("resendApiKey");
    if (!resendApiKey) {
      // The endpoint answers "if that account exists, a link has been sent"
      // either way, so an unconfigured mailer is otherwise silent — and looks
      // exactly like a working one that nobody received. Say so in the log.
      process.stderr.write(
        "Password reset requested but RESEND_API_KEY is not configured — no email was sent.\n",
      );
      return;
    }
    // `?token=` and not `/reset-password/<token>`: the SPA has one route,
    // `/reset-password`, and the page reads the token from the query string.
    // A path segment matched no route at all, so every emailed link landed on
    // the 404 page — which is what made password reset unusable.
    const resetUrl = `${this.siteOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
    await new Resend(resendApiKey).emails.send({
      from: this.config.getOrThrow<string>("resendFromEmail"),
      replyTo: this.config.get<string>("resendReplyTo"),
      to: user.email,
      subject: "Reset your Tirvona password",
      // Some clients strip the anchor, so the raw URL is repeated as text.
      html: `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;color:#0B192C;line-height:1.6">
  <p>Namaste${user.name ? ` ${user.name}` : ""},</p>
  <p>We received a request to reset your Tirvona password. Click the button below to choose a new one. This link expires in 30 minutes and can be used once.</p>
  <p style="margin:28px 0">
    <a href="${resetUrl}" style="background:#0A4DA6;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:700;display:inline-block">Reset my password</a>
  </p>
  <p style="font-size:13px;color:#5b6b7f">If the button does not work, copy this link into your browser:<br><a href="${resetUrl}" style="color:#0A4DA6;word-break:break-all">${resetUrl}</a></p>
  <p style="font-size:13px;color:#5b6b7f">If you did not request this, you can safely ignore this email — your password stays unchanged.</p>
</div>`,
      text: `Namaste${user.name ? ` ${user.name}` : ""},

We received a request to reset your Tirvona password. Open this link within 30 minutes to choose a new one:

${resetUrl}

If you did not request this, you can safely ignore this email — your password stays unchanged.`,
    });
  }
  async resetUser(token: string, password?: string): Promise<any> {
    const user = await this.userModel
      .findOne({
        resetTokenHash: this.digest(token),
        resetTokenExpiresAt: { $gt: new Date() },
      })
      .select("+resetTokenHash +resetTokenExpiresAt +passwordHash");
    if (!user)
      throw new UnauthorizedException("Reset token is invalid or expired");
    if (!password) return user;
    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    await user.save();
    return user;
  }

  async google(credential: string): Promise<Record<string, any>> {
    const googleClientId = this.config.get<string>("googleClientId");
    if (!googleClientId)
      throw new BadRequestException("Google authentication is not configured");
    const ticket = await new OAuth2Client(googleClientId).verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified)
      throw new UnauthorizedException("Google email is not verified");
    const user = await this.users.findByEmail(payload.email);
    if (user) {
      if (user.status !== "active" || user.isDeleted || user.isSuspended)
        throw new UnauthorizedException(
          `Your account is ${String(user.status).replace(/_/g, " ")}. Contact support.`,
        );
      user.lastLoginAt = new Date();
      await user.save();
      return { session: await this.session(user) };
    }
    return {
      otpRequired: true,
      challenge: await this.createChallenge("google", payload.email, {
        email: payload.email,
        suggestedName: payload.name ?? "",
        googleId: payload.sub,
      }),
    };
  }
  async verifyGoogle(
    token: string,
    otp: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.challenge(token, otp);
    if (row.purpose !== "google")
      throw new UnauthorizedException("Google challenge is invalid");
    row.verifiedAt = new Date();
    await row.save();
    return {
      googleToken: token,
      suggestedName: row.payload.suggestedName,
      email: row.payload.email,
    };
  }
  async completeGoogle(
    token: string,
    name: string,
    phone: string,
  ): Promise<Record<string, unknown>> {
    const row = await this.challenge(token, undefined, true);
    if (row.purpose !== "google")
      throw new UnauthorizedException("Google challenge is invalid");
    if (await this.users.findByPhone(phone))
      throw new ConflictException("Phone number is already registered");
    const user = await this.users.create({
      name,
      email: row.payload.email,
      phone,
      googleId: row.payload.googleId,
      authProvider: "google",
      role: "customer",
      status: "active",
      isVerified: true,
    });
    row.consumedAt = new Date();
    await row.save();
    return this.session(user);
  }
  private master(user: { role: string; email: string }): void {
    if (user.role !== "super_admin")
      throw new UnauthorizedException(
        "Access denied: Only the Master Platform Owner can manage global staff.",
      );
  }
  async ownerStaff(actor: { role: string; email: string }): Promise<any[]> {
    this.master(actor);
    return this.userModel
      .find({
        role: { $in: ["ashram_owner", "owner", "manager", "reception", "housekeeping"] },
        isDeleted: { $ne: true },
      })
      .select("name email phone role status createdAt")
      .sort({ createdAt: -1 })
      .lean();
  }
  async createStaff(
    actor: { role: string; email: string },
    dto: {
      name: string;
      email: string;
      phone: string;
      password: string;
      role: string;
    },
  ): Promise<any> {
    this.master(actor);
    if (await this.users.findByEmail(dto.email))
      throw new ConflictException("A user with this email already exists.");
    if (await this.users.findByPhone(dto.phone))
      throw new ConflictException(
        "A user with this phone number already exists.",
      );
    const user = await this.users.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: dto.role === "owner" ? ASHRAM_OWNER_ROLE : dto.role,
      status: "active",
      isVerified: true,
    } as Partial<UserDocument>);
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }
  async staffPassword(
    actor: { role: string; email: string },
    id: string,
    password: string,
  ): Promise<any> {
    this.master(actor);
    const user = await this.userModel.findById(id).select("+passwordHash");
    if (!user) throw new NotFoundException("Staff user not found");
    if (!["ashram_owner", "owner", "manager", "reception", "housekeeping"].includes(user.role))
      throw new ForbiddenException(
        "You can only reset passwords for staff and owner accounts.",
      );
    user.passwordHash = await bcrypt.hash(password, 12);
    user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    return user.save();
  }
  async staffStatus(
    actor: { role: string; email: string },
    id: string,
    status: string,
  ): Promise<any> {
    this.master(actor);
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException("Staff user not found");
    if (!["ashram_owner", "owner", "manager", "reception", "housekeeping"].includes(user.role))
      throw new ForbiddenException(
        "You can only change status for staff and owner accounts.",
      );
    user.status = status;
    if (status === "suspended")
      user.tokenVersion = Number(user.tokenVersion ?? 0) + 1;
    await user.save();
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }
}
