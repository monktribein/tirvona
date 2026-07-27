// Shared Admin Permissions Matrix
export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  GOVT_ADMIN: 'govt_admin',
  DISTRICT_OFFICER: 'district_officer',
  OWNER: 'owner',
  MANAGER: 'manager',
  SUPPORT: 'support',
};

export const hasRole = (user, allowedRoles = []) => {
  if (!user || !user.role) return false;
  return allowedRoles.includes(user.role);
};
