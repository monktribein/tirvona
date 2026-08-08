import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type {
  SaveOfferDto,
  ValidatePromoDto,
} from "../presentation/dtos/booking.dto";

@Injectable()
export class OffersService {
  constructor(
    @InjectModel("BookingCoupon") private readonly offers: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}
  active(query: Record<string, string> = {}): Promise<any[]> {
    const filter: any = {};
    if (query.status !== "all") {
      filter.status = query.status || "active";
      filter.validTill = { $gte: new Date() };
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
      .lean();
  }
  async one(id: string): Promise<any> {
    const row = await this.offers
      .findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true })
      .populate(
        "ashramId",
        "name address images description history rules amenities",
      )
      .populate(
        "applicableAshrams",
        "name address images description history rules amenities",
      )
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
    const ids = [row.ashramId, ...(row.applicableAshrams ?? [])]
      .filter(Boolean)
      .map(String);
    if (!ids.some((id) => scope.includes(id)))
      throw new ForbiddenException("You do not have access to this offer");
  }
  async mine(user: AuthenticatedUser): Promise<any[]> {
    if (user.role === "super_admin")
      return this.offers.find().sort({ createdAt: -1 }).lean();
    const scope = await this.ownerAshrams(user);
    return this.offers
      .find({
        $or: [
          { ownerId: user.id },
          { ashramId: { $in: scope } },
          { applicableAshrams: { $in: scope } },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();
  }
  async save(user: AuthenticatedUser, dto: SaveOfferDto): Promise<any> {
    const scope = await this.ownerAshrams(user);
    if (
      dto.ashramId &&
      user.role !== "super_admin" &&
      !scope.includes(dto.ashramId)
    )
      throw new ForbiddenException("You do not manage this ashram");
    const ashram: any = dto.ashramId
      ? await this.ashrams.findById(dto.ashramId).lean()
      : null;
    const max = dto.maximumRedemptions ?? 100;
    return this.offers.create({
      ...dto.extra,
      ...dto,
      extra: undefined,
      ownerId: ashram?.ownerId ?? user.id,
      promoCode: dto.promoCode.toUpperCase(),
      validTill: new Date(dto.validTill),
      maximumRedemptions: max,
      remainingRedemptions: max,
      createdBy: user.id,
      status: dto.status ?? "active",
    });
  }
  async update(
    user: AuthenticatedUser,
    id: string,
    dto: SaveOfferDto,
  ): Promise<any> {
    const row = await this.offers.findById(id);
    if (!row) throw new NotFoundException("Offer not found");
    await this.assertOfferScope(user, row);
    const used =
      (row.maximumRedemptions ?? 0) - (row.remainingRedemptions ?? 0);
    Object.assign(row, dto.extra, dto, {
      extra: undefined,
      promoCode: dto.promoCode.toUpperCase(),
      validTill: new Date(dto.validTill),
      remainingRedemptions: Math.max(
        0,
        (dto.maximumRedemptions ?? row.maximumRedemptions) - used,
      ),
      updatedBy: user.id,
    });
    return row.save();
  }
  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const row = await this.offers.findById(id);
    if (!row) throw new NotFoundException("Offer not found");
    await this.assertOfferScope(user, row);
    row.status = "disabled";
    await row.save();
  }
  async duplicate(user: AuthenticatedUser, id: string): Promise<any> {
    const source: any = await this.offers.findById(id).lean();
    if (!source) throw new NotFoundException("Offer not found");
    await this.assertOfferScope(user, source);
    delete source._id;
    delete source.createdAt;
    delete source.updatedAt;
    return this.offers.create({
      ...source,
      offerTitle: `${source.offerTitle} Copy`,
      promoCode: `${source.promoCode}-COPY-${Date.now().toString().slice(-4)}`,
      status: "draft",
      remainingRedemptions: source.maximumRedemptions,
      createdBy: user.id,
    });
  }
  async validate(dto: ValidatePromoDto): Promise<any> {
    const offer = await this.offers
      .findOne({
        promoCode: dto.promoCode.trim().toUpperCase(),
        status: "active",
        validTill: { $gte: new Date() },
        remainingRedemptions: { $gt: 0 },
      })
      .lean();
    if (
      !offer ||
      dto.bookingAmount < (offer.minimumBookingAmount ?? 0) ||
      (offer.ashramId && String(offer.ashramId) !== dto.ashramId)
    )
      throw new BadRequestException("Promo code is invalid or not applicable");
    let discount =
      offer.discountType === "Percentage"
        ? (dto.bookingAmount * offer.discountValue) / 100
        : offer.discountType === "Flat Amount"
          ? offer.discountValue
          : 0;
    discount = Math.round(
      Math.min(discount, offer.maximumDiscount || discount, dto.bookingAmount),
    );
    return { valid: true, offer, discountAmount: discount };
  }
}
