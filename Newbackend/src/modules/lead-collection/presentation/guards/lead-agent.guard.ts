import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { LeadAuthService } from "../../application/lead-auth.service";
import type { AuthenticatedLeadUser } from "../../domain/lead-collection.types";

export interface LeadRequest extends Request {
  leadUser?: AuthenticatedLeadUser;
}

/**
 * Authenticates a field agent for the lead-app routes.
 *
 * Agent routes are marked `@Public()` so the platform's global `JwtAuthGuard`
 * steps aside — a field agent has no row in the platform `users` collection
 * and would fail it — and this guard then applies the lead product's own
 * check. Public to the platform, never public in fact.
 *
 * The agent is attached as `req.leadUser`, deliberately not `req.user`, so no
 * platform guard or interceptor downstream can mistake one for the other.
 */
@Injectable()
export class LeadAgentGuard implements CanActivate {
  constructor(private readonly auth: LeadAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<LeadRequest>();
    const header = request.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme?.toLowerCase() !== "bearer" || !token)
      throw new UnauthorizedException("Field agent sign-in required");

    request.leadUser = await this.auth.resolveFromToken(token);
    return true;
  }
}
