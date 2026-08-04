import { GovernanceService } from "./governance.service";
import {
  ADMIN_MODULE_KEYS,
  ADMIN_REFS,
} from "../infrastructure/persistence/governance.schemas";

/**
 * Every admin console entry in the frontend sidebar
 * (frontend/src/admin/shared/layouts/DashboardLayout.tsx) reaches the backend
 * as GET /admin/crud/:moduleKey?subKey=:subKey. A module/sub-key pair that
 * cannot be resolved answers 400 and the screen renders empty, so the mapping
 * is pinned here.
 */
const SIDEBAR: [string, string | undefined][] = [
  ["ashrams", "all"],
  ["ashrams", "amenities"],
  ["ashrams", "approved"],
  ["ashrams", "categories"],
  ["ashrams", "facilities"],
  ["ashrams", "rejected"],
  ["ashrams", "room-categories"],
  ["banner", "approval"],
  ["banner", "blog"],
  ["banner", "destination"],
  ["banner", "hero-slider"],
  ["banner", "homepage"],
  ["banner", "marketplace"],
  ["banner", "offers"],
  ["banner", "upload"],
  ["blogs", "all"],
  ["blogs", "authors"],
  ["blogs", "categories"],
  ["bookings", "all"],
  ["bookings", "cancelled"],
  ["bookings", "completed"],
  ["bookings", "confirmed"],
  ["bookings", "pending"],
  ["bookings", "refunds"],
  ["institution", undefined],
  ["institution", "trusts"],
  ["institution_audits", undefined],
  ["institution_contacts", undefined],
  ["institution_locations", undefined],
  ["local", "all"],
  ["local", "emergency"],
  ["local", "events"],
  ["local", "guides"],
  ["local", "medical"],
  ["local", "photography"],
  ["local", "restaurants"],
  ["local", "shops"],
  ["local", "transport"],
  ["marketplace", "categories"],
  ["marketplace", "newsletter"],
  ["marketplace", "orders"],
  ["marketplace", "products"],
  ["marketplace", "vendors"],
  ["marketplace", "waitlist"],
  ["offers", "all"],
  ["offers", "featured"],
  // Parking uses one module key per collection rather than parking/<section>,
  // because a shared sub-key would be resolved against the global alias table
  // and land on the wrong collection — "bookings" is already the ashram
  // booking collection, and "pricing" is a neutral sub-key.
  ["parking_bookings", "all"],
  ["parking_bookings", "cancelled"],
  ["parking_bookings", "checked_in"],
  ["parking_bookings", "pending"],
  ["parking_bookings", "upcoming"],
  ["parking_commissions", "all"],
  ["parking_commissions", "pending"],
  ["parking_commissions", "settled"],
  ["parking_locations", "active"],
  ["parking_locations", "all"],
  ["parking_locations", "pending"],
  ["parking_partners", "active"],
  ["parking_partners", "all"],
  ["parking_partners", "pending"],
  ["parking_pricing", "all"],
  ["parking_reviews", "all"],
  ["parking_scan_logs", "all"],
  ["parking_scan_logs", "failed"],
  ["parking_slot_types", "all"],
  ["parking_slots", "all"],
  ["parking_staff", "all"],
  ["parking_staff", "security_guard"],
  ["parking_transactions", "all"],
  ["parking_transactions", "payout"],
  ["planner", "circuits"],
  ["planner", "itineraries"],
  ["planner", "rituals"],
  ["planner", "routes"],
  ["planner", "temples"],
  ["reports", "bookings"],
  ["reports", "revenue"],
  ["rooms", "all"],
  ["rooms", "availability"],
  ["rooms", "inventory"],
  ["rooms", "pricing"],
  ["rooms", "season-pricing"],
  ["users", "banner-managers"],
  ["users", "content-managers"],
  ["users", "owners"],
  ["users", "pilgrims"],
  ["users", "roles"],
  ["users", "staff"],
];

