import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { compare, hash } from "bcryptjs";
import type { Model } from "mongoose";
import { leadCollectionConfig } from "../config/lead-collection.config";
import {
  LEAD_CONNECTION,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import type {
  AuthenticatedLeadUser,
  LeadTokenPayload,
  LeadUserDocument,
  LeadUserRecord,
} from "../domain/lead-collection.types";
import type { LeadLoginDto } from "../presentation/dtos/lead-auth.dto";
import { LeadUsersService } from "./lead-users.service";

export interface LeadLoginResult {
  token: string;
  expiresIn: string;
  user: AuthenticatedLeadUser;
}

@Injectable()
export class LeadAuthService {
  private readonly config = leadCollectionConfig();

  constructor(
    @InjectModel(LEAD_USER_MODEL, LEAD_CONNECTION)
    private readonly leadUsers: Model<LeadUserDocument>,
    private readonly jwt: JwtService,
  ) {}

  private toAuthenticated(user: LeadUserRecord): AuthenticatedLeadUser {
    return {
      id: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email ?? "",
      role: user.role,
      status: user.status,
      region: user.region ?? "",
      state: (user as any).state ?? "",
      district: (user as any).district ?? "",
    };
  }

  async login(dto: LeadLoginDto): Promise<LeadLoginResult> {
    const phone = LeadUsersService.normalisePhone(dto.phone);
    if (phone.length !== 10)
      throw new UnauthorizedException("Enter a valid 10-digit mobile number");

    const user = await this.leadUsers
      .findOne({ phone })
      .select("+passwordHash")
      .lean<LeadUserRecord>();

    const invalid = new UnauthorizedException("Invalid phone or password");
    if (!user) {
      await hash(dto.password, this.config.bcryptRounds);
      throw invalid;
    } else {
      if (!user.passwordHash) throw invalid;
      if (!(await compare(dto.password, user.passwordHash))) throw invalid;
    }

    if (!user.createdByAdminId?.trim()) throw invalid;
    if (!user.state?.trim() || !user.district?.trim())
      throw new UnauthorizedException(
        "No state and district are assigned to this account. Contact your supervisor.",
      );

    if (user.status !== "active")
      throw new UnauthorizedException(
        "This field agent account is suspended. Contact your supervisor.",
      );

    await this.leadUsers.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const payload: LeadTokenPayload = {
      sub: user._id.toString(),
      scope: "lead",
      role: user.role,
      tv: user.tokenVersion ?? 0,
    };

    return {
      token: this.jwt.sign(payload, {
        secret: this.config.jwtSecret,
        expiresIn: this.config.jwtExpiresIn as never,
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
      }),
      expiresIn: this.config.jwtExpiresIn,
      user: this.toAuthenticated(user),
    };
  }

  async resolveFromToken(token: string): Promise<AuthenticatedLeadUser> {
    let payload: LeadTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<LeadTokenPayload>(token, {
        secret: this.config.jwtSecret,
        issuer: this.config.jwtIssuer,
        audience: this.config.jwtAudience,
      });
    } catch {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }
    if (payload.scope !== "lead")
      throw new UnauthorizedException("This token is not valid for lead access");

    const user = await this.leadUsers
      .findById(payload.sub)
      .lean<LeadUserRecord>();
    if (!user) throw new UnauthorizedException("Field agent account not found");
    if (!user.createdByAdminId?.trim())
      throw new UnauthorizedException("Field agent account is not authorised");
    if (!user.state?.trim() || !user.district?.trim())
      throw new UnauthorizedException("Field agent jurisdiction is not assigned");
    if (user.status !== "active")
      throw new UnauthorizedException("This field agent account is suspended");
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0))
      throw new UnauthorizedException("Session expired. Please sign in again.");

    return this.toAuthenticated(user);
  }
}
