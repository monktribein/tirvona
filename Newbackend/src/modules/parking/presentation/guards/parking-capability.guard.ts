import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "../../../../common/decorators/current-user.decorator";
import type { Request } from "express";
import {
  ParkingAccessService,
  ParkingAccess,
} from "../../application/parking-access.service";
import { PARKING_CAPABILITIES_KEY } from "../decorators/parking-capabilities.decorator";

export type ParkingRequest = Request & {
  user: AuthenticatedUser;
  parking: ParkingAccess;
};

@Injectable()
export class ParkingCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: ParkingAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(PARKING_CAPABILITIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const request = context.switchToHttp().getRequest<ParkingRequest>();
    request.parking = await this.accessService.resolve(request.user);
    const missing = required.filter(
      (capability) => !request.parking.capabilities.includes(capability),
    );
    if (missing.length)
      throw new ForbiddenException(
        "You do not have permission to perform this parking action.",
      );
    return true;
  }
}
