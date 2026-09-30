import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { SUPPORT_CONFIG } from "../constants/support";
import { SUPPORT_CONSOLE_ROLES } from "../admin/support/supportAccess";

/**
 * The old `/support` address (bookmarks, notifications, role landing).
 * Staff go to the Support Management console, everyone else to their
 * Help & Support tickets in the profile.
 */
export const SupportTicketsPage: React.FC = () => {
  const { user } = useAuth();
  const { search } = useLocation();
  if (!user)
    return (
      <p className="p-6 text-sm text-gray-500">
        Please sign in to see your support tickets, or call {SUPPORT_CONFIG.helpline}.
      </p>
    );
  const staff = SUPPORT_CONSOLE_ROLES.includes(user.role);
  return <Navigate to={`${staff ? "/admin/support" : "/profile/support"}${search}`} replace />;
};

export default SupportTicketsPage;
