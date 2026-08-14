import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import {
  USER_REPOSITORY,
  UserRepository,
} from "../../users/domain/user.repository";

interface JwtPayload {
  id?: string;
  sub?: string;
  tv?: number;
  purpose?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwtSecret") || "development-only-secret",
      issuer: config.get<string>("jwtIssuer"),
      audience: config.get<string>("jwtAudience"),
    });
  }

  async validate(payload: JwtPayload): Promise<Record<string, unknown>> {
    if (payload.purpose)
      throw new UnauthorizedException("OTP verification is not complete");
    const user = await this.users.findById(payload.sub ?? payload.id ?? "");
    if (!user || user.isDeleted)
      throw new UnauthorizedException("User not found");
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0))
      throw new UnauthorizedException("Session expired. Please log in again.");
    if (user.status !== "active" || user.isSuspended)
      throw new UnauthorizedException(
        "Your account is not active. Contact support.",
      );
    return {
      _id: user._id.toString(),
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      permissions: user.permissions ?? [],
      scopedAshramIds: (user.scopedAshramIds ?? []).map(String),
      employerAshramId: user.employerAshramId?.toString(),
      district: user.district,
      state: user.state,
      tokenVersion: user.tokenVersion,
    };
  }
}
