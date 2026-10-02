/**
 * Accounts created without an email (walk-in guests) hold a stand-in address
 * on a reserved domain such as `guest.tirvona.local`. The backend already
 * withholds it from the session; this also covers a session cached before
 * that change. Mirrors `Newbackend/src/modules/users/domain/placeholder-email.ts`.
 */
export const isPlaceholderEmail = (email?: string | null): boolean => {
  const domain = String(email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return /(^|\.)(local|invalid)$/.test(domain);
};

/** The user's real email, or "" when they never gave one. */
export const realEmail = (email?: string | null): string =>
  email && !isPlaceholderEmail(email) ? email : "";
