import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  EVENT_ASHRAM_ADMIN_CAPABILITIES,
  EVENT_ASHRAM_OWNER_CAPABILITIES,
  EVENT_CAPABILITIES,
  EVENT_MODEL,
  EVENT_STAFF_ROLE_CAPABILITIES,
} from "../domain/event.constants";
import {
  ASHRAM_ADMIN_ROLE,
  ASHRAM_OWNER_ROLE,
  canManageAllAshrams,
  canonicalAshramRole,
} from "../../../common/auth/ashram-access";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

export interface EventAccess {
  isPlatformAdmin: boolean;
  scopeAllAshrams: boolean;
  roles: string[];
  capabilities: string[];
  ashramIds: string[];
  eventIds: string[];
  staffIds: string[];
}

@Injectable()
export class EventAccessService {
  constructor(
    @InjectModel(EVENT_MODEL.Staff) private readonly staff: Model<any>,
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
    @InjectModel(EVENT_MODEL.AshramRef) private readonly ashrams: Model<any>,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<EventAccess> {
    if (user?.role === "super_admin") {
      return {
        isPlatformAdmin: true,
        scopeAllAshrams: true,
        roles: ["super_admin"],
        capabilities: Object.values(EVENT_CAPABILITIES),
        ashramIds: [],
        eventIds: [],
        staffIds: [],
      };
    }

    const capabilities = new Set<string>();
    const ashramIds = new Set<string>();
    const eventIds = new Set<string>();
    const roles: string[] = [];

    const canonical = canonicalAshramRole(user);
    const platformStayAdmin = canManageAllAshrams(user);

    if (platformStayAdmin || canonical === ASHRAM_ADMIN_ROLE) {
      roles.push(ASHRAM_ADMIN_ROLE);
      EVENT_ASHRAM_ADMIN_CAPABILITIES.forEach((capability) =>
        capabilities.add(capability),
      );
    } else if (canonical === ASHRAM_OWNER_ROLE) {
      roles.push(ASHRAM_OWNER_ROLE);
      EVENT_ASHRAM_OWNER_CAPABILITIES.forEach((capability) =>
        capabilities.add(capability),
      );
      const owned = await this.ashrams
        .find({ ownerId: user.id })
        .select("_id")
        .lean();
      owned.forEach((ashram) => ashramIds.add(String(ashram._id)));
    }

    if (user?.employerAshramId) ashramIds.add(String(user.employerAshramId));
    (user?.scopedAshramIds ?? []).forEach((value) =>
      ashramIds.add(String(value)),
    );

    const grants = await this.staff
      .find({ userId: user?.id, status: "active" })
      .lean();
    for (const grant of grants) {
      roles.push(String(grant.eventRole));
      ashramIds.add(String(grant.ashramId));
      const roleCapabilities =
        EVENT_STAFF_ROLE_CAPABILITIES[String(grant.eventRole)] ?? [];
      const effective = grant.capabilityOverrides?.length
        ? roleCapabilities.filter((capability: string) =>
            grant.capabilityOverrides.includes(capability),
          )
        : roleCapabilities;
      effective.forEach((capability: string) => capabilities.add(capability));
      (grant.eventIds ?? []).forEach((value: unknown) =>
        eventIds.add(String(value)),
      );
    }

    const scopeAllAshrams = platformStayAdmin || canonical === ASHRAM_ADMIN_ROLE;
    if (!scopeAllAshrams && ashramIds.size && !eventIds.size) {
      const owned = await this.events
        .find({ ashramId: { $in: [...ashramIds] } })
        .select("_id")
        .lean();
      owned.forEach((row) => eventIds.add(String(row._id)));
    }

    return {
      isPlatformAdmin: false,
      scopeAllAshrams,
      roles: [...new Set(roles)],
      capabilities: [...capabilities],
      ashramIds: [...ashramIds],
      eventIds: [...eventIds],
      staffIds: grants.map((grant) => String(grant._id)),
    };
  }

  assertAshram(access: EventAccess, ashramId: string): void {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return;
    if (!access.ashramIds.includes(String(ashramId)))
      throw new ForbiddenException("You do not manage events for this ashram.");
  }

  assertEvent(access: EventAccess, event: any): void {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return;
    if (access.eventIds.includes(String(event?._id ?? event))) return;
    if (event?.ashramId && access.ashramIds.includes(String(event.ashramId)))
      return;
    throw new ForbiddenException("You do not manage this event.");
  }

  /** `{}` for platform-wide roles is what lets one query serve both scopes. */
  scopeFilter(access: EventAccess, field = "ashramId"): Record<string, unknown> {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return {};
    return { [field]: { $in: access.ashramIds } };
  }
}
