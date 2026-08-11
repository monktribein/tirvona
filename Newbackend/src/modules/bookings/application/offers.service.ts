import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { roundMoney } from "../domain/booking.utils";
import type {
  SaveOfferDto,
  UpdateOfferDto,
  ValidatePromoDto,
} from "../presentation/dtos/booking.dto";

/** Rows an administrator deleted are invisible to every read path. */
const NOT_DELETED = { deletedAt: null };

/**
 * An expiry date covers the whole of the day it names.
 *
 * The form submits a date with no time, which parses to midnight — so an offer
 * saved as "valid till 10 Aug" expired at the very start of 10 Aug. Every
 * redemption check compares `validTill >= now`, so such a coupon was rejected
 * as invalid from the moment it was created, and its countdown read zero.
 */
const endOfDay = (value: string | Date): Date => {
  const date = new Date(value);
  // A full timestamp is honoured as given; only a bare date is extended.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()))
    date.setHours(23, 59, 59, 999);
  return date;
};

/** The mirror of `endOfDay`: a start date opens at the beginning of its day. */
const startOfDay = (value: string | Date): Date => {
  const date = new Date(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()))
    date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Midnight today, used as the lower bound when filtering on `validTill`.
 *
 * Coupons written before expiries were stored end-of-day carry a midnight
 * stamp, so comparing them against the current instant drops them a full day
 * early. Comparing against the start of today instead honours the rule the
 * date was always meant to express — valid through the day it names — for
 * existing rows as well as new ones, with no migration.
 */
export const startOfToday = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * The instant a stored expiry actually lapses: the end of the day it names.
 *
 * Applied to values already in the database, where a legacy row's midnight
 * stamp would otherwise expire the coupon a day early. Unlike `endOfDay` this
 * extends unconditionally, because a stored `validTill` is always a date the
 * offer is meant to remain usable through.
 */
const redeemableUntil = (value: Date | string): Date => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

@Injectable()
export class OffersService {
  /** What a card needs to name an ashram and link to its booking page. */
  static readonly ASHRAM_CARD_FIELDS = "name slug address.city address.state";

  constructor(
    @InjectModel("BookingCoupon") private readonly offers: Model<any>,
    @InjectModel("BookingOfferRedemption")
    private readonly redemptions: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  /**
   * A malformed id is the caller's mistake, not a server fault.
   *
   * Without this Mongoose raises a CastError deep inside the query and the
   * request surfaces as an opaque 500, which is indistinguishable from a real
   * outage to whoever is looking at the console.
   */
  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("That offer id is not valid");
    return new Types.ObjectId(id);
  }

  active(query: Record<string, string> = {}): Promise<any[]> {
    const filter: any = { ...NOT_DELETED };
    if (query.status !== "all") {
      filter.status = query.status || "active";
      filter.validTill = { $gte: startOfToday() };
      filter.remainingRedemptions = { $gt: 0 };
    }
    if (query.category)
      filter.offerType = { $regex: query.category, $options: "i" };
    if (query.targetRoute) {
      filter.$or = [
        { targetRoute: query.targetRoute },
        { targetRoute: "all" },
        { targetRoute: { $exists: false } },
      ];
    }
    if (query.city)
      filter.applicableCities = { $regex: query.city, $options: "i" };
    return this.offers
      .find(filter)
      .sort({ featured: -1, priority: -1, createdAt: -1 })
      .skip(
        (Math.max(1, Number(query.page) || 1) - 1) *
          Math.min(100, Math.max(1, Number(query.limit) || 20)),
      )
      .limit(Math.min(100, Math.max(1, Number(query.limit) || 20)))
      // The listing card links straight to the ashram the coupon belongs to
      // and prints its city, so the reference has to arrive resolved. Without
      // this it is a bare id and the card can only render a dead link.
      .populate("ashramId", OffersService.ASHRAM_CARD_FIELDS)
      .lean();
  }
  /**
   * @param countView false when an administrator is inspecting the record, so
   * reviewing an offer in the console does not inflate its public view count.
   */
  async one(id: string, countView = true): Promise<any> {
    const _id = this.objectId(id);
    const projection =
      "name address images description history rules amenities";
    const query = countView
      ? this.offers.findOneAndUpdate(
          { _id, ...NOT_DELETED },
          { $inc: { viewsCount: 1 } },
          { new: true },
        )
      : this.offers.findOne({ _id, ...NOT_DELETED });
    const row = await query
      .populate("ashramId", projection)
      .populate("applicableAshrams", projection)
      .lean();
    if (!row) throw new NotFoundException("Offer not found");
    return row;
  }
  async ownerAshrams(user: AuthenticatedUser): Promise<string[]> {
    if (user.role === "super_admin") return [];
    if (user.role === "owner")
      return (
        await this.ashrams
          .find({ ownerId: user.id, deletedAt: null })
          .select("_id")
          .lean()
      ).map((a: any) => String(a._id));
    return [
      ...new Set([
        ...(user.scopedAshramIds ?? []),
        ...(user.employerAshramId ? [user.employerAshramId] : []),
      ]),
    ];
  }
  private async assertOfferScope(
    user: AuthenticatedUser,
    row: any,
  ): Promise<void> {
    if (user.role === "super_admin" || String(row.ownerId) === user.id) return;
    const scope = await this.ownerAshrams(user);
    // `one()` populates the ashram refs, so a reference here may already be a
    // document. Stringifying that yields "[object Object]" and the comparison
    // silently never matches, locking legitimate owners out of their own offer.
    const refId = (value: any): string =>
      String(value?._id ?? value);
    const ids = [row.ashramId, ...(row.applicableAshrams ?? [])]
      .filter(Boolean)
      .map(refId);
    if (!ids.some((id) => scope.includes(id)))
      throw new ForbiddenException("You do not have access to this offer");
  }
  /** Public wrapper over the scope check, for reads the controller has loaded. */
  async assertReadable(user: AuthenticatedUser, row: any): Promise<void> {
    return this.assertOfferScope(user, row);
  }

