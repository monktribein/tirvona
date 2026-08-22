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
