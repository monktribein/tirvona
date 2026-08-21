import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  PILGRIMAGE_ASHRAM_ADMIN_CAPABILITIES,
  PILGRIMAGE_ASHRAM_OWNER_CAPABILITIES,
  PILGRIMAGE_CAPABILITIES,
  PILGRIMAGE_MODEL,
} from "../domain/pilgrimage.constants";
import {
  ASHRAM_ADMIN_ROLE,
  ASHRAM_OWNER_ROLE,
  canManageAllAshrams,
  canonicalAshramRole,
} from "../../../common/auth/ashram-access";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

export interface PilgrimageAccess {
  isPlatformAdmin: boolean;
  scopeAllAshrams: boolean;
  roles: string[];
  capabilities: string[];
  ashramIds: string[];
}

@Injectable()
export class PilgrimageAccessService {
  constructor(
    @InjectModel(PILGRIMAGE_MODEL.AshramRef)
    private readonly ashrams: Model<any>,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<PilgrimageAccess> {
    if (user?.role === "super_admin") {
      return {
        isPlatformAdmin: true,
        scopeAllAshrams: true,
        roles: ["super_admin"],
        capabilities: Object.values(PILGRIMAGE_CAPABILITIES),
        ashramIds: [],
      };
    }

    const capabilities = new Set<string>();
    const ashramIds = new Set<string>();
    const roles: string[] = [];

    const canonical = canonicalAshramRole(user);
    const platformStayAdmin = canManageAllAshrams(user);

    if (platformStayAdmin || canonical === ASHRAM_ADMIN_ROLE) {
      roles.push(ASHRAM_ADMIN_ROLE);
      PILGRIMAGE_ASHRAM_ADMIN_CAPABILITIES.forEach((capability) =>
        capabilities.add(capability),
      );
    } else if (canonical === ASHRAM_OWNER_ROLE) {
      roles.push(ASHRAM_OWNER_ROLE);
      PILGRIMAGE_ASHRAM_OWNER_CAPABILITIES.forEach((capability) =>
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

    return {
      isPlatformAdmin: false,
      scopeAllAshrams: platformStayAdmin || canonical === ASHRAM_ADMIN_ROLE,
      roles: [...new Set(roles)],
      capabilities: [...capabilities],
      ashramIds: [...ashramIds],
    };
  }

  assertAshram(access: PilgrimageAccess, ashramId: string): void {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return;
    if (!access.ashramIds.includes(String(ashramId)))
      throw new ForbiddenException(
        "You do not manage pilgrimage circuits for this ashram.",
      );
  }

  assertCircuit(access: PilgrimageAccess, circuit: any): void {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return;
    if (circuit?.ashramId && access.ashramIds.includes(String(circuit.ashramId)))
      return;
    throw new ForbiddenException("You do not manage this circuit.");
  }

  scopeFilter(
    access: PilgrimageAccess,
    field = "ashramId",
  ): Record<string, unknown> {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return {};
    return { [field]: { $in: access.ashramIds } };
  }
}