  async mine(user: AuthenticatedUser): Promise<any[]> {
    // Resolved here too: the console lists which ashram each coupon is bound
    // to, and the edit form preselects that ashram's destination.
    if (user.role === "super_admin")
      return this.offers
        .find(NOT_DELETED)
        .sort({ createdAt: -1 })
        .populate("ashramId", OffersService.ASHRAM_CARD_FIELDS)
        .lean();
    const scope = await this.ownerAshrams(user);
    return this.offers
      .find({
        ...NOT_DELETED,
        $or: [
          { ownerId: user.id },
          { ashramId: { $in: scope } },
          { applicableAshrams: { $in: scope } },
        ],
      })
      .sort({ createdAt: -1 })
      .populate("ashramId", OffersService.ASHRAM_CARD_FIELDS)
      .lean();
  }
  async save(user: AuthenticatedUser, dto: SaveOfferDto): Promise<any> {
    const scope = await this.ownerAshrams(user);
    if (user.role !== "super_admin") {
      // Only the platform may publish a coupon that is valid everywhere.
      // Without this an owner could omit `ashramId` and mint a discount
      // redeemable against every ashram on the platform, including ones they
      // have nothing to do with — the scope check below only fired when an
      // ashram was named, so leaving it out bypassed authorisation entirely.
      if (!dto.ashramId)
        throw new ForbiddenException(
          "Select which of your ashrams this coupon applies to",
        );
      if (!scope.includes(dto.ashramId))
        throw new ForbiddenException("You do not manage this ashram");
    }
    const ashram: any = dto.ashramId
      ? await this.ashrams.findById(dto.ashramId).lean()
      : null;
    const max = dto.maximumRedemptions ?? 100;
    return this.offers.create({
      ...dto.extra,
      ...dto,
      extra: undefined,
      ownerId: ashram?.ownerId ?? user.id,
      promoCode: dto.promoCode.toUpperCase().trim(),
      validTill: endOfDay(dto.validTill),
      ...(dto.validFrom ? { validFrom: startOfDay(dto.validFrom) } : {}),
      ...this.ashramBinding(dto),
      maximumRedemptions: max,
      remainingRedemptions: max,
      deletedAt: null,
      createdBy: user.id,
      status: dto.status ?? "active",
    });
  }