describe("admin console module resolution", () => {
  const service = new GovernanceService({} as never) as any;
  const model = (moduleKey: string, subKey?: string): string =>
    service.adminModel(moduleKey, subKey);

  it.each(SIDEBAR)("resolves %s/%s to a collection", (moduleKey, subKey) => {
    expect(() => model(moduleKey, subKey)).not.toThrow();
  });

  it("keeps sub-keys that own a collection pointed at it", () => {
    expect(model("blogs", "authors")).toBe("Admin_authors");
    expect(model("marketplace", "orders")).toBe("Admin_orders");
    expect(model("ashrams", "room-categories")).toBe("Admin_rooms");
    expect(model("planner", "itineraries")).toBe("Admin_itineraries");
  });

  it("treats a sub-key with no collection as a view of its module", () => {
    expect(model("users", "roles")).toBe("Admin_users");
    expect(model("offers", "featured")).toBe("Admin_offers");
    expect(model("institution", "trusts")).toBe("InstitutionMaster");
    expect(model("reports", "revenue")).toBe("Admin_reports");
  });

  it("selects every field it populates", () => {
    // Mongoose drops a populate whose path is not in the projection, and does
    // it silently — the column just renders empty. Any ref on a model that
    // also has a projection has to appear in that projection.
    const projections: Record<string, string> = (GovernanceService as any)
      .ADMIN_LIST_PROJECTIONS;
    const gaps: string[] = [];
    for (const [key, refs] of Object.entries(ADMIN_REFS)) {
      const projection = projections[`Admin_${key}`];
      if (!projection) continue;
      const selected = new Set(projection.split(/\s+/));
      for (const path of Object.keys(refs))
        if (!selected.has(path)) gaps.push(`Admin_${key}.${path}`);
    }
    expect(gaps).toEqual([]);
  });

  it("points every ref at a registered admin model", () => {
    const known = new Set(ADMIN_MODULE_KEYS.map((key) => `Admin_${key}`));
    const dangling: string[] = [];
    for (const [key, refs] of Object.entries(ADMIN_REFS)) {
      if (!known.has(`Admin_${key}`)) dangling.push(key);
      for (const [path, { ref }] of Object.entries(refs))
        if (!known.has(ref)) dangling.push(`${key}.${path} -> ${ref}`);
    }
    expect(dangling).toEqual([]);
  });

  it("rejects a module that maps to no collection at all", () => {
    expect(() => model("not_a_module")).toThrow(
      /Unsupported administration module/,
    );
  });

  it("keeps a parking sub-key on the parking collection", () => {
    // Regression guard: "bookings" and "pricing" both mean something else in
    // the shared alias table, so parking must never route through them.
    expect(model("parking_bookings", "checked_in")).toBe(
      "Admin_parking_bookings",
    );
    expect(model("parking_pricing", "all")).toBe("Admin_parking_pricing");
    expect(model("parking_commissions", "settled")).toBe(
      "Admin_parking_commissions",
    );
  });

  it("narrows parking rows by their own lifecycle field", () => {
    const booking: Record<string, any> = {};
    service.applyAdminSubKeyFilter("parking_bookings", "checked_in", booking);
    expect(booking).toEqual({ status: "checked_in" });

    // A commission settles on `settlementStatus`, not `status` — "pending"
    // exists in the shared status map and must not leak onto the wrong field.
    const commission: Record<string, any> = {};
    service.applyAdminSubKeyFilter("parking_commissions", "pending", commission);
    expect(commission).toEqual({ settlementStatus: "pending" });

    const staff: Record<string, any> = {};
    service.applyAdminSubKeyFilter("parking_staff", "security_guard", staff);
    expect(staff).toEqual({ parkingRole: "security_guard" });

    const scans: Record<string, any> = {};
    service.applyAdminSubKeyFilter("parking_scan_logs", "failed", scans);
    expect(scans).toEqual({ result: { $ne: "success" } });

    const all: Record<string, any> = {};
    service.applyAdminSubKeyFilter("parking_bookings", "all", all);
    expect(all).toEqual({});
  });

  it("narrows a module view but never re-filters a redirected collection", () => {
    const narrowed: Record<string, any> = {};
    service.applyAdminSubKeyFilter("users", "banner-managers", narrowed);
    expect(narrowed).toEqual({ role: "banner_manager" });

    const redirected: Record<string, any> = {};
    service.applyAdminSubKeyFilter("reports", "bookings", redirected);
    expect(redirected).toEqual({});

    const status: Record<string, any> = {};
    service.applyAdminSubKeyFilter("ashrams", "approved", status);
    expect(status).toEqual({ status: "approved" });
  });
});
