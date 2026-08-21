import { useCallback, useEffect, useMemo, useState } from "react";
import { bookingService } from "../services";
import { parkingBookingService } from "../modules/parking/services/parking.service";
import { getErrorMessage } from "../lib/api";

export type BookingKind = "stay" | "parking";
export type BookingCategory = "upcoming" | "completed" | "cancelled";

export interface UnifiedBooking {
  kind: BookingKind;
  id: string;
  reference: string;
  reservationNumber?: string;
  assignedRoomNumber?: string;
  paymentMode?: string;
  specialRequests?: string;
  addOnsList?: any[];
  title: string;
  location: string;
  image?: string;
  start: string;
  end: string;
  meta: string;
  amount: number;
  amountPaid: number;
  status: string;
  paymentStatus?: string;
  category: BookingCategory;
  detailHref?: string;
  checkInCode?: string;
  slotNumber?: string;
  cancellationReason?: string;
  refundAmount?: number;
  createdAt: string;
  cancellable: boolean;
  rawBooking?: any;
}

const STAY_CATEGORY: Record<string, BookingCategory> = {
  pending: "upcoming",
  confirmed: "upcoming",
  checked_in: "upcoming",
  checked_out: "completed",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "cancelled",
  no_show: "cancelled",
};

const PARKING_CATEGORY: Record<string, BookingCategory> = {
  pending: "upcoming",
  upcoming: "upcoming",
  checked_in: "upcoming",
  checked_out: "completed",
  cancelled: "cancelled",
  expired: "cancelled",
  no_show: "cancelled",
};

const joinAddress = (address?: Record<string, string | undefined>) =>
  [address?.city, address?.state].filter(Boolean).join(", ");

const fromStay = (b: any): UnifiedBooking => {
  const ashram = typeof b.ashramId === "object" ? b.ashramId : null;
  const room = typeof b.roomId === "object" ? b.roomId : null;
  const status = String(b.status || "pending");

  return {
    kind: "stay",
    id: b._id,
    reference: b.bookingId || b._id,
    reservationNumber: b.reservationNumber,
    assignedRoomNumber: b.assignedRoomNumber,
    paymentMode: b.paymentMode || "pay_at_ashram",
    specialRequests: b.specialRequests,
    addOnsList: b.services?.selectedAddOns || [],
    title: ashram?.name || "Ashram stay",
    location: joinAddress(ashram?.address),
    image: ashram?.images?.[0],
    start: b.checkInDate,
    end: b.checkOutDate,
    meta: [
      `${b.guestsCount || 1} guest${(b.guestsCount || 1) === 1 ? "" : "s"}`,
      room?.name,
      b.roomsBookedCount > 1 ? `${b.roomsBookedCount} rooms` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    amount: b.pricing?.totalAmount ?? b.pricing?.finalAmount ?? 0,
    amountPaid: b.pricing?.amountPaid ?? 0,
    status,
    paymentStatus: b.paymentStatus,
    category: STAY_CATEGORY[status] || "upcoming",
    detailHref: `/booking/${b._id}`,
    checkInCode: status === "confirmed" ? b.checkInCode : undefined,
    cancellationReason: b.cancellation?.reason,
    refundAmount: b.cancellation?.refundAmount,
    createdAt: b.createdAt,
    cancellable: ["pending", "confirmed"].includes(status),
    rawBooking: b,
  };
};

const fromParking = (b: any): UnifiedBooking => {
  const location = typeof b.locationId === "object" ? b.locationId : null;
  const status = String(b.status || "pending");

  return {
    kind: "parking",
    id: b._id,
    reference: b.bookingReference || b._id,
    title: location?.name || "Parking booking",
    location: joinAddress(location?.address),
    image: location?.coverImage || location?.images?.[0],
    start: b.entryAt,
    end: b.exitAt,
    meta: [b.vehicleNumber, String(b.vehicleType || "").replace(/_/g, " ")]
      .filter(Boolean)
      .join(" · "),
    amount: b.pricing?.totalAmount ?? 0,
    amountPaid: b.pricing?.amountPaid ?? 0,
    status,
    paymentStatus: b.paymentStatus,
    category: PARKING_CATEGORY[status] || "upcoming",
    detailHref: `/parking/booking/${b._id}`,
    slotNumber: b.assignedSlotNumber || undefined,
    cancellationReason: b.cancellation?.reason,
    refundAmount: b.cancellation?.refundAmount,
    createdAt: b.createdAt,
    cancellable: ["pending", "upcoming"].includes(status),
  };
};

export interface UseMyBookingsResult {
  bookings: UnifiedBooking[];
  loading: boolean;
  error: string;
  partialFailures: string[];
  counts: Record<BookingCategory, number> & {
    total: number;
    stays: number;
    parking: number;
  };
  refresh: () => Promise<void>;
}

export const useMyBookings = (enabled = true): UseMyBookingsResult => {
  const [bookings, setBookings] = useState<UnifiedBooking[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [partialFailures, setPartialFailures] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setPartialFailures([]);

    const [stayRes, parkingRes] = await Promise.allSettled([
      bookingService.history(),
      parkingBookingService.list({ limit: 100 }),
    ]);

    const merged: UnifiedBooking[] = [];
    const failed: string[] = [];

    if (stayRes.status === "fulfilled" && stayRes.value.data?.success) {
      merged.push(...(stayRes.value.data.data || []).map(fromStay));
    } else if (stayRes.status === "rejected") {
      failed.push("stays");
    }

    if (parkingRes.status === "fulfilled" && parkingRes.value.data?.success) {
      merged.push(...(parkingRes.value.data.data || []).map(fromParking));
    } else if (parkingRes.status === "rejected") {
      failed.push("parking");
    }

    if (failed.length === 2) {
      const reason = stayRes.status === "rejected" ? stayRes.reason : null;
      setError(
        getErrorMessage(reason, "Could not load your bookings right now."),
      );
      setBookings([]);
    } else {
      merged.sort(
        (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
      );
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
      if (b.kind === "stay") base.stays += 1;
      else base.parking += 1;
    });
    return base;
  }, [bookings]);

  return { bookings, loading, error, partialFailures, counts, refresh: load };
};

export default useMyBookings;
