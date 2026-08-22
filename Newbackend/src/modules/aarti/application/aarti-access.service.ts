import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  AARTI_ASHRAM_ADMIN_CAPABILITIES,
  AARTI_ASHRAM_OWNER_CAPABILITIES,
  AARTI_CAPABILITIES,
  AARTI_MODEL,
  AARTI_STAFF_ROLE_CAPABILITIES,
} from "../domain/aarti.constants";
import {
  ASHRAM_ADMIN_ROLE,
  ASHRAM_OWNER_ROLE,
  canManageAllAshrams,
  canonicalAshramRole,
} from "../../../common/auth/ashram-access";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

export interface AartiAccess {
  isPlatformAdmin: boolean;
  isAshramAdmin: boolean;
  scopeAllAshrams: boolean;
  roles: string[];
  capabilities: string[];
  ashramIds: string[];
  sessionIds: string[];
  staffIds: string[];
}

@Injectable()
export class AartiAccessService {
  constructor(
    @InjectModel(AARTI_MODEL.Staff) private readonly staff: Model<any>,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.AshramRef) private readonly ashrams: Model<any>,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<AartiAccess> {
    if (user?.role === "super_admin") {
      return {
        isPlatformAdmin: true,
        isAshramAdmin: true,
        scopeAllAshrams: true,
        roles: ["super_admin"],
        capabilities: Object.values(AARTI_CAPABILITIES),
        ashramIds: [],
        sessionIds: [],
        staffIds: [],
      };
    }

    const capabilities = new Set<string>();
    const ashramIds = new Set<string>();
    const sessionIds = new Set<string>();
    const roles: string[] = [];

    const canonical = canonicalAshramRole(user);
    const platformStayAdmin = canManageAllAshrams(user);

    if (platformStayAdmin || canonical === ASHRAM_ADMIN_ROLE) {
      roles.push(ASHRAM_ADMIN_ROLE);
      AARTI_ASHRAM_ADMIN_CAPABILITIES.forEach((capability) =>
        capabilities.add(capability),
      );
    } else if (canonical === ASHRAM_OWNER_ROLE) {
      roles.push(ASHRAM_OWNER_ROLE);
      AARTI_ASHRAM_OWNER_CAPABILITIES.forEach((capability) =>
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
      roles.push(String(grant.aartiRole));
      ashramIds.add(String(grant.ashramId));
      const roleCapabilities =
        AARTI_STAFF_ROLE_CAPABILITIES[String(grant.aartiRole)] ?? [];
      const effective = grant.capabilityOverrides?.length
        ? roleCapabilities.filter((capability: string) =>
            grant.capabilityOverrides.includes(capability),
          )
        : roleCapabilities;
      effective.forEach((capability: string) => capabilities.add(capability));
      (grant.sessionIds ?? []).forEach((value: unknown) =>
        sessionIds.add(String(value)),
      );
    }

    const scopeAllAshrams = platformStayAdmin || canonical === ASHRAM_ADMIN_ROLE;
    if (!scopeAllAshrams && ashramIds.size && !sessionIds.size) {
      const owned = await this.sessions
        .find({ ashramId: { $in: [...ashramIds] } })
        .select("_id")
        .lean();
      owned.forEach((row) => sessionIds.add(String(row._id)));
    }

    return {
      isPlatformAdmin: false,
      isAshramAdmin: scopeAllAshrams,
      scopeAllAshrams,
      roles: [...new Set(roles)],
      capabilities: [...capabilities],
      ashramIds: [...ashramIds],
      sessionIds: [...sessionIds],
      staffIds: grants.map((grant) => String(grant._id)),
    };
  }

  assertAshram(access: AartiAccess, ashramId: string): void {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return;
    if (!access.ashramIds.includes(String(ashramId)))
      throw new ForbiddenException(
        "You do not manage aarti for this ashram.",
      );
  }

  assertSession(access: AartiAccess, session: any): void {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return;
    const sessionId = String(session?._id ?? session);
    if (access.sessionIds.includes(sessionId)) return;
    if (session?.ashramId && access.ashramIds.includes(String(session.ashramId)))
      return;
    throw new ForbiddenException("You do not manage this aarti.");
  }

  /**
   * The owner/admin scope filter every management query is narrowed by. An
   * ashram admin sees every ashram, an ashram owner only theirs — returning
   * `{}` for the former is what keeps one query shape working for both.
   */
  scopeFilter(access: AartiAccess, field = "ashramId"): Record<string, unknown> {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return {};
    return { [field]: { $in: access.ashramIds } };
  }
}