  /**
   * Keep the two ashram fields in agreement.
   *
   * Booking validation checks `ashramId` *and* `applicableAshrams`
   * independently, so a coupon naming one ashram while listing others is
   * unredeemable everywhere. Binding to a single ashram therefore makes it the
   * only entry; clearing the binding removes the restriction from both.
   */
  private ashramBinding(
    dto: SaveOfferDto | UpdateOfferDto,
  ): Record<string, any> {
    if (dto.ashramId === undefined) return {};
    if (!dto.ashramId) return { ashramId: null, applicableAshrams: [] };
    return { ashramId: dto.ashramId, applicableAshrams: [dto.ashramId] };
  }
  /**
   * Load an offer for a write, having checked the caller may touch it.
   *
   * Returns a plain object rather than a hydrated document on purpose. Rows
   * predating this module — anything the generic administration console wrote
   * through its schemaless `Admin_offers` model — can be missing fields the
   * typed schema marks required. Calling `.save()` on one re-validates the
   * whole document and throws, which is what turned every delete into a 500.
   * Every write below is a targeted update instead, so an edit is judged on
   * what it actually changes.
   */
  private async loadForWrite(
    user: AuthenticatedUser,
    id: string,
  ): Promise<any> {
    const row = await this.offers
      .findOne({ _id: this.objectId(id), ...NOT_DELETED })
      .lean();
    if (!row) throw new NotFoundException("Offer not found");
    await this.assertOfferScope(user, row);
    return row;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateOfferDto,
  ): Promise<any> {
    const row = await this.loadForWrite(user, id);
    // Re-binding a coupon to a different ashram is a write against that
    // ashram; owning the coupon is not enough to point it somewhere else.
    // Clearing the binding is likewise reserved to the platform, otherwise an
    // owner could widen their own coupon to every ashram by editing it.
    if (dto.ashramId !== undefined && user.role !== "super_admin") {
      if (!dto.ashramId)
        throw new ForbiddenException(
          "Select which of your ashrams this coupon applies to",
        );
      const scope = await this.ownerAshrams(user);
      if (!scope.includes(dto.ashramId))
        throw new ForbiddenException("You do not manage this ashram");
    }
    const patch: Record<string, any> = {
      ...dto.extra,
      ...dto,
      updatedBy: user.id,
    };
    delete patch.extra;
    // `undefined` in a $set is dropped by Mongoose, but an explicitly cleared
    // optional field has to survive, so only absent keys are stripped.
    for (const key of Object.keys(patch))
      if (patch[key] === undefined) delete patch[key];

    Object.assign(patch, this.ashramBinding(dto));
    if (dto.promoCode !== undefined)
      patch.promoCode = dto.promoCode.toUpperCase().trim();
    if (dto.validTill !== undefined) patch.validTill = endOfDay(dto.validTill);
    if (dto.validFrom !== undefined)
      patch.validFrom = startOfDay(dto.validFrom);
    if (dto.maximumRedemptions !== undefined) {
      // Redemptions already spent are not returned by raising the cap.
      const used = Math.max(
        0,
        (row.maximumRedemptions ?? 0) - (row.remainingRedemptions ?? 0),
      );
      patch.remainingRedemptions = Math.max(0, dto.maximumRedemptions - used);
    }

    const updated = await this.offers
      .findOneAndUpdate({ _id: row._id }, { $set: patch }, {
        new: true,
        runValidators: true,
        context: "query",
      })
      .lean();
    if (!updated) throw new NotFoundException("Offer not found");
    return updated;
  }

  async setStatus(
    user: AuthenticatedUser,
    id: string,
    status: string,
  ): Promise<any> {
    return this.update(user, id, { status } as UpdateOfferDto);
  }

