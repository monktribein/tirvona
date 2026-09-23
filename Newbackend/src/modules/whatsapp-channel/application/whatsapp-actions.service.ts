import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AshramsService } from "../../ashrams/application/ashrams.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BookingsService } from "../../bookings/application/bookings.service";
import { BookingPaymentLinkService } from "../../bookings/application/booking-payment-link.service";
import { OffersService } from "../../bookings/application/offers.service";
import { ParkingBookingService } from "../../parking/application/parking-booking.service";
import { ParkingDiscoveryService } from "../../parking/application/parking-discovery.service";
import { ParkingPaymentLinkService } from "../../parking/application/parking-payment-link.service";
import { RefundsService } from "../../refunds/application/refunds.service";
import {
  actorFromResolvedIdentity,
  type BookingActor,
  type WhatsAppResolvedIdentity,
} from "../../bookings/domain/booking-customer";
import { buildBookingDto, type StayBookingInput } from "./stay-booking-payload";

/** A property, reduced to what a guest is shown. Every field is stored data. */
export interface PropertyDetails {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  description: string;
  amenities: string[];
  nearby: { name: string; distance?: string }[];
  policies: {
    checkInTime?: string;
    checkOutTime?: string;
    minStay?: number;
    maxStay?: number;
    cancellationPolicy?: string;
  };
  addOns: {
    id: string;
    name: string;
    price: number;
    unit?: string;
    unitLabel?: string;
    maxQuantity?: number;
  }[];
}

/**
 * One page of a database-backed list. The rows are an ordinary array, so a
 * caller that only wants the rows can ignore the paging fields.
 */
export type PagedRows<T = any> = T[] & { page: number; totalPages: number };

/** Rows per WhatsApp list page, leaving room for "previous" and "next" rows (Meta allows 10). */
export const LIST_PAGE_SIZE = 8;

/** The outcome of trying a coupon: applied with a quote, or refused with the reason. */
export type PromoResult =
  | { ok: true; quote: any; offer: any; discountAmount: number }
  | { ok: false; reason: string };

/**
 * The only place the WhatsApp channel touches Tirvona's domain.
 *
 * Every action here is a thin adapter over an existing service. Nothing in
 * this file computes availability, prices a stay, decides a refund or writes
 * a booking document — those rules live in the services the website already
 * calls, and duplicating any of them here would mean two answers to the same
 * question.
 *
 * This is also the security boundary. An action always:
 *   1. receives the verified WhatsApp identity, never one from message text;
 *   2. re-validates its parameters;
 *   3. checks ownership by loading the record and comparing its identity;
 *   4. lets the domain service enforce the business rules;
 *   5. returns plain data for the conversation layer to phrase.
 *
 * A booking reference a guest types is treated as a hint about which of
 * *their* bookings they mean — never as authorization.
 */
@Injectable()
export class WhatsAppActionsService {
  private readonly logger = new Logger(WhatsAppActionsService.name);

  constructor(
    private readonly ashrams: AshramsService,
    private readonly bookings: BookingsService,
    private readonly offers: OffersService,
    private readonly refunds: RefundsService,
    private readonly links: BookingPaymentLinkService,
    private readonly parkingDiscovery: ParkingDiscoveryService,
    private readonly parkingBookings: ParkingBookingService,
    private readonly parkingLinks: ParkingPaymentLinkService,
    private readonly config: ConfigService,
  ) {}

  private actor(identity: WhatsAppResolvedIdentity): BookingActor {
    return actorFromResolvedIdentity(identity);
  }

  /**
   * Stays matching a place, optionally narrowed by dates and a guest count —
   * one page at a time.
   *
   * Delegates to the same `publicList` the website's search page calls, so
   * the results, the ranking and the availability filtering are identical,
   * and a stay an admin approves a minute ago is in the very next search.
   * Dates and guests are optional so the same method serves both a plain
   * browse ("Vrindavan mein chahiye") and a dated search. Nothing is cached:
   * "next page" runs the query again for that page, and the authoritative
   * availability check still happens when the booking is created.
   */
  async searchStays(input: {
    place?: string;
    checkIn?: Date;
    checkOut?: Date;
    guests?: number;
    page?: number;
  }): Promise<PagedRows> {
    const page = Math.max(1, Math.floor(Number(input.page) || 1));
    // Field names match AshramQueryDto exactly (`checkIn`/`checkOut` as
    // YYYY-MM-DD) — the same query the website's search page sends, so the
    // date availability filter in `discoveryDates` actually applies.
    const result: any = await this.ashrams.publicList({
      ...(input.place ? { query: input.place } : {}),
      ...(input.checkIn ? { checkIn: input.checkIn.toISOString().slice(0, 10) } : {}),
      ...(input.checkOut ? { checkOut: input.checkOut.toISOString().slice(0, 10) } : {}),
      ...(input.guests ? { guests: input.guests } : {}),
      page,
      limit: LIST_PAGE_SIZE,
    } as any);
    const rows = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
    const list = (Array.isArray(rows) ? rows.slice(0, LIST_PAGE_SIZE) : []) as PagedRows;
    list.page = page;
    list.totalPages = Math.max(page, Number(result?.totalPages) || 1);
    return list;
  }

