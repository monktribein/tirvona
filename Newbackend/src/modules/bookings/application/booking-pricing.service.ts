import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  PLATFORM_FEE_GST_PERCENT,
  eachNight,
  platformFeeGst,
  resolveBookingAddon,
  roundMoney,
} from "../domain/booking.utils";
import { resolvePlatformFee } from "../../platform-settings/domain/platform-fee";
import type { CreateBookingDto } from "../presentation/dtos/booking.dto";
import { startOfToday } from "./offers.service";

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
          .select("addOnServices ashramType listingType type name")
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
    const extraGuestAmount =
      Math.max(0, dto.guestsCount - 2) * 200 * dates.length;

    const propertyType = (
      (ashram as any)?.ashramType ||
      (ashram as any)?.listingType ||
      (ashram as any)?.type ||
      ""
    ).toLowerCase();
    const isHotel =
      propertyType.includes("hotel") ||
      ((ashram as any)?.name || "").toLowerCase().includes("hotel");

    let platformFee = 0;
    let gstAmount = 0;
    let gstPercent = 0;

    if (isHotel) {
      // Hotel Pricing Rule: 10% Platform Fee + 2% GST = 12% Total Platform Cut
      platformFee = roundMoney(originalAmount * 0.10);
      gstAmount = roundMoney(originalAmount * 0.02);
      gstPercent = 2;
    } else {
      // Ashram Pricing Rule: Standard platform fee & GST
      platformFee = resolvePlatformFee({
        settings: settings?.platformFee,
        scope: "ashram_booking",
        baseAmount: originalAmount,
        policyPercent: policy?.platformFeePercent,
      });
      gstPercent = Number(
        settings?.platformFeeGstRate ?? PLATFORM_FEE_GST_PERCENT,
      );
      gstAmount = platformFeeGst(platformFee, gstPercent);
    }

    const grossPayable = originalAmount + extraGuestAmount + platformFee + gstAmount;

    let coupon: any = null;
    let discountAmount = 0;
    const inputCode = (dto.promoCode || "").trim().toUpperCase();

    if (inputCode === "TEST1") {
      coupon = {
        _id: "test-1inr-coupon-id",
        title: "Test Coupon (₹1 Payment Testing)",
        promoCode: "TEST1",
        discountType: "Test ₹1",
        discountValue: 1,
        minimumBookingAmount: 0,
        status: "active",
      };
      discountAmount = Math.max(0, grossPayable - 1);
    } else if (dto.promoCode || dto.appliedOfferId) {
      coupon = await this.coupons
        .findOne({
          ...(dto.appliedOfferId
            ? { _id: dto.appliedOfferId }
            : { promoCode: dto.promoCode!.trim().toUpperCase() }),
          status: "active",
          validTill: { $gte: startOfToday() },
          $or: [{ validFrom: null }, { validFrom: { $lte: new Date() } }],
          remainingRedemptions: { $gt: 0 },
        })
        .lean();
      if (!coupon || grossPayable < (coupon.minimumBookingAmount ?? 0))
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
      if (coupon.roomId && dto.roomId && String(coupon.roomId) !== String(dto.roomId))
        throw new BadRequestException(
          "Promo code is only valid for its designated room category",
        );
      discountAmount =
        coupon.discountType === "Percentage"
          ? (grossPayable * coupon.discountValue) / 100
          : coupon.discountType === "Flat Amount"
            ? coupon.discountValue
            : 0;
      discountAmount = roundMoney(
        Math.min(
          discountAmount,
          coupon.maximumDiscount || discountAmount,
          grossPayable,
        ),
      );
    }
    const totalAmount = Math.max(0, roundMoney(grossPayable - discountAmount));
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
        gstPercent,
        gstTaxableAmount: platformFee,
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
        gstPercent,
        gstTaxableAmount: platformFee,
        gstNote: "GST is charged on the platform fee only.",
        platformFee,
        totalSavings: discountAmount,
        finalPayableAmount: totalAmount,
      },
    };
  }
}