  /**
   * Remove an offer.
   *
   * An offer nobody ever redeemed is deleted outright, which also frees its
   * promo code for reuse — the code carries a unique index, so leaving a dead
   * row behind would block anyone re-creating the same campaign. Once it has
   * been redeemed the row is archived instead: bookings reference it and those
   * references are immutable. The code is released either way, so the outcome
   * an administrator sees is the same.
   */
  async remove(
    user: AuthenticatedUser,
    id: string,
  ): Promise<{ archived: boolean; redemptions: number }> {
    const row = await this.loadForWrite(user, id);
    const redemptions =
      Number(row.redemptionsCount ?? 0) ||
      (await this.redemptions.countDocuments({ couponId: row._id }));

    if (!redemptions) {
      await this.offers.deleteOne({ _id: row._id });
      return { archived: false, redemptions: 0 };
    }

    const released = `${row.promoCode}-DELETED-${Date.now().toString().slice(-6)}`;
    await this.offers.updateOne(
      { _id: row._id },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: user.id,
          status: "disabled",
          promoCode: released,
          remainingRedemptions: 0,
        },
      },
    );
    return { archived: true, redemptions };
  }

  async duplicate(user: AuthenticatedUser, id: string): Promise<any> {
    const source = await this.loadForWrite(user, id);
    const {
      _id,
      __v,
      createdAt,
      updatedAt,
      deletedAt,
      deletedBy,
      ...rest
    } = source;
    void _id;
    void __v;
    void createdAt;
    void updatedAt;
    void deletedAt;
    void deletedBy;
    const max = rest.maximumRedemptions ?? 100;
    return this.offers.create({
      ...rest,
      // A legacy row may carry no owner at all; the copy is a new record and
      // must satisfy the typed schema, so it falls back to its creator.
      ownerId: rest.ownerId ?? user.id,
      offerTitle: `${rest.offerTitle ?? "Offer"} Copy`,
      promoCode: `${rest.promoCode ?? "OFFER"}-COPY-${Date.now().toString().slice(-4)}`,
      status: "draft",
      deletedAt: null,
      maximumRedemptions: max,
      remainingRedemptions: max,
      viewsCount: 0,
      clicksCount: 0,
      redemptionsCount: 0,
      revenueGenerated: 0,
      createdBy: user.id,
      updatedBy: user.id,
    });
  }
  /**
   * Check a promo code against a prospective booking.
   *
   * Each rejection names its own reason. A single "invalid or not applicable"
   * for every case left a guest with a code that plainly exists no way to tell
   * whether it had expired, was meant for another ashram, or needed a larger
   * booking — and left support guessing too.
   */
  async validate(dto: ValidatePromoDto): Promise<any> {
    const now = new Date();
    // Fetched on the code alone, so each condition can be reported separately.
    const offer = await this.offers
      .findOne({
        ...NOT_DELETED,
        promoCode: dto.promoCode.trim().toUpperCase(),
      })
      .populate("ashramId", OffersService.ASHRAM_CARD_FIELDS)
      .lean();

    if (!offer) throw new BadRequestException("This promo code does not exist");
    if (offer.status !== "active")
      throw new BadRequestException("This promo code is no longer active");
    if (offer.validFrom && new Date(offer.validFrom) > now)
      throw new BadRequestException(
        `This promo code becomes valid on ${new Date(offer.validFrom).toLocaleDateString("en-GB")}`,
      );
    if (offer.validTill && redeemableUntil(offer.validTill) < now)
      throw new BadRequestException(
        `This promo code expired on ${new Date(offer.validTill).toLocaleDateString("en-GB")}`,
      );
    if ((offer.remainingRedemptions ?? 0) <= 0)
      throw new BadRequestException(
        "This promo code has been fully redeemed",
      );

    // The ashram binding. `ashramId` may arrive populated, so compare on the id.
    const boundAshramId = String(offer.ashramId?._id ?? offer.ashramId ?? "");
    if (boundAshramId && boundAshramId !== dto.ashramId)
      throw new BadRequestException(
        offer.ashramId?.name
          ? `This promo code is only valid at ${offer.ashramId.name}`
          : "This promo code is not valid for this ashram",
      );
    if (
      offer.applicableAshrams?.length &&
      !offer.applicableAshrams.some(
        (id: any) => String(id?._id ?? id) === dto.ashramId,
      )
    )
      throw new BadRequestException(
        "This promo code is not valid for this ashram",
      );
    if (dto.bookingAmount < (offer.minimumBookingAmount ?? 0))
      throw new BadRequestException(
        `This promo code needs a booking of at least ₹${offer.minimumBookingAmount}`,
      );
    // `bookingAmount` is the full payable figure the booking page quoted —
    // stay, services, donation, platform fee and its GST — because that is
    // what a discount comes off. Rounded to paise, not to whole rupees, so the
    // preview matches the amount checkout charges to the last decimal.
    let discount =
      offer.discountType === "Percentage"
        ? (dto.bookingAmount * offer.discountValue) / 100
        : offer.discountType === "Flat Amount"
          ? offer.discountValue
          : 0;
    discount = roundMoney(
      Math.min(discount, offer.maximumDiscount || discount, dto.bookingAmount),
    );
    return { valid: true, offer, discountAmount: discount };
  }
}
