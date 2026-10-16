import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PARTNER_PERMISSIONS_KEY } from "../decorators/partner-permissions.decorator";
import type { PartnerPermission } from "../domain/partner.constants";
import type { AuthenticatedPartnerContext } from "../decorators/current-partner.decorator";

@Injectable()
export class PartnerPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PartnerPermission[]>(
      PARTNER_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const partner: AuthenticatedPartnerContext | undefined = context
      .switchToHttp()
      .getRequest().partner;

    if (!partner) {
      throw new ForbiddenException("No authenticated partner found");
    }

    const hasAll = required.every((perm) => partner.permissions.includes(perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Missing required partner permission(s): ${required.join(", ")}`,
      );
    }

    return true;
  }
}