  /**
   * The cities Tirvona actually has stays in, most-listed first — the same
   * aggregation the website's destinations page reads. Used so "which place"
   * is a tap, not a blank prompt: nothing here is a guess at what exists.
   */
  async topDestinations(limit = 8): Promise<{ city: string; count: number }[]> {
    const rows = await this.ashrams.destinations();
    return [...rows]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((row) => ({ city: row.city, count: row.count }));
  }

  /**
   * Actual open dates for one room over the next month, through the same
   * public calendar the website's room page reads. Used to answer "which
   * dates are available" — never computed independently of it.
   */
  async availabilityForRoom(roomId: string): Promise<any[]> {
    return this.ashrams.publicCalendar(roomId);
  }

  /**
   * The property as the website's detail page presents it — the same record
   * (`AshramsService.detail`, which also resolves the *enabled* add-on list
   * the pricing service prices against). Reduced to plain fields; nothing is
   * added or invented.
   */
  async propertyDetails(ashramId: string): Promise<PropertyDetails | null> {
    let detail: { ashram: any } | null = null;
    try {
      detail = await this.ashrams.detail(ashramId);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
    const ashram: any = detail?.ashram;
    if (!ashram) return null;
    const address = ashram.address ?? {};
    return {
      id: String(ashram._id),
      name: String(ashram.name ?? ""),
      city: String(address.city ?? ""),
      state: String(address.state ?? ""),
      address: [address.line1, address.line2, address.landmark, address.city, address.pincode]
        .filter(Boolean)
        .join(", "),
      description: String(ashram.description ?? ""),
      amenities: Array.isArray(ashram.amenities) ? ashram.amenities.map(String) : [],
      nearby: (ashram.nearbyAttractions ?? []).map((n: any) => ({
        name: String(n?.name ?? ""),
        distance: n?.distance ? String(n.distance) : undefined,
      })),
      policies: {
        checkInTime: ashram.policies?.checkInTime,
        checkOutTime: ashram.policies?.checkOutTime,
        minStay: ashram.policies?.minStay,
        maxStay: ashram.policies?.maxStay,
        cancellationPolicy: ashram.policies?.cancellationPolicy,
      },
      addOns: (ashram.addOnServices ?? [])
        .map((a: any) => ({
          id: String(a._id ?? a.id ?? ""),
          name: String(a.name ?? ""),
          price: Number(a.price ?? 0),
          unit: a.unit,
          unitLabel: a.unitLabel,
          maxQuantity: a.maxQuantity,
        }))
        .filter((a: any) => a.id && a.name),
    };
  }

  /**
   * Every bookable room category of one ashram, cheapest first.
   *
   * Read through `AshramsService.detail` — the record the website's stay page
   * renders — so only an approved, live property's active rooms come back,
   * and each carries the same `sellingPrice` (the room's own rate discount
   * applied) that `BookingPricingService` charges. A room added or disabled
   * by the owner shows up, or disappears, on the next call.
   *
   * With dates, each category also carries `unitsLeft` — the fewest units
   * open on any night of the stay, read from the very public calendar the
   * website's room page uses, so "3 left" here is the same "3 left" there.
   */
  async roomsFor(
    ashramId: string,
    stay?: { checkIn: Date; checkOut: Date },
  ): Promise<any[]> {
    let detail: { rooms?: any[] } | null = null;
    try {
      detail = await this.ashrams.detail(ashramId);
    } catch (error) {
      if (error instanceof NotFoundException) return [];
      throw error;
    }
    const rooms: any[] = [...(detail?.rooms ?? [])].sort(
      (a, b) =>
        Number(a.sellingPrice ?? a.basePrice ?? 0) -
        Number(b.sellingPrice ?? b.basePrice ?? 0),
    );
    if (!stay) return rooms;
    const lastNight = new Date(stay.checkOut.getTime() - 86_400_000);
    return Promise.all(
      rooms.map(async (room) => {
        const calendar = await this.ashrams
          .publicCalendar(
            String(room._id),
            stay.checkIn.toISOString().slice(0, 10),
            lastNight.toISOString().slice(0, 10),
          )
          .catch(() => null);
        // No calendar means availability is unknown, not zero — the booking
        // service still decides authoritatively when the hold is taken.
        if (!calendar) return { ...room, unitsLeft: null };
        const nights = calendar.filter((day: any) => {
          const key = String(day.date).slice(0, 10);
          return (
            key >= stay.checkIn.toISOString().slice(0, 10) &&
            key <= lastNight.toISOString().slice(0, 10)
          );
        });
        const unitsLeft = nights.length
          ? Math.min(
              ...nights.map((day: any) =>
                day.isClosed ? 0 : Number(day.available ?? 0),
              ),
            )
          : null;
        return { ...room, unitsLeft };
      }),
    );
  }

  /**
   * Offers running for this property — the same list the website shows on
   * the stay page. Whether one applies to a particular stay is decided only
   * when it is tried (`applyPromo`), by the same offers service.
   */
  async listOffers(ashramId: string): Promise<any[]> {
    const rows = await this.offers.active({
      ashramId,
      status: "active",
      targetRoute: "stays",
      limit: "10",
    });
    return rows.map((offer: any) => ({
      id: String(offer._id),
      promoCode: String(offer.promoCode ?? ""),
      title: String(offer.offerTitle ?? offer.title ?? offer.promoCode ?? ""),
      discountType: String(offer.discountType ?? ""),
      discountValue: Number(offer.discountValue ?? 0),
      maximumDiscount: Number(offer.maximumDiscount ?? 0),
      minimumBookingAmount: Number(offer.minimumBookingAmount ?? 0),
      validTill: offer.validTill ?? null,
      roomId: offer.roomId ? String(offer.roomId) : null,
    }));
  }

  /**
   * Prices a stay through the same service the website's checkout uses, so
   * the tax, platform fee, add-ons and any coupon are computed once, in one
   * place. The input is turned into the website's own request structure by
   * `buildBookingDto`; WhatsApp never adds or adjusts a number it was given.
   */
  async quoteStay(input: StayBookingInput): Promise<any> {
    return this.bookings.quote(buildBookingDto(input) as any);
  }

  /**
   * Tries a coupon exactly as the website does: first the offers service
   * validates the code against the stay's gross payable amount (which is why
   * a quote without the code is taken first), then the booking pricing
   * service prices the stay with the code applied. A refusal from either
   * carries the service's own reason.
   *
   * A code that validates but takes nothing off (a "free upgrade" style
   * offer) is not applied: it would use up a redemption and change no price,
   * and the guest would be told a coupon "worked" that did nothing.
   */
  async applyPromo(input: StayBookingInput & { promoCode: string }): Promise<PromoResult> {
    try {
      const base = await this.bookings.quote(
        buildBookingDto({ ...input, promoCode: undefined, appliedOfferId: undefined }) as any,
      );
      const validated = await this.offers.validate({
        promoCode: input.promoCode,
        bookingAmount: Number(base?.pricing?.totalAmount ?? 0),
        ashramId: input.ashramId,
      } as any);
      const quote = await this.bookings.quote(
        buildBookingDto({ ...input, appliedOfferId: undefined }) as any,
      );
      const discountAmount = Number(quote?.pricing?.discountAmount ?? 0);
      if (discountAmount <= 0)
        return {
          ok: false,
          reason: "This offer does not reduce the price of this stay.",
        };
      return { ok: true, quote, offer: validated.offer, discountAmount };
    } catch (error) {
      if (error instanceof BadRequestException)
        return { ok: false, reason: String(error.message) };
      throw error;
    }
  }

  /**
   * Creates the booking through `BookingsService.create` — the same method
   * the website calls. The inventory hold, the identity code, the coupon
   * reservation, the outbox row and the audit entry all happen inside that
   * service's transaction, so a WhatsApp booking consumes the same inventory
   * and produces the same records as any other.
   */
  async createStayBooking(
    identity: WhatsAppResolvedIdentity,
    input: StayBookingInput,
  ): Promise<any> {
    const booking = await this.bookings.create(
      this.actor(identity),
      buildBookingDto(input) as any,
    );
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.booking_created",
        identityKind: identity.kind,
        // Only ever one of these two is present.
        wappId: identity.displayId ?? undefined,
        userId: identity.userId ?? undefined,
        bookingId: booking?.bookingId,
        channel: "whatsapp",
      }),
    );
    return booking;
  }

  /**
   * A signed, short-lived link to Tirvona's public payment page for a booking
   * the guest owns.
   *
   * The link carries only a signed capability for that one booking; the page
   * loads the booking, takes the amount and opens the Razorpay order on the
   * server. Nothing is charged and no order is created here, and the booking
   * is never marked paid by this call — confirmation comes from
   * `confirmPayment` and the verified Razorpay webhook. A guest saying
   * "payment ho gaya" changes nothing.
   */
  async createPaymentLink(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
  ): Promise<{
    url: string;
    amount: number;
    reference: string;
    expiresAt: Date;
  }> {
    return this.links.issue(this.actor(identity), bookingId);
  }

  /**
   * Where the refund stands for each of this customer's cancelled bookings —
   * what the cancellation decided, the refund record it opened, and any
   * review/payout request. Read from `RefundsService`, which checks ownership
   * against the booking's own identity; nothing is inferred here.
   */
  async refundStatuses(identity: WhatsAppResolvedIdentity): Promise<any[]> {
    const bookings = (await this.myStayBookings(identity)).filter((booking: any) =>
      ["cancelled", "refunded"].includes(booking.status),
    );
    const statuses = await Promise.all(
      bookings.slice(0, 5).map((booking: any) =>
        this.refunds
          .statusForBooking(this.actor(identity), String(booking._id))
          .catch(() => null),
      ),
    );
    return statuses.filter(Boolean);
  }

  /** The refund state of one of this customer's own bookings. */
  async refundStatusFor(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
  ): Promise<any> {
    return this.refunds.statusForBooking(this.actor(identity), bookingId);
  }

  /** Every stay booking belonging to this identity, account or guest alike. */
  async myStayBookings(
    identity: WhatsAppResolvedIdentity,
  ): Promise<any[]> {
    return this.bookings.historyFor({
      userId: identity.userId,
      whatsappCustomerId: identity.whatsappCustomerId,
    });
  }

  /**
   * One booking, but only if it belongs to this customer. `BookingsService.get`
   * performs the ownership check itself against the booking's own identity and
   * reports anything else as not found.
   */
  async getBooking(
    identity: WhatsAppResolvedIdentity,
    idOrReference: string,
  ): Promise<any> {
    return this.bookings.get(idOrReference, this.actor(identity));
  }

  /**
   * Cancels a booking through the existing cancellation service, which owns
   * the policy, the refund calculation, the inventory release and the
   * commission reversal. WhatsApp contributes only the guest's confirmation.
   */
  async cancelBooking(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
    reason: string,
  ): Promise<{ booking: any; refundAmount: number }> {
    const booking = await this.bookings.get(bookingId, this.actor(identity));
    const result = await this.bookings.cancel(
      String(booking._id),
      this.actor(identity),
      { reason } as any,
    );
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.booking_cancelled",
        identityKind: identity.kind,
        wappId: identity.displayId ?? undefined,
        userId: identity.userId ?? undefined,
        bookingId: booking?.bookingId,
      }),
    );
    return result;
  }

  // ---- parking --------------------------------------------------------

  /**
   * Parking locations matching a place, one page at a time — the same
   * `ParkingDiscoveryService.search` the website's Parking Hub calls, so a
   * location an admin just approved is found on the very next search.
   */
  async searchParking(input: {
    place?: string;
    entryAt?: string;
    exitAt?: string;
    vehicleType?: string;
    page?: number;
  }): Promise<PagedRows> {
    const page = Math.max(1, Math.floor(Number(input.page) || 1));
    const result = await this.parkingDiscovery.search({
      ...(input.place ? { destination: input.place } : {}),
      ...(input.entryAt ? { entryAt: input.entryAt } : {}),
      ...(input.exitAt ? { exitAt: input.exitAt } : {}),
      ...(input.vehicleType ? { vehicleType: input.vehicleType } : {}),
      page,
      limit: LIST_PAGE_SIZE,
    } as any);
    const rows = (Array.isArray(result?.data) ? result.data : []) as PagedRows;
    rows.page = Number(result?.page) || page;
    rows.totalPages = Math.max(rows.page, Number(result?.totalPages) || 1);
    return rows;
  }

  /**
   * One parking location's bay categories, priced for the given window and
   * vehicle type — the same `ParkingDiscoveryService.detail` the website's
   * location page reads, so "3 bays left, ₹80/hr" here is the same figure
   * there.
   */
  async parkingLocationDetail(
    idOrSlug: string,
    input: { entryAt?: string; exitAt?: string; vehicleType?: string } = {},
  ): Promise<any | null> {
    return this.parkingDiscovery.detail(idOrSlug, input);
  }

  /**
   * Prices one bay for one window and vehicle, through the same pricing
   * service the public quote endpoint uses. WhatsApp never computes a
   * parking fee itself.
   */
  async quoteParking(input: {
    locationId: string;
    slotTypeId: string;
    vehicleType: string;
    entryAt: string;
    exitAt: string;
  }): Promise<{ ok: true; quote: any } | { ok: false; message: string }> {
    return this.parkingDiscovery.quote(input);
  }

  /**
   * Holds a bay through `ParkingBookingService.createFor` — the same method
   * the website calls, so the atomic inventory hold, the pricing and the
   * cancellation policy are identical whichever channel booked.
   */
  async createParkingBooking(
    identity: WhatsAppResolvedIdentity,
    dto: {
      locationId: string;
      slotTypeId: string;
      vehicleType: string;
      vehicleNumber: string;
      entryAt: string;
      exitAt: string;
      driverName?: string;
      driverPhone?: string;
    },
  ): Promise<any> {
    const result = await this.parkingBookings.createFor(this.actor(identity), dto as any);
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.parking_booking_created",
        identityKind: identity.kind,
        wappId: identity.displayId ?? undefined,
        userId: identity.userId ?? undefined,
        bookingReference: result?.booking?.bookingReference,
        channel: "whatsapp",
      }),
    );
    return result;
  }

  /**
   * A signed, short-lived link to Tirvona's public parking payment page —
   * the parking equivalent of `createPaymentLink`. The order is opened and
   * the payment confirmed only by the server; nothing here charges anything.
   */
  async createParkingPaymentLink(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
  ): Promise<{ url: string; amount: number; reference: string; expiresAt: Date }> {
    return this.parkingLinks.issue(this.actor(identity), bookingId);
  }

  /** Every parking booking belonging to this identity, account or guest alike. */
  async myParkingBookings(
    identity: WhatsAppResolvedIdentity,
    status: string | undefined,
    page: number,
  ): Promise<{ items: any[]; total: number }> {
    return this.parkingBookings.listMineFor(this.actor(identity), status, page, LIST_PAGE_SIZE);
  }

  /** One parking booking, but only if it belongs to this customer. */
  async getParkingBooking(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
  ): Promise<any> {
    return this.parkingBookings.getFor(this.actor(identity), bookingId);
  }

  /** What cancelling this parking booking now would refund, without cancelling it. */
  async previewParkingCancellation(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
  ): Promise<any> {
    return this.parkingBookings.refundPreviewFor(this.actor(identity), bookingId);
  }

  /**
   * Cancels a parking booking through the existing cancellation service,
   * which owns the refund policy, the bay release and the commission
   * reversal. WhatsApp contributes only the guest's confirmation.
   */
  async cancelParkingBooking(
    identity: WhatsAppResolvedIdentity,
    bookingId: string,
    reason: string,
  ): Promise<{ booking: any; refund: any }> {
    const result = await this.parkingBookings.cancelFor(
      this.actor(identity),
      bookingId,
      { reason } as any,
    );
    this.logger.log(
      JSON.stringify({
        event: "whatsapp.parking_booking_cancelled",
        identityKind: identity.kind,
        wappId: identity.displayId ?? undefined,
        userId: identity.userId ?? undefined,
        bookingId,
      }),
    );
    return result;
  }

  /**
   * What a cancellation would refund, without cancelling anything.
   *
   * Asks `BookingsService.previewCancellation`, which runs the same ownership
   * check and the same `computeCancellationRefund` that `cancel` runs — so the
   * figure quoted in chat is the figure the guest then gets. WhatsApp holds no
   * copy of the refund rule.
   */
  async previewCancellationRefund(
    identity: WhatsAppResolvedIdentity,
    booking: any,
  ): Promise<number> {
    const preview = await this.bookings.previewCancellation(
      String(booking._id),
      this.actor(identity),
    );
    return preview.refundAmount;
  }
}
