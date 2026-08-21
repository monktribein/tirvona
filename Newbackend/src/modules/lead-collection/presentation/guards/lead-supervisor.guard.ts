import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { LeadRequest } from "./lead-agent.guard";

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
