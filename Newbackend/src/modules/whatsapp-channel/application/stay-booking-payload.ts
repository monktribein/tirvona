import type { FlatService } from "./stay-selection";

/**
 * What a WhatsApp guest has chosen, as the booking domain expects to be told.
 *
 * `buildBookingDto` is the one place this becomes a `CreateBookingDto`, and it
 * reproduces exactly what the website sends from `AshramDetailPage` — the
 * `rooms[{roomId, units}]` list, `roomsBookedCount`, the `services` object
 * with `selectedAddOns` and the four flat services, `promoCode`, and
 * `specialRequests`. It computes no price: the same structure is handed to
 * `BookingsService.quote` and `BookingsService.create`, which price it.
 */
export interface StayBookingInput {
  ashramId: string;
  rooms: { roomId: string; units: number }[];
  checkIn: Date;
  checkOut: Date;
  /** Total guests — adults plus children. The backend takes only the total. */
  guests: number;
  promoCode?: string;
  appliedOfferId?: string;
  addOns?: { serviceId: string; quantity: number }[];
  services?: Partial<Record<FlatService, boolean>>;
  /** Free text kept on the booking, e.g. the arrival and departure times asked for. */
  specialRequests?: string;
  guestName?: string;
}

/** The backend's own ceiling on `roomsBookedCount` (see `CreateBookingDto`). */
const MAX_ROOMS_BOOKED = 20;

export const totalUnits = (rooms: { units: number }[]): number =>
  rooms.reduce((sum, room) => sum + Math.max(0, Math.floor(room.units)), 0);

export const roomsBookedCountFor = (rooms: { units: number }[]): number =>
  Math.min(MAX_ROOMS_BOOKED, Math.max(1, totalUnits(rooms)));

export const buildBookingDto = (input: StayBookingInput): Record<string, any> => {
  const services = input.services ?? {};
  return {
    ashramId: input.ashramId,
    rooms: input.rooms.map((room) => ({
      roomId: room.roomId,
      units: room.units,
    })),
    // The website also sends the first selected room as `roomId`.
    roomId: input.rooms[0]?.roomId,
    roomsBookedCount: roomsBookedCountFor(input.rooms),
    checkInDate: input.checkIn.toISOString(),
    checkOutDate: input.checkOut.toISOString(),
    guestsCount: Math.max(1, input.guests),
    services: {
      selectedAddOns: (input.addOns ?? []).map((addOn) => ({
        serviceId: addOn.serviceId,
        quantity: addOn.quantity,
      })),
      prasad: { ordered: Boolean(services.prasad) },
      meals: { ordered: Boolean(services.meals) },
      parking: { ordered: Boolean(services.parking) },
      locker: { ordered: Boolean(services.locker) },
    },
    ...(input.promoCode ? { promoCode: input.promoCode.trim().toUpperCase() } : {}),
    ...(input.appliedOfferId ? { appliedOfferId: input.appliedOfferId } : {}),
    ...(input.specialRequests ? { specialRequests: input.specialRequests } : {}),
    guests: input.guestName ? [{ name: input.guestName, isPrimary: true }] : [],
  };
};
