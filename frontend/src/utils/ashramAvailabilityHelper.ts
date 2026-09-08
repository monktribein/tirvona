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
 * Whether guests can currently book this ashram.
 * `ashram.bookingPaused` is set by the owner from their dashboard and
 * cleared only after Super Admin approval (see decideResumeRequest).
 */
export const checkAshramBookingAvailable = (ashram: any): boolean => {
  if (!ashram) return true;
  if (ashram.bookingPaused === true) return false;
  if (ashram.discovery?.bookingAvailability?.checkedForDates) {
    return Boolean(ashram.discovery.bookingAvailability.available);
  }
  return true;
};
