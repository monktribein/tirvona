import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { citySlug, slugify } from "../../../common/slug/slug.util";
import { PARKING_MODEL } from "../../parking/domain/parking.constants";
import { UrlResolverService } from "./url-resolver.service";

/**
 * Teaches the resolver how every remaining id-based URL maps to its slug form.
 * Ashrams register their own resolver in AshramSlugService; this covers the
 * rest so no module needs to know about the redirect table.
 */
@Injectable()
export class LegacyUrlService implements OnModuleInit {
  constructor(
    private readonly urls: UrlResolverService,
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("AartiSession") private readonly aarti: Model<any>,
    @InjectModel(PARKING_MODEL.Location)
    private readonly parking: Model<any>,
    @InjectModel("MarketplaceProduct")
    private readonly products: Model<any>,
    @InjectModel("VolunteerJob") private readonly volunteerJobs: Model<any>,
    @InjectModel("BookingCoupon") private readonly offers: Model<any>,
    @InjectModel(PARKING_MODEL.Booking)
    private readonly parkingBookings: Model<any>,
    @InjectModel("AartiBooking") private readonly aartiBookings: Model<any>,
    @InjectModel("EventQrCode") private readonly eventPasses: Model<any>,
    @InjectModel("FeaturedBanner") private readonly banners: Model<any>,
  ) {}

  /** Returns an ashram's `{city}/{slug}` pair, or null when it cannot be built. */
  private async ashramParts(ashramId: unknown): Promise<string | null> {
    if (!ashramId) return null;
    const row = await this.ashrams
      .findById(String(ashramId))
      .select("slug citySlug name address")
      .lean();
    if (!row) return null;
    const city =
      citySlug((row as any).address?.city || "") ||
      (row as any).citySlug ||
      "india";
    const slug = (row as any).slug || slugify((row as any).name);
    return slug ? `${city}/${slug}` : null;
  }

  onModuleInit(): void {
    // /events/pass/<id> -> /events/pass/<display code>
    this.urls.register({
      pattern: /^\/events\/pass\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.eventPasses
          .findById(match[1])
          .select("displayCode")
          .lean();
        return (row as any)?.displayCode
          ? `/events/pass/${(row as any).displayCode}`
          : null;
      },
    });

    // /featured-banner/<id> -> /featured-banner/<slug>
    this.urls.register({
      pattern: /^\/featured-banner\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.banners
          .findById(match[1])
          .select("slug")
          .lean();
        return (row as any)?.slug
          ? `/featured-banner/${(row as any).slug}`
          : null;
      },
    });

    // /offers/<id> -> /offers/<promo code>
    this.urls.register({
      pattern: /^\/offers\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.offers
          .findById(match[1])
          .select("promoCode")
          .lean();
        return (row as any)?.promoCode
          ? `/offers/${String((row as any).promoCode).toLowerCase()}`
          : null;
      },
    });

    // /volunteer/<id> and /volunteer/job/<id> -> /volunteer/<slug>
    this.urls.register({
      pattern: /^\/volunteer\/(?:job\/)?([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.volunteerJobs
          .findById(match[1])
          .select("slug")
          .lean();
        return (row as any)?.slug ? `/volunteer/${(row as any).slug}` : null;
      },
    });

    // /parking/booking/<id> -> /parking/booking/<reference>
    this.urls.register({
      pattern: /^\/parking\/booking\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.parkingBookings
          .findById(match[1])
          .select("bookingReference")
          .lean();
        return (row as any)?.bookingReference
          ? `/parking/booking/${(row as any).bookingReference}`
          : null;
      },
    });

    // /aarti/booking/<id> -> /aarti/booking/<reference>
    this.urls.register({
      pattern: /^\/aarti\/booking\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.aartiBookings
          .findById(match[1])
          .select("bookingReference")
          .lean();
        return (row as any)?.bookingReference
          ? `/aarti/booking/${(row as any).bookingReference}`
          : null;
      },
    });

    // /profile/bookings/<id> -> /profile/bookings/<reference>
    this.urls.register({
      pattern: /^\/profile\/bookings\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.bookings
          .findById(match[1])
          .select("bookingId")
          .lean();
        return (row as any)?.bookingId
          ? `/profile/bookings/${(row as any).bookingId}`
          : null;
      },
    });

    // /booking/<id> -> /booking/<human reference>
    this.urls.register({
      pattern: /^\/booking\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.bookings
          .findById(match[1])
          .select("bookingId")
          .lean();
        return (row as any)?.bookingId
          ? `/booking/${(row as any).bookingId}`
          : null;
      },
    });

    // /aarti/<id> -> /aarti/<city>/<ashram slug>
    this.urls.register({
      pattern: /^\/aarti\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const session = await this.aarti
          .findById(match[1])
          .select("ashramId")
          .lean();
        const parts = await this.ashramParts((session as any)?.ashramId);
        return parts ? `/aarti/${parts}` : null;
      },
    });

    // /pooja/<id> -> /pooja/<city>/<ashram slug>
    this.urls.register({
      pattern: /^\/pooja\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const session = await this.aarti
          .findById(match[1])
          .select("ashramId")
          .lean();
        const parts = await this.ashramParts((session as any)?.ashramId);
        return parts ? `/pooja/${parts}` : null;
      },
    });

    // /parking/<id> -> /parking/<city>/<ashram slug>, falling back to the
    // location's own slug when the facility is not attached to an ashram.
    this.urls.register({
      pattern: /^\/parking\/([0-9a-f]{24})$/i,
      resolve: async (match) => {
        const row = await this.parking
          .findById(match[1])
          .select("slug ashramId")
          .lean();
        if (!row) return null;
        const parts = await this.ashramParts((row as any).ashramId);
        if (parts) return `/parking/${parts}`;
        return (row as any).slug ? `/parking/${(row as any).slug}` : null;
      },
    });

    // /marketplace/product/<id or slug> -> /marketplace/products/<slug>
    this.urls.register({
      pattern: /^\/marketplace\/product\/([^/]+)$/i,
      resolve: async (match) => {
        const key = match[1];
        const row = await this.products
          .findOne(
            /^[0-9a-f]{24}$/i.test(key) ? { _id: key } : { slug: key },
          )
          .select("slug")
          .lean();
        return (row as any)?.slug
          ? `/marketplace/products/${(row as any).slug}`
          : null;
      },
    });
  }
}
