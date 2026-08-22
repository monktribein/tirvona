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
  EventAccessService,
  type EventAccess,
} from "../../application/event-access.service";
import { EVENT_CAPABILITIES_KEY } from "../decorators/event-capabilities.decorator";

export type EventRequest = Request & {
  user: AuthenticatedUser;
  events: EventAccess;
};

@Injectable()
export class EventCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: EventAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(EVENT_CAPABILITIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<EventRequest>();
    request.events = await this.accessService.resolve(request.user);
    const missing = required.filter(
      (capability) => !request.events.capabilities.includes(capability),
    );
    if (missing.length)
      throw new ForbiddenException(
        "You do not have permission to perform this event action.",
      );
    return true;
  }
}
