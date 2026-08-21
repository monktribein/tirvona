import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import {
  ASHRAM_ADMIN_ROLE,
  ASHRAM_OWNER_ROLE,
  canonicalAshramRole,
} from "../auth/ashram-access";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;

    const allowed = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed?.length) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return false;
    if (user.role === "super_admin") return true;
    const actual = canonicalAshramRole(user);
    const canonicalAllowed = allowed.map((role) => {
      if (role === "owner") return ASHRAM_OWNER_ROLE;
      if (role === "stay_admin") return ASHRAM_ADMIN_ROLE;
      return role;
    });
    if (
      actual === ASHRAM_ADMIN_ROLE &&
      canonicalAllowed.includes(ASHRAM_OWNER_ROLE)
    )
      return true;
    return canonicalAllowed.includes(actual);
  }
}
