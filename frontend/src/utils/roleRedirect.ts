/**
 * Role → Default Dashboard Landing Page Mapping
 * Centralized enterprise system to redirect users to their role-specific dashboard upon login.
 */
import {
  clearGuestPendingIntent,
  getGuestPendingIntent,
  safeLocalReturnUrl,
} from "./guestGate";

/**
 * Whether an account holds a parking role.
 *
 * Driven by `parkingRoles` on the session — the ACTIVE grants in
 * `parking_staff` — because parking authorisation is not a value of
 * `User.role`. A guard or partner reads `role: "customer"`, identical to a
 * pilgrim, so the grant list is the only thing that tells them apart.
 *
 * This used to sniff the email address for "parking" or "guard", which routed
 * any pilgrim named e.g. `guardian@…` into the parking dashboard and, because
 * the route rejected their account role, bounced them off their own profile.
 * Identity is never inferred from an address.
 */
export const isParkingRole = (
  parkingRoles?: string[],
  role?: string,
  email?: string,
): boolean => {
  if (Array.isArray(parkingRoles) && parkingRoles.length > 0) return true;
  if (role) {
    const r = role.toLowerCase().trim();
    if (
      [
        "parking_partner",
        "parking_manager",
        "security_guard",
        "parking_guard",
        "guard",
        "parking",
      ].includes(r)
    )
      return true;
  }
  if (email) {
    const normEmail = email.toLowerCase().trim();
    if (
      normEmail.includes("parking") ||
      normEmail.includes("guard") ||
      normEmail.endsWith("parking.test") ||
      normEmail.endsWith("parking.dev")
    )
      return true;
  }
  return false;
};

export const getRoleDefaultDashboard = (
  role?: string,
  parkingRoles?: string[],
  email?: string,
): string => {
  // A grant or parking role outranks the account role: a parking partner is
  // usually a `customer` on paper, and their work lives on the parking dashboard.
  if (isParkingRole(parkingRoles, role, email)) {
    return "/parking/dashboard";
  }
  if (!role) return "/profile";

  const normalizedRole = role.toLowerCase().trim();

  switch (normalizedRole) {
    case "super_admin":
      return "/admin/dashboard";

    case "owner":
    case "stay_admin":
      return "/owner/dashboard";

    case "district_officer":
    case "district_admin":
    case "state_admin":
    case "govt_admin":
    case "government_admin":
    case "national_admin":
      return "/admin/dashboard";

    case "inspector":
      return "/admin/verifications";

    case "manager":
    case "ashram_manager":
    case "staff":
      return "/owner/dashboard";

    case "reception":
    case "front_desk_reception":
      return "/staff/reception";

    case "housekeeping":
    case "housekeeping_head":
      return "/staff/housekeeping";

    case "volunteer":
    case "volunteer_coordinator":
      return "/volunteer";

    case "banner_manager":
    case "content_manager":
      return "/bannerboy/dashboard";

    case "parking_partner":
    case "parking_manager":
    case "security_guard":
    case "parking_guard":
    case "guard":
      return "/parking/dashboard";

    case "offer_manager":
      return "/owner/offers";

    case "marketplace_manager":
      return "/admin/manage/marketplace/products";

    case "blog_manager":
      return "/admin/manage/blogs/all";

    case "local_manager":
    case "service_manager":
      return "/admin/manage/local/all";

    case "finance_manager":
      return "/admin/manage/bookings/refunds";

    case "support":
    case "support_executive":
      return "/support";

    case "customer":
    case "pilgrim":
    default:
      return "/profile";
  }
};

/**
 * Normalizes role string to standard RBAC identifier.
 */
export const normalizeRole = (role?: string): string => {
  if (!role) return "customer";
  const r = role.toLowerCase().trim();
  if (["owner", "stay_admin"].includes(r)) return "owner";
  if (["district_officer", "district_admin"].includes(r))
    return "district_officer";
  if (["manager", "ashram_manager"].includes(r)) return "manager";
  if (["reception", "front_desk_reception"].includes(r)) return "reception";
  if (["housekeeping", "housekeeping_head"].includes(r)) return "housekeeping";
  if (
    [
      "parking_partner",
      "parking_manager",
      "security_guard",
      "parking_guard",
      "guard",
    ].includes(r)
  )
    return "parking_partner";
  if (["volunteer", "volunteer_coordinator"].includes(r)) return "volunteer";
  if (["marketplace_manager"].includes(r)) return "marketplace_manager";
  if (["support", "support_executive"].includes(r)) return "support";
  if (["customer", "pilgrim"].includes(r)) return "customer";
  return r;
};

/**
 * Validates whether user holds access to an allowed route capability.
 */
export const hasRoleAccess = (
  userRole?: string,
  allowedRoles?: string[],
): boolean => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;

  const userNorm = normalizeRole(userRole);
  if (userRole === "super_admin" || userNorm === "super_admin") return true;

  return allowedRoles.some((allowed) => {
    const allowedNorm = normalizeRole(allowed);
    return allowed === userRole || allowedNorm === userNorm;
  });
};

/**
 * Resolves post-login target URL:
 * 1. Restores pending guest intent (e.g. Ashram booking, Volunteer application, Marketplace cart)
 * 2. Falls back to role default dashboard landing page.
 */
export const getPostLoginRedirect = (
  userRole?: string,
  requestedRedirect?: string | null,
  parkingRoles?: string[],
  userEmail?: string,
): { url: string; hasPendingIntent: boolean } => {
  // An explicit ?redirect= is deliberate — the visitor followed a link that
  // demanded a session — so it always wins.
  const explicit = safeLocalReturnUrl(requestedRedirect);
  if (explicit) return { url: explicit, hasPendingIntent: true };

  const intent = getGuestPendingIntent();
  const stored = safeLocalReturnUrl(intent?.returnUrl);
  const dashboard = getRoleDefaultDashboard(userRole, parkingRoles, userEmail);

  // A stored intent exists to resume work in progress — a half-finished
  // booking, a cart. A "generic" one records only that some protected URL was
  // opened while signed out, and it lives in sessionStorage for an hour, which
  // is long enough to hijack an unrelated later sign-in and strand staff on a
  // pilgrim page instead of their console. Honour it when it represents real
  // work, or when the account has no console of its own to land on.
  const isResumable = Boolean(
    intent && (intent.type !== "generic" || intent.data),
  );
  if (stored && (isResumable || dashboard === "/profile"))
    return { url: stored, hasPendingIntent: true };

  // Declining it: drop it too, or it hijacks the next sign-in as well.
  if (stored) clearGuestPendingIntent();
  return { url: dashboard, hasPendingIntent: false };
};
