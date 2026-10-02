/**
 * `User.email` is required and unique, so an account created without an
 * email (a walk-in guest booked at reception) is given a stand-in address on
 * a reserved, non-routable domain. Nothing is ever sent to it, and it must
 * never be shown to the user as their email.
 */
export const WALK_IN_EMAIL_DOMAIN = "guest.tirvona.local";

export const walkInPlaceholderEmail = (phone: string): string =>
  `walkin.${phone.replace(/\D/g, "")}@${WALK_IN_EMAIL_DOMAIN}`;

/** True for a stand-in address on a reserved domain (.local / .invalid). */
export const isPlaceholderEmail = (email?: string | null): boolean => {
  const domain = String(email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return /(^|\.)(local|invalid)$/.test(domain);
};

/** The user's real email, or null when they never gave one. */
export const realEmail = (email?: string | null): string | null =>
  email && !isPlaceholderEmail(email) ? email : null;
