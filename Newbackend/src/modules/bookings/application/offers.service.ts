import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { resolveAshramScope } from "../../../common/auth/ashram-scope";
import { roundMoney } from "../domain/booking.utils";
import type {
  SaveOfferDto,
  UpdateOfferDto,
  ValidatePromoDto,
} from "../presentation/dtos/booking.dto";

const NOT_DELETED = { deletedAt: null };

const endOfDay = (value: string | Date): Date => {
  const date = new Date(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()))
    date.setHours(23, 59, 59, 999);
  return date;
};

const startOfDay = (value: string | Date): Date => {
  const date = new Date(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()))
    date.setHours(0, 0, 0, 0);
  return date;
};

export const startOfToday = (): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const redeemableUntil = (value: Date | string): Date => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

@Injectable()
export class OffersService {
  static readonly ASHRAM_CARD_FIELDS = "name slug address.city address.state";

  constructor(
    @InjectModel("BookingCoupon") private readonly offers: Model<any>,
    @InjectModel("BookingOfferRedemption")
    private readonly redemptions: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

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
      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [
            { validFrom: { $exists: false } },
            { validFrom: null },
            { validFrom: { $lte: new Date() } },
          ],
        },
      ];
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
    if (query.ashramId) {
      const ashramId = this.objectId(query.ashramId);
      filter.$and = [
        ...(filter.$and ?? []),
        {
          $or: [
            { ashramId },
            { applicableAshrams: ashramId },
          ],
        },
      ];
    }
    return this.offers
      .find(filter)
      .sort({ featured: -1, priority: -1, createdAt: -1 })
      .skip(
        (Math.max(1, Number(query.page) || 1) - 1) *
          Math.min(100, Math.max(1, Number(query.limit) || 20)),
      )
      .limit(Math.min(100, Math.max(1, Number(query.limit) || 20)))
      .populate("ashramId", OffersService.ASHRAM_CARD_FIELDS)
      .lean();
  }
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
    if (canManageAllAshrams(user))
      return (await this.ashrams.distinct("_id", { deletedAt: null })).map(String);
    return (await resolveAshramScope(user, this.ashrams)) ?? [];
  }
  private async assertOfferScope(
    user: AuthenticatedUser,
    row: any,
  ): Promise<void> {
    if (canManageAllAshrams(user) || String(row.ownerId) === user.id) return;
    const scope = await this.ownerAshrams(user);
    const refId = (value: any): string =>
      String(value?._id ?? value);
    const ids = [row.ashramId, ...(row.applicableAshrams ?? [])]
      .filter(Boolean)
      .map(refId);
    if (!ids.some((id) => scope.includes(id)))
      throw new ForbiddenException("You do not have access to this offer");
  }
  async assertReadable(user: AuthenticatedUser, row: any): Promise<void> {
    return this.assertOfferScope(user, row);
  }

  async mine(user: AuthenticatedUser): Promise<any[]> {
    if (canManageAllAshrams(user))
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
    if (!canManageAllAshrams(user)) {
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

  private ashramBinding(
    dto: SaveOfferDto | UpdateOfferDto,
  ): Record<string, any> {
    if (dto.ashramId === undefined) return {};
    if (!dto.ashramId) return { ashramId: null, applicableAshrams: [] };
    return { ashramId: dto.ashramId, applicableAshrams: [dto.ashramId] };
  }
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
    if (dto.ashramId !== undefined && !canManageAllAshrams(user)) {
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
    for (const key of Object.keys(patch))
      if (patch[key] === undefined) delete patch[key];

    Object.assign(patch, this.ashramBinding(dto));
    if (dto.promoCode !== undefined)
      patch.promoCode = dto.promoCode.toUpperCase().trim();
    if (dto.validTill !== undefined) patch.validTill = endOfDay(dto.validTill);
    if (dto.validFrom !== undefined)
      patch.validFrom = startOfDay(dto.validFrom);
    if (dto.maximumRedemptions !== undefined) {
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
  async validate(dto: ValidatePromoDto): Promise<any> {
    const now = new Date();
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
