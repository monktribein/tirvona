import { useCallback, useEffect, useMemo, useState } from 'react';
import { bookingService } from '../services';
import { parkingBookingService } from '../modules/parking/services/parking.service';
import { getErrorMessage } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// The signed-in visitor's bookings, from every booking engine on the platform.
//
// Today that is ashram stays (`/api/bookings/history`) and parking
// (`/api/parking/bookings`). The two engines are deliberately independent
// server-side, so they are merged here rather than by a combined endpoint —
// which also means a future engine only has to be added in this one place.
//
// Each source is fetched independently and a failure in one does not blank the
// other: if parking is unreachable, the visitor still sees their stays.
// ─────────────────────────────────────────────────────────────────────────────

export type BookingKind = 'stay' | 'parking';
export type BookingCategory = 'upcoming' | 'completed' | 'cancelled';

export interface UnifiedBooking {
  kind: BookingKind;
  /** Mongo _id, used for actions. */
  id: string;
  /** Human reference, e.g. TVN-BK-88219 or TVN-PKG-7H2K9QD4. */
  reference: string;
  reservationNumber?: string;
  assignedRoomNumber?: string;
  paymentMode?: string;
  specialRequests?: string;
  addOnsList?: any[];
  title: string;
  location: string;
  image?: string;
  /** Check-in / entry. */
  start: string;
  /** Check-out / exit. */
  end: string;
  /** One-line summary: guests + room, or plate + vehicle class. */
  meta: string;
  amount: number;
  amountPaid: number;
  status: string;
  paymentStatus?: string;
  category: BookingCategory;
  /** Where "View" goes. */
  detailHref?: string;
  /** The 6-digit desk code for a confirmed stay. */
  checkInCode?: string;
  /** Assigned bay, once a parking booking is checked in. */
  slotNumber?: string;
  cancellationReason?: string;
  refundAmount?: number;
  createdAt: string;
  /** Whether the visitor may still cancel it themselves. */
  cancellable: boolean;
  rawBooking?: any;
}

/** Ashram booking lifecycle → the three tabs. */
const STAY_CATEGORY: Record<string, BookingCategory> = {
  pending: 'upcoming',
  confirmed: 'upcoming',
  checked_in: 'upcoming',
  checked_out: 'completed',
  completed: 'completed',
  cancelled: 'cancelled',
  refunded: 'cancelled',
  no_show: 'cancelled',
};

/** Parking booking lifecycle → the same three tabs. */
const PARKING_CATEGORY: Record<string, BookingCategory> = {
  pending: 'upcoming',
  upcoming: 'upcoming',
  checked_in: 'upcoming',
  checked_out: 'completed',
  cancelled: 'cancelled',
  expired: 'cancelled',
  no_show: 'cancelled',
};

const joinAddress = (address?: Record<string, string | undefined>) =>
  [address?.city, address?.state].filter(Boolean).join(', ');

