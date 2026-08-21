import {
  clearGuestPendingIntent,
  getGuestPendingIntent,
  safeLocalReturnUrl,
} from "./guestGate";

export const isParkingRole = (
  parkingRoles?: string[],
  role?: string,
  _email?: string,
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
  return false;
};

export const getRoleDefaultDashboard = (
  role?: string,
  parkingRoles?: string[],
  email?: string,
): string => {
  const normalizedRole = role?.toLowerCase().trim();

  if (["ashram_admin", "stay_admin"].includes(normalizedRole || ""))
    return "/ashram-admin/dashboard";
  if (["ashram_owner", "owner"].includes(normalizedRole || ""))
    return "/ashram-owner/dashboard";

  if (isParkingRole(parkingRoles, role, email)) {
    return "/parking/dashboard";
  }
  if (!role) return "/profile";

  switch (normalizedRole) {
    case "super_admin":
      return "/admin/dashboard";

    case "ashram_admin":
    case "stay_admin": // legacy session
      return "/ashram-admin/dashboard";

    case "ashram_owner":
    case "owner": // legacy session
      return "/ashram-owner/dashboard";

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

    case "parking_partner":
    case "parking_manager":
    case "security_guard":
    case "parking_guard":
    case "guard":
      return "/parking/dashboard";

    case "offer_manager":
      return "/owner/offers";

    case "content_manager":
      return "/admin/manage/blogs/all";

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

export const normalizeRole = (role?: string): string => {
  if (!role) return "customer";
  const r = role.toLowerCase().trim();
  if (r === "owner") return "ashram_owner";
  if (r === "stay_admin") return "ashram_admin";
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

export const hasRoleAccess = (
  userRole?: string,
  allowedRoles?: string[],
): boolean => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;

  const userNorm = normalizeRole(userRole);
  if (userRole === "super_admin" || userNorm === "super_admin") return true;

  if (
    userNorm === "ashram_admin" &&
    allowedRoles.some((allowed) => normalizeRole(allowed) === "ashram_owner")
  )
    return true;
  return allowedRoles.some((allowed) => {
    const allowedNorm = normalizeRole(allowed);
    return allowed === userRole || allowedNorm === userNorm;
  });
};

export const getPostLoginRedirect = (
  userRole?: string,
  requestedRedirect?: string | null,
  parkingRoles?: string[],
  userEmail?: string,
): { url: string; hasPendingIntent: boolean } => {
  const dashboard = getRoleDefaultDashboard(userRole, parkingRoles, userEmail);

  if (dashboard !== "/profile") {
    clearGuestPendingIntent();
    return { url: dashboard, hasPendingIntent: false };
  }

  const explicit = safeLocalReturnUrl(requestedRedirect);
  if (explicit) return { url: explicit, hasPendingIntent: true };

  const intent = getGuestPendingIntent();
  const stored = safeLocalReturnUrl(intent?.returnUrl);

  const isResumable = Boolean(
    intent && (intent.type !== "generic" || intent.data),
  );
  if (stored && (isResumable || dashboard === "/profile"))
    return { url: stored, hasPendingIntent: true };

  if (stored) clearGuestPendingIntent();
  return { url: dashboard, hasPendingIntent: false };
};
