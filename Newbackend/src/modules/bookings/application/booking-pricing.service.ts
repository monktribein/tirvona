import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { eachNight, resolveBookingAddon } from "../domain/booking.utils";
import type { CreateBookingDto } from "../presentation/dtos/booking.dto";

@Injectable()
export class BookingPricingService {
  constructor(
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("BookingInventory") private readonly inventory: Model<any>,
    @InjectModel("BookingAddon") private readonly addons: Model<any>,
    @InjectModel("BookingPricing") private readonly pricingRules: Model<any>,
    @InjectModel("BookingCoupon") private readonly coupons: Model<any>,
    @InjectModel("BookingPolicy") private readonly policies: Model<any>,
    @InjectModel("PlatformSettings") private readonly settings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  async quote(dto: CreateBookingDto): Promise<any> {
    const start = new Date(dto.checkInDate);
    const end = new Date(dto.checkOutDate);
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start >= end
    )
      throw new BadRequestException(
        "Check-out date must be after check-in date",
      );
    const dates = eachNight(start, end);
    if (!dates.length || dates.length > 30)
      throw new BadRequestException("A stay must be between 1 and 30 nights");
    const room = await this.rooms
      .findOne({
        _id: dto.roomId,
        ashramId: dto.ashramId,
        status: "active",
        deletedAt: null,
      })
      .lean();
    if (!room) throw new NotFoundException("Room category not found");
    if (dto.guestsCount > room.capacity * dto.roomsBookedCount)
      throw new BadRequestException(
        "Guest count exceeds the selected room capacity",
      );
    const [availability, rules, addonRows, policy, settings, ashram] =
      await Promise.all([
        this.inventory.find({ roomId: room._id, date: { $in: dates } }).lean(),
        this.pricingRules
          .find({
            ashramId: dto.ashramId,
            isActive: true,
            $or: [{ roomId: null }, { roomId: room._id }],
          })
          .sort({ priority: -1 })
          .lean(),
        this.addons.find({ ashramId: dto.ashramId, enabled: true }).lean(),
        this.policies
          .findOne({
            $or: [
              { scope: "ashram", ashramId: dto.ashramId },
              { scope: "platform" },
            ],
            isActive: true,
          })
          .sort({ scope: 1 })
          .lean(),
        this.settings.findOne({ key: "main" }).lean(),
        this.ashrams
          .findOne({
            _id: dto.ashramId,
            status: "approved",
            deletedAt: null,
          })
          .select("addOnServices")
          .lean(),
      ]);
    const byDate = new Map(
      availability.map((row: any) => [
        new Date(row.date).toISOString().slice(0, 10),
        row,
      ]),
    );
    let basePrice = 0;
    for (const date of dates) {
      const day = byDate.get(date.toISOString().slice(0, 10)) as any;
      const rule = rules.find(
        (r: any) =>
          (!r.validFrom || date >= new Date(r.validFrom)) &&
          (!r.validUntil || date <= new Date(r.validUntil)) &&
          (!r.daysOfWeek?.length || r.daysOfWeek.includes(date.getUTCDay())),
      );
      const embedded = room.pricingRules?.find(
        (r: any) =>
          date >= new Date(r.startDate) && date <= new Date(r.endDate),
      );
      const daily =
        day?.customPrice ??
        rule?.overridePrice ??
        embedded?.overridePrice ??
        room.basePrice * (rule?.multiplier ?? embedded?.multiplier ?? 1);
      basePrice += daily * dto.roomsBookedCount;
    }
    const selected: any[] = [];
    let servicesPrice = 0;
    const requested = Array.isArray(dto.services?.selectedAddOns)
      ? dto.services!.selectedAddOns
      : [];
    for (const item of requested) {
      const addon = resolveBookingAddon(
        addonRows,
        Array.isArray(ashram?.addOnServices) ? ashram.addOnServices : [],
        item.serviceId ?? item._id,
      );
      if (!addon)
        throw new BadRequestException("A selected add-on is unavailable");
      const quantity = Math.min(
        Math.max(1, Number.parseInt(item.quantity, 10) || 1),
        addon.maxQuantity ?? 10,
      );
      const multiplier =
        addon.unit === "per_day"
          ? dates.length
          : addon.unit === "per_person"
            ? dto.guestsCount
            : 1;
      const totalPrice = addon.price * quantity * multiplier;
      servicesPrice += totalPrice;
      selected.push({
        serviceId: String(addon._id),
        name: addon.name,
        price: addon.price,
        unit: addon.unit,
        unitLabel: addon.unitLabel,
        quantity,
        totalPrice,
      });
    }
    const defaults = {
      prasad: 100 * dto.guestsCount,
      meals: 150 * dto.guestsCount * dates.length,
      parking: 100 * dates.length,
      locker: 50 * dates.length,
    };
    const services: any = {
      selectedAddOns: selected,
      donation: {
        amount: Math.max(0, Number(dto.services?.donation?.amount) || 0),
      },
    };
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      const ordered = Boolean(dto.services?.[key]?.ordered);
      const price = ordered ? defaults[key] : 0;
      services[key] = { ordered, price };
      servicesPrice += price;
    }
    const donationAmount = services.donation.amount;
    const originalAmount = basePrice + servicesPrice + donationAmount;
    let coupon: any = null;
    let discountAmount = 0;
    if (dto.promoCode || dto.appliedOfferId) {
      coupon = await this.coupons
        .findOne({
          ...(dto.appliedOfferId
            ? { _id: dto.appliedOfferId }
            : { promoCode: dto.promoCode!.trim().toUpperCase() }),
          status: "active",
          validTill: { $gte: new Date() },
          $or: [{ validFrom: null }, { validFrom: { $lte: new Date() } }],
          remainingRedemptions: { $gt: 0 },
        })
        .lean();
      if (!coupon || originalAmount < (coupon.minimumBookingAmount ?? 0))
        throw new BadRequestException(
          "Promo code is invalid or not applicable",
        );
      if (coupon.ashramId && String(coupon.ashramId) !== dto.ashramId)
        throw new BadRequestException(
          "Promo code is not valid for this ashram",
        );
      if (
        coupon.applicableAshrams?.length &&
        !coupon.applicableAshrams.some((id: any) => String(id) === dto.ashramId)
      )
        throw new BadRequestException(
          "Promo code is not valid for this ashram",
        );
      discountAmount =
        coupon.discountType === "Percentage"
          ? (originalAmount * coupon.discountValue) / 100
          : coupon.discountType === "Flat Amount"
            ? coupon.discountValue
            : 0;
      discountAmount = Math.round(
        Math.min(
          discountAmount,
          coupon.maximumDiscount || discountAmount,
          originalAmount,
        ),
      );
    }
    const extraGuestAmount =
      Math.max(0, dto.guestsCount - 2) * 200 * dates.length;
    const gstPercent = policy?.taxPercent ?? settings?.gstRate ?? 5;
    const gstAmount = Math.round((originalAmount * gstPercent) / 100);
    const platformFee =
      policy?.platformFeePercent != null
        ? Math.round((originalAmount * policy.platformFeePercent) / 100)
        : settings?.platformFee?.enabled === false
          ? 0
          : settings?.platformFee?.type === "percentage"
            ? Math.round((originalAmount * settings.platformFee.value) / 100)
            : Number(settings?.platformFee?.value ?? 49);
    const totalAmount = Math.max(
      0,
      Math.round(
        originalAmount +
          extraGuestAmount -
          discountAmount +
          gstAmount +
          platformFee,
      ),
    );
    return {
      room,
      dates,
      coupon,
      services,
      policy,
      pricing: {
        basePrice,
        servicesPrice,
        donationAmount,
        extraGuestAmount,
        mealAmount: services.meals.price,
        upgradeAmount: 0,
        discountAmount,
        loyaltyDiscount: 0,
        gstAmount,
        platformFee,
        originalAmount,
        finalAmount: totalAmount,
        totalSavings: discountAmount,
        totalAmount,
        amountPaid: 0,
        currency: "INR",
      },
      paymentSummary: {
        originalStayCost: basePrice,
        extraGuestAmount,
        mealAmount: services.meals.price,
        servicesPrice,
        donationAmount,
        couponDiscount: discountAmount,
        gstAmount,
        platformFee,
        totalSavings: discountAmount,
        finalPayableAmount: totalAmount,
      },
    };
  }
}