/** Map an ashram booking document onto the shared shape. */
const fromStay = (b: any): UnifiedBooking => {
  const ashram = typeof b.ashramId === 'object' ? b.ashramId : null;
  const room = typeof b.roomId === 'object' ? b.roomId : null;
  const status = String(b.status || 'pending');

  return {
    kind: 'stay',
    id: b._id,
    reference: b.bookingId || b._id,
    reservationNumber: b.reservationNumber,
    assignedRoomNumber: b.assignedRoomNumber,
    paymentMode: b.paymentMode || 'pay_at_ashram',
    specialRequests: b.specialRequests,
    addOnsList: b.services?.selectedAddOns || [],
    title: ashram?.name || 'Ashram stay',
    location: joinAddress(ashram?.address),
    image: ashram?.images?.[0],
    start: b.checkInDate,
    end: b.checkOutDate,
    meta: [
      `${b.guestsCount || 1} guest${(b.guestsCount || 1) === 1 ? '' : 's'}`,
      room?.name,
      b.roomsBookedCount > 1 ? `${b.roomsBookedCount} rooms` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    amount: b.pricing?.totalAmount ?? b.pricing?.finalAmount ?? 0,
    amountPaid: b.pricing?.amountPaid ?? 0,
    status,
    paymentStatus: b.paymentStatus,
    category: STAY_CATEGORY[status] || 'upcoming',
    detailHref: `/booking/${b._id}`,
    // Only worth showing while it can still be used at the desk.
    checkInCode: status === 'confirmed' ? b.checkInCode : undefined,
    cancellationReason: b.cancellation?.reason,
    refundAmount: b.cancellation?.refundAmount,
    createdAt: b.createdAt,
    cancellable: ['pending', 'confirmed'].includes(status),
    rawBooking: b,
  };
};

/** Map a parking booking document onto the shared shape. */
const fromParking = (b: any): UnifiedBooking => {
  const location = typeof b.locationId === 'object' ? b.locationId : null;
  const status = String(b.status || 'pending');

  return {
    kind: 'parking',
    id: b._id,
    reference: b.bookingReference || b._id,
    title: location?.name || 'Parking booking',
    location: joinAddress(location?.address),
    image: location?.coverImage || location?.images?.[0],
    start: b.entryAt,
    end: b.exitAt,
    meta: [b.vehicleNumber, String(b.vehicleType || '').replace(/_/g, ' ')].filter(Boolean).join(' · '),
    amount: b.pricing?.totalAmount ?? 0,
    amountPaid: b.pricing?.amountPaid ?? 0,
    status,
    paymentStatus: b.paymentStatus,
    category: PARKING_CATEGORY[status] || 'upcoming',
    detailHref: `/parking/booking/${b._id}`,
    slotNumber: b.assignedSlotNumber || undefined,
    cancellationReason: b.cancellation?.reason,
    refundAmount: b.cancellation?.refundAmount,
    createdAt: b.createdAt,
    cancellable: ['pending', 'upcoming'].includes(status),
  };
};

export interface UseMyBookingsResult {
  bookings: UnifiedBooking[];
  loading: boolean;
  /** Set only when EVERY source failed; a partial failure is reported below. */
  error: string;
  /** Names of the sources that failed, so the UI can say what is missing. */
  partialFailures: string[];
  counts: Record<BookingCategory, number> & { total: number; stays: number; parking: number };
  refresh: () => Promise<void>;
}

export const useMyBookings = (enabled = true): UseMyBookingsResult => {
  const [bookings, setBookings] = useState<UnifiedBooking[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [partialFailures, setPartialFailures] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setPartialFailures([]);

    // allSettled, not all: one engine being down must not blank the other.
    const [stayRes, parkingRes] = await Promise.allSettled([
      bookingService.history(),
      parkingBookingService.list({ limit: 100 }),
    ]);

    const merged: UnifiedBooking[] = [];
    const failed: string[] = [];

    if (stayRes.status === 'fulfilled' && stayRes.value.data?.success) {
      merged.push(...(stayRes.value.data.data || []).map(fromStay));
    } else if (stayRes.status === 'rejected') {
      failed.push('stays');
    }

    if (parkingRes.status === 'fulfilled' && parkingRes.value.data?.success) {
      merged.push(...(parkingRes.value.data.data || []).map(fromParking));
    } else if (parkingRes.status === 'rejected') {
      failed.push('parking');
    }

    // Both down — surface a real error rather than an empty list, which would
    // wrongly read as "you have no bookings".
    if (failed.length === 2) {
      const reason = stayRes.status === 'rejected' ? stayRes.reason : null;
      setError(getErrorMessage(reason, 'Could not load your bookings right now.'));
      setBookings([]);
    } else {
      merged.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
      setBookings(merged);
      setPartialFailures(failed);
    }

    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const base = {
      upcoming: 0,
      completed: 0,
      cancelled: 0,
      total: bookings.length,
      stays: 0,
      parking: 0,
    };
    bookings.forEach((b) => {
      base[b.category] += 1;
      if (b.kind === 'stay') base.stays += 1;
      else base.parking += 1;
    });
    return base;
  }, [bookings]);

  return { bookings, loading, error, partialFailures, counts, refresh: load };
};

export default useMyBookings;
