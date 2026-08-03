import { GovernanceService } from "./governance.service";

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

  it("rejects a module that maps to no collection at all", () => {
    expect(() => model("not_a_module")).toThrow(
      /Unsupported administration module/,
    );
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
