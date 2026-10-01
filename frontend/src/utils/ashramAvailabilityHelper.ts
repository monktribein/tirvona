// Helper for Ashram booking-availability checks.
// Backed by the real `bookingPaused` field on the Ashram document
// (see ashramService.pauseBooking / requestResume / decideResumeRequest),
// not client-side state — so it is consistent for every guest and device.

export interface AvailabilityRequest {
  _id: string;
  name: string;
  address?: { city?: string; state?: string };
  ownerId?: { _id?: string; name?: string; email?: string; phone?: string };
  bookingPaused: boolean;
  availabilityRequest?: {
    pending: boolean;
    requestedAt?: string;
    requestedBy?: string;
  };
}

/**
 * Whether guests can currently book this ashram online.
 * Enforces Tirvona bookability rules:
 * - Not paused by owner
 * - Active / approved status
 * - At least 1 active room category
 * - Total inventory > 0
 * - Valid price (> 0)
 * - Not marked enquiry-only
 */
export const checkAshramBookingAvailable = (ashram: any): boolean => {
  if (!ashram) return false;
  if (ashram.bookingPaused === true) return false;
  if (ashram.isAvailable === false) return false;
  if (ashram.available === false) return false;
  if (ashram.bookingAvailable === false) return false;
  if (ashram.isBookable === false) return false;
  if (ashram.enquiryOnly === true) return false;
  if (
    typeof ashram.status === "string" &&
    ["inactive", "paused", "disabled", "rejected"].includes(ashram.status.toLowerCase())
  ) {
    return false;
  }

  // Check categories & inventory
  const categories =
    ashram.discovery?.rooms?.categories ?? (Array.isArray(ashram.rooms) ? ashram.rooms.length : undefined);
  if (categories !== undefined && categories <= 0) return false;

  const totalInventory =
    ashram.discovery?.rooms?.totalInventory ??
    (Array.isArray(ashram.rooms)
      ? ashram.rooms.reduce((s: number, r: any) => s + Number(r.totalInventory ?? 0), 0)
      : undefined);
  if (totalInventory !== undefined && totalInventory <= 0) return false;

  // Check price (0-price or contact for price)
  const startPrice = Number(
    ashram.pricing?.startingPrice ?? ashram.lowestNightPrice ?? 0,
  );
  if (
    startPrice <= 0 &&
    Array.isArray(ashram.rooms) &&
    ashram.rooms.length > 0 &&
    ashram.rooms.every((r: any) => Number(r.basePrice ?? 0) <= 0)
  ) {
    return false;
  }

  if (ashram.discovery?.bookingAvailability?.checkedForDates) {
    return Boolean(ashram.discovery.bookingAvailability.available);
  }
  return true;
};

export const isAshramEnquiryOnly = (ashram: any): boolean => {
  if (!ashram) return false;
  if (ashram.enquiryOnly === true || ashram.discovery?.bookability?.enquiryOnly === true)
    return true;
  return !checkAshramBookingAvailable(ashram);
};

