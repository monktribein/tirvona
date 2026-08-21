import { Injectable, type NestMiddleware } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { NextFunction, Request, Response } from "express";
import { leadCollectionConfig } from "../config/lead-collection.config";
import type { LeadTokenPayload } from "../domain/lead-collection.types";

interface LeadRateLimitRequest extends Request {
  rateLimitLeadUserId?: string;
}

@Injectable()
export class LeadRateLimitIdentityMiddleware implements NestMiddleware {
  private readonly config = leadCollectionConfig();

  constructor(private readonly jwt: JwtService) {}

  async use(
    request: LeadRateLimitRequest,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    const [scheme, token] = (request.headers.authorization ?? "").split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) {
      try {
        const payload = await this.jwt.verifyAsync<LeadTokenPayload>(token, {
          secret: this.config.jwtSecret,
          issuer: this.config.jwtIssuer,
          audience: this.config.jwtAudience,
        });
        if (payload.scope === "lead" && payload.sub)
          request.rateLimitLeadUserId = payload.sub;
      } catch {
        void 0;
      }
    }
    next();
  }
}
