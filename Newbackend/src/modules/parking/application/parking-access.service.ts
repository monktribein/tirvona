import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  PARKING_CAPABILITIES,
  PARKING_MODEL,
  PARKING_ROLE_CAPABILITIES,
} from "../domain/parking.constants";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

export interface ParkingAccess {
  isPlatformAdmin: boolean;
  roles: string[];
  capabilities: string[];
  partnerIds: string[];
  locationIds: string[];
  staffIds: string[];
}

@Injectable()
export class ParkingAccessService {
  constructor(
    @InjectModel(PARKING_MODEL.Staff) private readonly staff: Model<any>,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
  ) {}

  async resolve(user: AuthenticatedUser): Promise<ParkingAccess> {
    if (user.role === "super_admin") {
      return {
        isPlatformAdmin: true,
        roles: [],
        capabilities: Object.values(PARKING_CAPABILITIES),
        partnerIds: [],
        locationIds: [],
        staffIds: [],
      };
    }
    const grants = await this.staff
      .find({ userId: user.id, status: "active" })
      .lean();
    const roles = grants.map((grant) => String(grant.parkingRole));
    const partnerIds = [
      ...new Set(grants.map((grant) => String(grant.partnerId))),
    ];
    const capabilities = new Set<string>();
    const locationIds = new Set<string>();
    let partnerWide = false;
    for (const grant of grants) {
      const roleCapabilities =
        PARKING_ROLE_CAPABILITIES[String(grant.parkingRole)] ?? [];
      const effective = grant.capabilityOverrides?.length
        ? roleCapabilities.filter((capability) =>
            grant.capabilityOverrides.includes(capability),
          )
        : roleCapabilities;
      effective.forEach((capability) => capabilities.add(capability));
      if (grant.locationIds?.length)
        grant.locationIds.forEach((id: unknown) => locationIds.add(String(id)));
      else partnerWide = true;
    }
    if (partnerWide && partnerIds.length) {
      const owned = await this.locations
        .find({ partnerId: { $in: partnerIds } })
        .select("_id")
        .lean();
      owned.forEach((location) => locationIds.add(String(location._id)));
    }
    return {
      isPlatformAdmin: false,
      roles,
      partnerIds,
      capabilities: [...capabilities],
      locationIds: [...locationIds],
      staffIds: grants.map((grant) => String(grant._id)),
    };
  }

  assertLocation(access: ParkingAccess, locationId: string): void {
    if (
      !access.isPlatformAdmin &&
      !access.locationIds.includes(String(locationId))
    ) {
      throw new ForbiddenException(
        "You are not assigned to this parking location.",
      );
    }
  }
}
