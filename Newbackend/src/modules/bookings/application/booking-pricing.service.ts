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
    const extraGuestAmount =
      Math.max(0, dto.guestsCount - 2) * 200 * dates.length;
    // The platform fee is charged on the booking value, so it is derived
    // before any coupon is applied — a discount reduces what the guest pays,
    // not the basis on which the fee is assessed.
    //
    // Delegated to the shared resolver so the global on/off switch is tested
    // before the per-ashram policy percentage. The precedence used to run the
    // other way round, which let a `booking_policies` row keep charging a fee
    // at checkout while the Super Admin console reported the engine Disabled.
    const platformFee = resolvePlatformFee({
      settings: settings?.platformFee,
      scope: "ashram_booking",
      baseAmount: originalAmount,
      policyPercent: policy?.platformFeePercent,
    });
    // GST is charged on the platform fee alone. The stay, add-on services,
    // extra-guest charge and donation are supplied by the ashram and carry no
    // GST here, so the taxable base is the fee — not the booking value.
    const gstPercent = Number(
      settings?.platformFeeGstRate ?? PLATFORM_FEE_GST_PERCENT,
    );
    const gstAmount = platformFeeGst(platformFee, gstPercent);

    /**
     * Everything owed before a coupon: stay, services, donation, extra guests,
     * the platform fee and its GST.
     *
     * A discount applies to this whole figure. It used to be calculated on the
     * ashram's charges alone, so "99% off" still left the platform fee and its
     * tax payable in full — a ₹370 booking settled at ₹61.82 rather than the
     * near-zero the guest was shown.
     */
    const grossPayable = originalAmount + extraGuestAmount + platformFee + gstAmount;

    let coupon: any = null;
    let discountAmount = 0;
    if (dto.promoCode || dto.appliedOfferId) {
      coupon = await this.coupons
        .findOne({
          ...(dto.appliedOfferId
            ? { _id: dto.appliedOfferId }
            : { promoCode: dto.promoCode!.trim().toUpperCase() }),
          status: "active",
          // An expiry date stays redeemable through the whole of the day it
          // names, matching what validation told the guest a moment earlier.
          // Comparing against the instant instead would reject, at checkout, a
          // code the page had already shown as applied.
          validTill: { $gte: startOfToday() },
          $or: [{ validFrom: null }, { validFrom: { $lte: new Date() } }],
          remainingRedemptions: { $gt: 0 },
        })
        .lean();
      // Measured against the same figure the discount comes off, so a coupon
      // that validated on the booking page cannot be refused at checkout.
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
        // Stored with the booking so an invoice reprinted after the platform
        // changes its rate still shows the rate that was actually charged.
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
