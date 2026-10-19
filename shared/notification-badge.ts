/** Framework-neutral badge rules shared by the Buyer, Seller and Admin bundles. */
export function notificationBadgeText(count?: number): string | null {
  if (!Number.isFinite(count) || !count || count <= 0) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}
