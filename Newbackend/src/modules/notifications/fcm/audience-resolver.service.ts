import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import {
  isUnrestricted,
  narrowRequestedAshrams,
  resolveAshramScope,
} from "../../../common/auth/ashram-scope";

export interface AudienceParams {
  audienceType: "all" | "users" | "role" | "ashram";
  targetRoles?: string[];
  targetUserIds?: string[];
  ashramIds?: string[];
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resolves who a campaign may reach, scoped to what the sender is allowed
 * to touch: a platform admin can target any role or user, while an ashram
 * owner/admin may only reach customers who have booked at an ashram they
 * manage (see [[ashram-scope.ts]] for how that scope is computed). */
@Injectable()
export class AudienceResolverService {
  constructor(
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
  ) {}

  async resolve(actor: AuthenticatedUser, params: AudienceParams): Promise<string[]> {
    if (params.audienceType === "all") {
      if (!canManageAllAshrams(actor))
        throw new ForbiddenException("Only a platform admin can broadcast to everyone.");
      const rows = await this.users.find({ isDeleted: false }).select("_id").lean();
      return rows.map((row: any) => String(row._id));
    }

    if (params.audienceType === "role") {
      if (!canManageAllAshrams(actor))
        throw new ForbiddenException("Only a platform admin can target users by role.");
      const roles = params.targetRoles ?? [];
      if (!roles.length) return [];
      const rows = await this.users
        .find({ role: { $in: roles }, isDeleted: false })
        .select("_id")
        .lean();
      return rows.map((row: any) => String(row._id));
    }

    if (params.audienceType === "ashram") {
      const scope = await resolveAshramScope(actor, this.ashrams);
      const narrowed = narrowRequestedAshrams(scope, params.ashramIds);
      if (narrowed !== null && narrowed.length === 0) return [];
      const filter = narrowed === null ? {} : { ashramId: { $in: narrowed } };
      const customerIds = await this.bookings.distinct("customerId", filter);
      return customerIds.map((value: unknown) => String(value));
    }

    // audienceType === "users": an explicit list of selected customers.
    const requested = [...new Set((params.targetUserIds ?? []).map(String))];
    if (!requested.length) return [];
    if (canManageAllAshrams(actor)) return requested;

    const scope = await resolveAshramScope(actor, this.ashrams);
    if (isUnrestricted(scope)) return requested;
    if (!scope.length) return [];
    const bookedCustomerIds = await this.bookings.distinct("customerId", {
      ashramId: { $in: scope },
      customerId: { $in: requested },
    });
    return bookedCustomerIds.map((value: unknown) => String(value));
  }

  async previewCount(actor: AuthenticatedUser, params: AudienceParams): Promise<number> {
    return (await this.resolve(actor, params)).length;
  }

  /** Customers the sender may pick from for a "users" campaign: any customer
   * for a platform admin, or only customers who've booked at an ashram the
   * caller owns/manages otherwise. Used by the "select specific customers"
   * search in both the mobile composer and (planned) web dashboard. */
  async listPickableCustomers(actor: AuthenticatedUser, search?: string): Promise<any[]> {
    const trimmed = search?.trim();
    const textFilter = trimmed
      ? {
          $or: [
            { name: { $regex: escapeRegex(trimmed), $options: "i" } },
            { email: { $regex: escapeRegex(trimmed), $options: "i" } },
            { phone: { $regex: escapeRegex(trimmed), $options: "i" } },
          ],
        }
      : {};

    if (canManageAllAshrams(actor)) {
      return this.users
        .find({ role: "customer", isDeleted: false, ...textFilter })
        .select("name email phone")
        .limit(50)
        .lean();
    }

    const scope = await resolveAshramScope(actor, this.ashrams);
    if (isUnrestricted(scope) || !scope.length) return [];
    const customerIds = await this.bookings.distinct("customerId", {
      ashramId: { $in: scope },
    });
    if (!customerIds.length) return [];
    return this.users
      .find({ _id: { $in: customerIds }, isDeleted: false, ...textFilter })
      .select("name email phone")
      .limit(50)
      .lean();
  }
}
