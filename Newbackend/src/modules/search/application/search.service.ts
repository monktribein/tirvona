import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams, isAshramOwner } from "../../../common/auth/ashram-access";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";

export interface SearchHit {
  type: "ashram" | "user" | "booking" | "parking";
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  url: string;
}

/** Roles that see the whole platform without a jurisdiction filter. */
const NATIONAL_ROLES = ["super_admin", "national_admin"];
/** Roles whose ashram visibility is limited to their own state. */
const STATE_ROLES = ["state_admin", "govt_admin", "government_admin"];
/** Roles limited to a single district within their state. */
const DISTRICT_ROLES = ["district_officer", "inspector"];
/** Roles permitted to look up accounts. Mirrors the /admin/users route gate. */
const USER_SEARCH_ROLES = [
  "super_admin",
  "national_admin",
  "govt_admin",
  "government_admin",
];

@Injectable()
export class SearchService {
  constructor(
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Location)
    private readonly parkingLocations: Model<any>,
  ) {}

  /**
   * The ashram filter this caller is allowed to see.
   *
   * `null` means "no ashram is visible" — distinct from `{}`, which means "every
   * ashram is visible". Collapsing the two would hand an unscoped operator the
   * entire estate, so the caller must branch on null explicitly.
   */
  private ashramScope(user: AuthenticatedUser): Record<string, any> | null {
    if (NATIONAL_ROLES.includes(user.role) || canManageAllAshrams(user))
      return {};
    if (DISTRICT_ROLES.includes(user.role)) {
      if (!user.state || !user.district) return null;
      return { "address.state": user.state, "address.district": user.district };
    }
    if (STATE_ROLES.includes(user.role)) {
      if (!user.state) return null;
      return { "address.state": user.state };
    }
    if (isAshramOwner(user)) return { ownerId: user.id };
    const scoped = [
      ...new Set([
        ...(user.scopedAshramIds ?? []),
        ...(user.employerAshramId ? [user.employerAshramId] : []),
      ]),
    ];
    return scoped.length ? { _id: { $in: scoped } } : null;
  }

  async search(
    user: AuthenticatedUser,
    rawTerm: string,
    perType: number,
  ): Promise<{ query: string; total: number; results: SearchHit[] }> {
    const term = rawTerm.trim();
    if (term.length < 2) return { query: term, total: 0, results: [] };

    // Escaped so a term like "a+(" is matched literally instead of compiling
    // into a catastrophically backtracking pattern.
    const pattern = new RegExp(escapeRegex(term), "i");
    const scope = this.ashramScope(user);

    const [ashrams, users, bookings, parking] = await Promise.all([
      this.findAshrams(scope, pattern, perType),
      this.findUsers(user, pattern, perType),
      this.findBookings(scope, pattern, perType),
      this.findParking(user, pattern, perType),
    ]);

    const results = [...ashrams, ...users, ...bookings, ...parking];
    return { query: term, total: results.length, results };
  }

  private async findAshrams(
    scope: Record<string, any> | null,
    pattern: RegExp,
    limit: number,
  ): Promise<SearchHit[]> {
    if (!scope) return [];
    const rows = await this.ashrams
      .find({
        ...scope,
        deletedAt: null,
        $or: [
          { name: pattern },
          { ashramCode: pattern },
          { slug: pattern },
          { "address.city": pattern },
        ],
      })
      .select("name ashramCode status address")
      .limit(limit)
      .lean();
    return rows.map((row: any) => ({
      type: "ashram" as const,
      id: String(row._id),
      title: row.name,
      subtitle: [row.address?.city, row.address?.state]
        .filter(Boolean)
        .join(", "),
      badge: String(row.status ?? "").replace(/_/g, " "),
      url: `/ashram/${row._id}`,
    }));
  }

  private async findUsers(
    user: AuthenticatedUser,
    pattern: RegExp,
    limit: number,
  ): Promise<SearchHit[]> {
    if (!USER_SEARCH_ROLES.includes(user.role)) return [];
    const rows = await this.users
      .find({
        isDeleted: { $ne: true },
        $or: [{ name: pattern }, { email: pattern }, { phone: pattern }],
      })
      .select("name email phone role status")
      .limit(limit)
      .lean();
    return rows.map((row: any) => ({
      type: "user" as const,
      id: String(row._id),
      title: row.name,
      subtitle: row.email,
      badge: String(row.role ?? "").replace(/_/g, " "),
      // Seeds the user list's own search box so the match is visible on arrival
      // rather than leaving the operator to retype it.
      url: `/admin/users?q=${encodeURIComponent(row.email || row.name || "")}`,
    }));
  }

  private async findBookings(
    scope: Record<string, any> | null,
    pattern: RegExp,
    limit: number,
  ): Promise<SearchHit[]> {
    if (!scope) return [];
    // A booking carries no ashram jurisdiction of its own, so the visible
    // ashram set is resolved first and the lookup constrained to it. An empty
    // scope object means "no constraint", which is the national case.
    const constraint = Object.keys(scope).length
      ? {
          ashramId: {
            $in: await this.ashrams.distinct("_id", scope),
          },
        }
      : {};
    const rows = await this.bookings
      .find({
        ...constraint,
        $or: [{ bookingId: pattern }, { reservationNumber: pattern }],
      })
      .select("bookingId reservationNumber status pricing checkInDate")
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("ashramId", "name")
      .lean();
    return rows.map((row: any) => ({
      type: "booking" as const,
      id: String(row._id),
      title: row.bookingId || row.reservationNumber || String(row._id),
      subtitle: row.ashramId?.name ?? "Unknown ashram",
      badge: String(row.status ?? "").replace(/_/g, " "),
      url: `/admin/manage/bookings/all`,
    }));
  }

  private async findParking(
    user: AuthenticatedUser,
    pattern: RegExp,
    limit: number,
  ): Promise<SearchHit[]> {
    // Parking is a separate domain with its own grants, so only platform-level
    // oversight roles get it in the shared results.
    if (!NATIONAL_ROLES.includes(user.role)) return [];
    const rows = await this.parkingLocations
      .find({
        $or: [
          { name: pattern },
          { slug: pattern },
          { "address.city": pattern },
        ],
      })
      .select("name slug status address")
      .limit(limit)
      .lean();
    return rows.map((row: any) => ({
      type: "parking" as const,
      id: String(row._id),
      title: row.name,
      subtitle: [row.address?.city, row.address?.state]
        .filter(Boolean)
        .join(", "),
      badge: String(row.status ?? "").replace(/_/g, " "),
      url: `/parking/${row.slug}`,
    }));
  }
}
