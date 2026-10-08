import { COMMUNITY_MODELS } from "../modules/community/infrastructure/persistence/community.schemas";
import { CONTENT_MODELS } from "../modules/content/infrastructure/persistence/content.schemas";
import { REGISTRY } from "./pg/registry.generated";

/**
 * Guards the 2026-10 database cleanup: the old duplicate tables stay out of
 * the registry, and the features that used them read the canonical tables.
 */
describe("database cleanup", () => {
  const registered = new Set(REGISTRY.tables.map((t) => `${t.schema}.${t.table}`));

  it.each([
    "public.bookings",
    "public.auditlogs",
    "public.payments",
    "public.reviews",
    "public.offers",
    "public.supporttickets",
    "public.platformsettings",
    "public.notification_campaigns",
    "public.marketplace_orders",
    "public.marketplace_payments",
    "public.marketplace_products",
    "public.marketplace_categories",
    "public.roomavailabilities",
    "public.roomunits",
    "public.otps",
    "public.notificationpreferences",
    "public.notificationtemplates",
    "leads.lead_attendance",
  ])("%s is no longer a registered table", (table) => {
    expect(registered.has(table)).toBe(false);
  });

  it.each([
    "public.users",
    "public.booking_bookings",
    "public.booking_payments",
    "public.booking_reviews",
    "public.booking_coupons",
    "public.platform_settings",
    "public.audit_logs",
    "public.push_campaigns",
    "public.marketplace_master_orders",
    "public.marketplace_vendor_orders",
    "public.marketplace_addresses",
    "leads.lead_attendances",
  ])("%s stays registered", (table) => {
    expect(registered.has(table)).toBe(true);
  });

  it("reads verified stays from booking_bookings", () => {
    const model = COMMUNITY_MODELS.find((m) => m.name === "CommunityBooking");
    expect(model?.schema.get("collection")).toBe("booking_bookings");
  });

  it("writes CMS audit entries through the shared AuditLog model", () => {
    expect(CONTENT_MODELS.some((m) => m.name === "ContentAuditLog")).toBe(false);
  });
});
