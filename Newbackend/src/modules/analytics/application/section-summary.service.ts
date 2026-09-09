import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Types, type Connection } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { resolveAshramScope } from "../../../common/auth/ashram-scope";

/**
 * Every sidebar section publishes the same shape: a handful of counts drawn
 * straight from the collection behind it.
 *
 * These are counts, not domain logic, so they are read through the shared
 * connection rather than by importing fifteen feature modules into analytics —
 * which would drag their providers, guards and circular imports along for four
 * numbers apiece. Each section names its collection once, below, and a section
 * whose collection does not exist yet simply reports zero rather than failing
 * the whole dashboard.
 */

export interface SectionTile {
  label: string;
  value: number;
  format: "number" | "currency";
}

export interface SectionSummary {
  key: string;
  label: string;
  tiles: SectionTile[];
}

type Filter = Record<string, unknown>;

interface TileSpec {
  label: string;
  /** Extra match on top of the section filter. Omitted counts every row. */
  where?: Filter;
  /** Sums this field instead of counting rows. */
  sum?: string;
  format?: "number" | "currency";
}

interface SectionSpec {
  key: string;
  label: string;
  collection: string;
  /**
   * Platform-wide data with no ashram of its own. A caller limited to a
   * jurisdiction does not see it at all, rather than seeing everyone's.
   */
  platformOnly?: boolean;
  /** Field carrying the ashram, when the collection is scopable. */
  scopeField?: string;
  /** Narrows the whole collection, e.g. one module inside a shared table. */
  baseWhere?: Filter;
  tiles: TileSpec[];
}

const live = { deletedAt: null };

