import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import type { Model } from "mongoose";
import { AshramsService } from "../../ashrams/application/ashrams.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BookingsService } from "../../bookings/application/bookings.service";
import { BookingPaymentLinkService } from "../../bookings/application/booking-payment-link.service";
import { OffersService } from "../../bookings/application/offers.service";
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
    private readonly config: ConfigService,
    @InjectModel("Room") private readonly rooms: Model<any>,
  ) {}

  private actor(identity: WhatsAppResolvedIdentity): BookingActor {
    return actorFromResolvedIdentity(identity);
  }

  /**
   * Stays matching a place and a date range.
   *
   * Delegates to the same `publicList` the website's search page calls, so
   * the results, the ranking and the availability filtering are identical.
   * Nothing is cached: a chat result is a snapshot, and the authoritative
   * check happens when the booking is created.
   */
  /**
   * Stays matching a place, optionally narrowed by dates and a guest count.
   *
   * Dates and guests are optional so the same method serves two distinct
   * conversation modes: a plain browse ("Vrindavan mein chahiye", "asharam ka
   * list do" — item 9's DISCOVER step, no dates demanded yet) and a dated
   * search once the guest has actually given check-in/check-out ("kal 4 baje
   * ... agle din 11 baje"). Both go through the identical website search —
   * discovery is not a second, lesser search implementation, just this one
   * called with fewer filters.
   */
  async searchStays(input: {
    place?: string;
    checkIn?: Date;
    checkOut?: Date;
    guests?: number;
  }): Promise<any[]> {
    // Field names match AshramQueryDto exactly (`checkIn`/`checkOut` as
    // YYYY-MM-DD) — the same query the website's search page sends, so the
    // date availability filter in `discoveryDates` actually applies.
    const result: any = await this.ashrams.publicList({
      ...(input.place ? { query: input.place } : {}),
      ...(input.checkIn ? { checkIn: input.checkIn.toISOString().slice(0, 10) } : {}),
      ...(input.checkOut ? { checkOut: input.checkOut.toISOString().slice(0, 10) } : {}),
      ...(input.guests ? { guests: input.guests } : {}),
      page: 1,
      limit: 8,
    } as any);
    const rows = Array.isArray(result) ? result : (result?.data ?? result?.items ?? []);
    return Array.isArray(rows) ? rows.slice(0, 8) : [];
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
   * Bookable room categories for one ashram.
   *
   * With dates, each category also carries `unitsLeft` — the fewest units
   * open on any night of the stay, read from the very public calendar the
   * website's room page uses, so "3 left" here is the same "3 left" there.
   */
  async roomsFor(
    ashramId: string,
    stay?: { checkIn: Date; checkOut: Date },
  ): Promise<any[]> {
    const rooms: any[] = await this.rooms
      .find({ ashramId, status: "active", deletedAt: null })
      .select(
        "_id name type acType capacity basePrice pricePerNight totalInventory amenities description",
      )
      .sort({ basePrice: 1 })
      .limit(10)
      .lean();
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
