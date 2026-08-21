import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthenticatedUser } from "../../../../common/decorators/current-user.decorator";
import {
  AartiAccessService,
  type AartiAccess,
} from "../../application/aarti-access.service";
import { AARTI_CAPABILITIES_KEY } from "../decorators/aarti-capabilities.decorator";

export type AartiRequest = Request & {
  user: AuthenticatedUser;
  aarti: AartiAccess;
};

@Injectable()
export class AartiCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: AartiAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(AARTI_CAPABILITIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<AartiRequest>();
    request.aarti = await this.accessService.resolve(request.user);
    const missing = required.filter(
      (capability) => !request.aarti.capabilities.includes(capability),
    );
    if (missing.length)
      throw new ForbiddenException(
        "You do not have permission to perform this aarti action.",
      );
    return true;
  }
}
