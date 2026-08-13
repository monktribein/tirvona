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
    // `@Public()` wins over a class-level gate. A route declared public is
    // reached without a session, so there is no user to hold a role or a
    // permission — evaluating the inherited requirement would reject every
    // anonymous caller and make the decorator a no-op on any guarded
    // controller. The route still opts in explicitly; nothing becomes public
    // by omission.
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
    // The platform Ashram Admin may operate every accommodation endpoint that
    // an individual owner can, while an owner never inherits global access.
    if (
      actual === ASHRAM_ADMIN_ROLE &&
      canonicalAllowed.includes(ASHRAM_OWNER_ROLE)
    )
      return true;
    return canonicalAllowed.includes(actual);
  }
}
