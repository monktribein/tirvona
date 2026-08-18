import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { LeadRequest } from "./lead-agent.guard";

/**
 * Restricts a route to `field_supervisor` accounts.
 *
 * Must be stacked **after** `LeadAgentGuard`, which authenticates the token
 * and attaches `req.leadUser`. This guard only inspects the role — if
 * `leadUser` is missing it means `LeadAgentGuard` was not applied, and the
 * request is rejected with a clear message rather than a cryptic null access.
 */
@Injectable()
export class LeadSupervisorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<LeadRequest>();
    const user = request.leadUser;

    if (!user)
      throw new ForbiddenException(
        "Authentication required before supervisor authorisation",
      );

    if (user.role !== "field_supervisor")
      throw new ForbiddenException(
        "This action is restricted to field supervisors",
      );

    return true;
  }
}