const SECTIONS: SectionSpec[] = [
  {
    key: "users",
    label: "User & Access Management",
    collection: "users",
    platformOnly: true,
    tiles: [
      { label: "Total accounts", where: live },
      { label: "Pilgrims", where: { ...live, role: "customer" } },
      { label: "Ashram owners", where: { ...live, role: { $in: ["owner", "ashram_owner"] } } },
      { label: "Suspended", where: { ...live, status: "suspended" } },
    ],
  },
  {
    key: "institution",
    label: "Institution Management",
    collection: "institutionmasters",
    platformOnly: true,
    tiles: [{ label: "Institutions" }],
  },
  {
    key: "temples",
    label: "Temple Management",
    collection: "temples",
    platformOnly: true,
    tiles: [
      { label: "Temples", where: live },
      { label: "Published", where: { ...live, status: "approved" } },
      { label: "Awaiting review", where: { ...live, status: "pending" } },
    ],
  },
  {
    key: "stays",
    label: "Stay Management",
    collection: "ashrams",
    scopeField: "_id",
    tiles: [
      { label: "Registered stays", where: live },
      { label: "Approved", where: { ...live, status: "approved" } },
      { label: "Awaiting verification", where: { ...live, status: "pending_inspection" } },
      { label: "Rejected", where: { ...live, status: "rejected" } },
    ],
  },
  {
    key: "roomApprovals",
    label: "Room Category Approvals",
    collection: "approval_requests",
    baseWhere: { module: "room_category" },
    scopeField: "ashramId",
    tiles: [
      { label: "Requests" },
      { label: "Pending", where: { status: "pending" } },
      { label: "Approved", where: { status: "approved" } },
      { label: "Rejected", where: { status: "rejected" } },
    ],
  },
  {
    key: "roomCategories",
    label: "Room Categories",
    collection: "rooms",
    scopeField: "ashramId",
    tiles: [
      { label: "Categories", where: live },
      { label: "Registered rooms", sum: "totalInventory", where: live },
      { label: "Active", where: { ...live, status: "active" } },
      { label: "Under maintenance", where: { ...live, status: "under_maintenance" } },
    ],
  },
  {
    key: "roomAvailability",
    label: "Room Availability",
    collection: "booking_daily_availability",
    scopeField: "ashramId",
    tiles: [
      { label: "Dated rows" },
      { label: "Capacity", sum: "totalInventory" },
      { label: "Booked", sum: "bookedCount" },
      { label: "Closed days", where: { isClosed: true } },
    ],
  },
  {
    key: "roomPricing",
    label: "Room Pricing",
    collection: "booking_pricing",
    scopeField: "ashramId",
    tiles: [
      { label: "Pricing rules" },
      { label: "Active", where: { isActive: true } },
    ],
  },
  {
    key: "roomInventory",
    label: "Room Inventory",
    collection: "booking_inventory",
    scopeField: "ashramId",
    tiles: [
      { label: "Inventory holds" },
      { label: "Confirmed", where: { state: "confirmed" } },
      { label: "Awaiting payment", where: { state: "held" } },
      {
        label: "Units committed",
        sum: "units",
        where: { state: { $in: ["held", "confirmed"] } },
      },
    ],
  },
  {
    key: "offlineRooms",
    label: "Offline Rooms",
    collection: "offline_rooms",
    scopeField: "ashramId",
    tiles: [
      { label: "Offline pools", where: live },
      { label: "Total units", sum: "totalUnits", where: live },
      { label: "Moved online", sum: "transferredUnits", where: live },
      { label: "Blocked", sum: "blockedUnits", where: live },
    ],
  },
  {
    key: "bookings",
    label: "Booking Management",
    collection: "booking_bookings",
    scopeField: "ashramId",
    tiles: [
      { label: "Total bookings" },
      { label: "Confirmed", where: { status: "confirmed" } },
      { label: "In house", where: { status: "checked_in" } },
      { label: "Cancelled", where: { status: "cancelled" } },
    ],
  },
  {
    key: "events",
    label: "Events & Festivals",
    collection: "event_festivals",
    scopeField: "ashramId",
    tiles: [
      { label: "Events", where: live },
      { label: "Published", where: { ...live, status: "approved" } },
      { label: "Awaiting review", where: { ...live, status: "pending" } },
    ],
  },
  {
    key: "eventRegistrations",
    label: "Event Registrations",
    collection: "event_registrations",
    scopeField: "ashramId",
    tiles: [
      { label: "Registrations" },
      { label: "Seats reserved", sum: "seats" },
      { label: "Attended", where: { status: "attended" } },
    ],
  },
  {
    key: "aarti",
    label: "Aarti Bookings",
    collection: "aarti_bookings",
    scopeField: "ashramId",
    tiles: [
      { label: "Bookings" },
      { label: "Passes sold", sum: "passCount" },
      { label: "Collected", sum: "pricing.amountPaid", format: "currency" },
      { label: "Attended", where: { status: "attended" } },
    ],
  },
  {
    key: "aartiSessions",
    label: "Aarti Sessions",
    collection: "aarti_sessions",
    scopeField: "ashramId",
    tiles: [
      { label: "Sessions", where: live },
      { label: "Published", where: { ...live, status: "approved" } },
      { label: "Awaiting review", where: { ...live, status: "pending" } },
    ],
  },
  {
    key: "livePooja",
    label: "Live Pooja",
    collection: "aarti_streams",
    scopeField: "ashramId",
    tiles: [
      { label: "Streams", where: live },
      { label: "Published", where: { ...live, status: "approved" } },
    ],
  },
  {
    key: "pilgrimage",
    label: "Pilgrimage & Planner",
    collection: "pilgrimage_circuits",
    platformOnly: true,
    tiles: [
      { label: "Circuits", where: live },
      { label: "Published", where: { ...live, status: "approved" } },
      { label: "Drafts", where: { ...live, status: "draft" } },
    ],
  },
  {
    key: "itineraries",
    label: "Saved Itineraries",
    collection: "pilgrimage_itineraries",
    platformOnly: true,
    tiles: [{ label: "Itineraries" }],
  },
  {
    key: "parking",
    label: "Parking Management",
    collection: "parking_bookings",
    platformOnly: true,
    tiles: [
      { label: "Parking bookings" },
      { label: "On site", where: { status: "checked_in" } },
      { label: "Collected", sum: "pricing.amountPaid", format: "currency" },
    ],
  },
  {
    key: "parkingPartners",
    label: "Parking Partners",
    collection: "parking_partners",
    platformOnly: true,
    tiles: [
      { label: "Partners", where: live },
      { label: "Approved", where: { ...live, status: "approved" } },
      { label: "Pending", where: { ...live, status: "pending" } },
    ],
  },
  {
    key: "content",
    label: "Content & Promotions",
    collection: "blogposts",
    platformOnly: true,
    tiles: [
      { label: "Articles" },
      { label: "Published", where: { status: "published" } },
    ],
  },
  {
    key: "localServices",
    label: "Local Services Management",
    collection: "localserviceitems",
    platformOnly: true,
    tiles: [{ label: "Listed services" }],
  },
  {
    key: "marketplace",
    label: "Marketplace Management",
    collection: "marketplace_orders",
    platformOnly: true,
    tiles: [
      { label: "Orders" },
      { label: "Delivered", where: { status: "delivered" } },
      { label: "Collected", sum: "pricing.amountPaid", format: "currency" },
    ],
  },
  {
    key: "smartContact",
    label: "Smart Contact Profiles",
    collection: "smart_contact_profiles",
    platformOnly: true,
    tiles: [
      { label: "Profiles", where: live },
      { label: "Published", where: { ...live, status: "published" } },
    ],
  },
  {
    key: "volunteer",
    label: "Volunteer Management",
    collection: "volunteerjobs",
    scopeField: "ashramId",
    tiles: [{ label: "Volunteer roles" }],
  },
  {
    key: "volunteerApplications",
    label: "Volunteer Applications",
    collection: "volunteerapplications",
    platformOnly: true,
    tiles: [{ label: "Applications" }],
  },
  {
    key: "payouts",
    label: "Tirvona Account",
    collection: "payout_requests",
    scopeField: "ashramId",
    tiles: [
      { label: "Payout requests" },
      { label: "Pending", where: { status: "pending" } },
      { label: "Paid out", sum: "amount", where: { status: "paid" }, format: "currency" },
    ],
  },
  {
    key: "refunds",
    label: "Refund Management",
    collection: "refund_requests",
    scopeField: "ashramId",
    tiles: [
      { label: "Refund requests" },
      { label: "Awaiting action", where: { status: { $in: ["pending", "in_review", "approved", "processing"] } } },
      { label: "Refunded", where: { status: "refunded" } },
    ],
  },
  {
    key: "support",
    label: "Support Tickets",
    collection: "booking_support_tickets",
    scopeField: "ashramId",
    tiles: [
      { label: "Tickets" },
      { label: "Open", where: { status: { $in: ["open", "in_progress"] } } },
    ],
  },
  {
    key: "community",
    label: "Community Articles",
    collection: "visitorarticles",
    platformOnly: true,
    tiles: [
      { label: "Articles" },
      { label: "Published", where: { status: "published" } },
    ],
  },
  {
    key: "offers",
    label: "Offers & Deals",
    collection: "booking_coupons",
    scopeField: "ashramId",
    tiles: [
      { label: "Offers" },
      { label: "Active", where: { status: "active" } },
    ],
  },
  {
    key: "governance",
    label: "Approvals",
    collection: "approval_requests",
    platformOnly: true,
    tiles: [
      { label: "Approval requests" },
      { label: "Pending", where: { status: "pending" } },
    ],
  },
  {
    key: "marketplaceProducts",
    label: "Marketplace Products",
    collection: "marketplaceproducts",
    platformOnly: true,
    tiles: [
      { label: "Products" },
      { label: "Published", where: { status: "active" } },
      { label: "Out of stock", where: { stockCount: { $lte: 0 } } },
    ],
  },
  {
    key: "marketplaceCategories",
    label: "Marketplace Categories",
    collection: "marketplacecategories",
    platformOnly: true,
    tiles: [{ label: "Categories" }, { label: "Active", where: { status: "active" } }],
  },
  {
    key: "marketplaceWaitlist",
    label: "Marketplace Waitlist",
    collection: "marketplacewaitlists",
    platformOnly: true,
    tiles: [{ label: "Signups" }, { label: "Notified", where: { notified: true } }],
  },
  {
    key: "parkingLocations",
    label: "Parking Locations",
    collection: "parking_locations",
    platformOnly: true,
    tiles: [
      { label: "Locations", where: live },
      { label: "Active", where: { ...live, status: "active" } },
    ],
  },
  {
    key: "parkingSlots",
    label: "Parking Slots",
    collection: "parking_slots",
    platformOnly: true,
    tiles: [
      { label: "Slots" },
      { label: "Available", where: { status: "available" } },
      { label: "Occupied", where: { status: "occupied" } },
    ],
  },
  {
    key: "parkingTransactions",
    label: "Parking Transactions",
    collection: "parking_transactions",
    platformOnly: true,
    tiles: [
      { label: "Transactions" },
      { label: "Value", sum: "amount", format: "currency" },
    ],
  },
  {
    key: "parkingReviews",
    label: "Parking Reviews",
    collection: "parking_reviews",
    platformOnly: true,
    tiles: [{ label: "Reviews" }, { label: "Published", where: { status: "published" } }],
  },
  {
    key: "templeAartis",
    label: "Temple Aartis",
    collection: "temple_aartis",
    platformOnly: true,
    tiles: [{ label: "Aarti timings" }],
  },
  {
    key: "templeFestivals",
    label: "Temple Festivals",
    collection: "temple_festivals",
    platformOnly: true,
    tiles: [{ label: "Festivals" }],
  },
  {
    key: "blogAuthors",
    label: "Blog Authors",
    collection: "contentchangerequests",
    platformOnly: true,
    tiles: [
      { label: "Change requests" },
      { label: "Pending", where: { status: "pending" } },
    ],
  },
  {
    key: "blogComments",
    label: "Blog Comments",
    collection: "blogcomments",
    platformOnly: true,
    tiles: [{ label: "Comments" }, { label: "Approved", where: { status: "approved" } }],
  },
  {
    key: "institutionContacts",
    label: "Contacts Directory",
    collection: "institutioncontacts",
    platformOnly: true,
    tiles: [{ label: "Contacts" }],
  },
  {
    key: "institutionLocations",
    label: "Institution Locations",
    collection: "institutionlocations",
    platformOnly: true,
    tiles: [{ label: "Locations" }],
  },
  {
    key: "institutionAudits",
    label: "Quality & Audit",
    collection: "institutionqualityaudits",
    platformOnly: true,
    tiles: [{ label: "Audits" }],
  },
  {
    key: "pilgrimageStops",
    label: "Pilgrimage Stops",
    collection: "pilgrimage_stops",
    platformOnly: true,
    tiles: [{ label: "Stops" }],
  },
  {
    key: "serviceProviders",
    label: "Service Providers",
    collection: "serviceproviders",
    platformOnly: true,
    tiles: [{ label: "Providers" }, { label: "Active", where: { status: "active" } }],
  },
  {
    key: "aartiPassTypes",
    label: "Aarti Passes",
    collection: "aarti_pass_types",
    scopeField: "ashramId",
    tiles: [{ label: "Pass types", where: live }],
  },
  {
    key: "aartiPayments",
    label: "Aarti Payments",
    collection: "aarti_payments",
    scopeField: "ashramId",
    tiles: [
      { label: "Payments" },
      { label: "Collected", sum: "amount", format: "currency" },
    ],
  },
  {
    key: "aartiReviews",
    label: "Aarti Reviews",
    collection: "aarti_reviews",
    scopeField: "ashramId",
    tiles: [{ label: "Reviews" }],
  },
  {
    key: "aartiStaff",
    label: "Aarti Gate Staff",
    collection: "aarti_staff",
    scopeField: "ashramId",
    tiles: [{ label: "Staff" }],
  },
  {
    key: "eventStaff",
    label: "Event Staff",
    collection: "event_staff",
    scopeField: "ashramId",
    tiles: [{ label: "Staff" }],
  },
  {
    key: "banners",
    label: "Homepage Banners",
    collection: "contentchangerequests",
    baseWhere: { module: "banner" },
    platformOnly: true,
    tiles: [{ label: "Banner records" }],
  },
  {
    key: "audit",
    label: "Reports & Audit",
    collection: "audit_logs",
    platformOnly: true,
    tiles: [{ label: "Audit entries" }],
  },
];

