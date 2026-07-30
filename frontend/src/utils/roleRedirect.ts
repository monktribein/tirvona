/**
 * Role → Default Dashboard Landing Page Mapping
 * Centralized enterprise system to redirect users to their role-specific dashboard upon login.
 */

export const getRoleDefaultDashboard = (role?: string): string => {
  if (!role) return '/profile';

  const normalizedRole = role.toLowerCase().trim();

  switch (normalizedRole) {
    case 'super_admin':
      return '/admin/dashboard';

    case 'owner':
    case 'stay_admin':
      return '/owner/dashboard';

    case 'district_officer':
    case 'district_admin':
    case 'govt_admin':
    case 'government_admin':
      return '/admin/dashboard';

    case 'manager':
    case 'ashram_manager':
      return '/owner/dashboard';

    case 'reception':
    case 'front_desk_reception':
      return '/staff/reception';

    case 'housekeeping':
    case 'housekeeping_head':
      return '/staff/housekeeping';

    case 'volunteer':
    case 'volunteer_coordinator':
      return '/owner/volunteer';

    case 'banner_manager':
      return '/bannerboy/dashboard';

    case 'marketplace_manager':
      return '/admin/manage/marketplace/products';

    case 'support':
    case 'support_executive':
      return '/support';

    case 'customer':
    case 'pilgrim':
    default:
      return '/profile';
  }
};

/**
 * Normalizes role string to standard RBAC identifier.
 */
export const normalizeRole = (role?: string): string => {
  if (!role) return 'customer';
  const r = role.toLowerCase().trim();
  if (['owner', 'stay_admin'].includes(r)) return 'owner';
  if (['district_officer', 'district_admin', 'govt_admin', 'government_admin'].includes(r)) return 'district_officer';
  if (['manager', 'ashram_manager'].includes(r)) return 'manager';
  if (['reception', 'front_desk_reception'].includes(r)) return 'reception';
  if (['housekeeping', 'housekeeping_head'].includes(r)) return 'housekeeping';
  if (['volunteer', 'volunteer_coordinator'].includes(r)) return 'volunteer';
  if (['marketplace_manager'].includes(r)) return 'marketplace_manager';
  if (['support', 'support_executive'].includes(r)) return 'support';
  if (['customer', 'pilgrim'].includes(r)) return 'customer';
  return r;
};

/**
 * Validates whether user holds access to an allowed route capability.
 */
export const hasRoleAccess = (userRole?: string, allowedRoles?: string[]): boolean => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;

  const userNorm = normalizeRole(userRole);
  if (userRole === 'super_admin' || userNorm === 'super_admin') return true;

  return allowedRoles.some((allowed) => {
    const allowedNorm = normalizeRole(allowed);
    return allowed === userRole || allowedNorm === userNorm;
  });
};

/**
 * Resolves post-login target URL:
 * 1. Restores pending guest intent (e.g. Ashram booking, Volunteer application, Marketplace cart)
 * 2. Falls back to role default dashboardlanding page.
 */
export const getPostLoginRedirect = (userRole?: string): { url: string; hasPendingIntent: boolean } => {
  try {
    const raw = sessionStorage.getItem('tirvona_guest_pending_intent');
    if (raw) {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem('tirvona_guest_pending_intent');
      if (parsed?.returnUrl) {
        return { url: parsed.returnUrl, hasPendingIntent: true };
      }
    }
  } catch (err) {
    console.error('Error reading pending guest intent:', err);
  }

  return { url: getRoleDefaultDashboard(userRole), hasPendingIntent: false };
};