@Injectable()
export class SectionSummaryService {
  private readonly logger = new Logger(SectionSummaryService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async sections(user: AuthenticatedUser): Promise<SectionSummary[]> {
    const unrestricted = canManageAllAshrams(user);
    const ashramIds = unrestricted
      ? null
      : ((await resolveAshramScope(
          user,
          this.connection.model("Ashram") as never,
        )) ?? []);

    const visible = SECTIONS.filter(
      (section) => unrestricted || !section.platformOnly,
    );

    const summaries = await Promise.all(
      visible.map((section) => this.summarise(section, ashramIds)),
    );
    return summaries.filter((section): section is SectionSummary =>
      Boolean(section),
    );
  }

  private async summarise(
    section: SectionSpec,
    ashramIds: string[] | null,
  ): Promise<SectionSummary | null> {
    const base: Filter = { ...(section.baseWhere ?? {}) };
    if (ashramIds && section.scopeField) {
      const ids = ashramIds.map((id) => this.objectId(id)).filter(Boolean);
      base[section.scopeField] = { $in: ids };
    }

    try {
      const values = await this.facet(section.collection, base, section.tiles);
      return {
        key: section.key,
        label: section.label,
        tiles: section.tiles.map((tile, index) => ({
          label: tile.label,
          value: values[index],
          format: tile.format ?? "number",
        })),
      };
    } catch (error) {
      // One missing or unreadable collection must not take the dashboard with
      // it; the section is dropped and the rest still render.
      this.logger.warn(
        JSON.stringify({
          event: "analytics.section_summary_failed",
          section: section.key,
          collection: section.collection,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return null;
    }
  }

  /**
   * One aggregation per collection rather than one per tile, so a section with
   * four counts costs a single round trip.
   */
  private async facet(
    collection: string,
    base: Filter,
    tiles: TileSpec[],
  ): Promise<number[]> {
    const facets: Record<string, unknown[]> = {};
    tiles.forEach((tile, index) => {
      const stages: unknown[] = [];
      if (tile.where) stages.push({ $match: tile.where });
      stages.push(
        tile.sum
          ? {
              $group: {
                _id: null,
                total: { $sum: { $ifNull: [`$${tile.sum}`, 0] } },
              },
            }
          : { $count: "total" },
      );
      facets[`t${index}`] = stages;
    });

    const [row] = await this.connection
      .collection(collection)
      .aggregate([{ $match: base }, { $facet: facets as never }])
      .toArray();

    return tiles.map((_, index) => {
      const total = Number((row?.[`t${index}`]?.[0] as any)?.total ?? 0);
      return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
    });
  }

  /** A scope id that is not a valid ObjectId matches nothing, which is safe. */
  private objectId(id: string): unknown {
    return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;
  }
}
