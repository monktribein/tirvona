import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { PARKING_DEFAULTS, PARKING_MODEL } from "../domain/parking.constants";
import { billableHours, minutesBetween } from "../domain/parking.utils";

@Injectable()
export class ParkingPricingService {
  constructor(
    @InjectModel(PARKING_MODEL.Pricing) private readonly pricing: Model<any>,
    @InjectModel(PARKING_MODEL.Holiday) private readonly holidays: Model<any>,
    @InjectModel(PARKING_MODEL.Setting) private readonly settings: Model<any>,
    @InjectModel(PARKING_MODEL.Partner) private readonly partners: Model<any>,
  ) {}

  async resolveSettings(
    locationId?: string,
    partnerId?: string,
  ): Promise<Record<string, any>> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (partnerId) or.push({ scope: "partner", partnerId });
    if (locationId) or.push({ scope: "location", locationId });
    const rows = await this.settings.find({ $or: or }).lean();
    const result: Record<string, any> = { ...PARKING_DEFAULTS };
    for (const scope of ["platform", "partner", "location"]) {
      const row = rows.find((candidate) => candidate.scope === scope);
      if (!row) continue;
      for (const key of Object.keys(PARKING_DEFAULTS)) {
        if (row[key] !== null && row[key] !== undefined) result[key] = row[key];
      }
    }
    return result;
  }

  async findRateCard(
    locationId: string,
    slotTypeId: string,
    vehicleType: string,
    at: Date | string,
  ): Promise<any | null> {
    const moment = new Date(at);
    const cards = await this.pricing
      .find({
        locationId,
        vehicleType,
        isActive: true,
        slotTypeId: { $in: [slotTypeId, null] },
        $and: [
          { $or: [{ validFrom: null }, { validFrom: { $lte: moment } }] },
          { $or: [{ validUntil: null }, { validUntil: { $gte: moment } }] },
        ],
      })
      .sort({ updatedAt: -1 })
      .lean();
    return (
      cards.sort(
        (a, b) => Number(Boolean(b.slotTypeId)) - Number(Boolean(a.slotTypeId)),
      )[0] ?? null
    );
  }

  private durationAmount(card: any, hours: number): number {
    if (card.mode === "flat_day")
      return Math.ceil(hours / 24) * Number(card.dailyRate || 0);
    const cap = Number(card.dailyRate || Infinity);
    const charge = (value: number): number => {
      if (value <= 0) return 0;
      if (card.mode === "hourly")
        return Math.min(value * Number(card.hourlyRate || 0), cap);
      const slabs = [...(card.slabs ?? [])].sort(
        (a, b) => (a.uptoHours ?? Infinity) - (b.uptoHours ?? Infinity),
      );
      if (!slabs.length)
        return Math.min(value * Number(card.hourlyRate || 0), cap);
      for (const slab of slabs) {
        if (slab.uptoHours == null) {
          const ceiling = Math.max(
            0,
            ...slabs
              .filter((s) => s.uptoHours != null)
              .map((s) => Number(s.uptoHours)),
          );
          return Math.min(
            Number(slab.price || 0) +
              Math.max(0, value - ceiling) *
                Number(slab.perHourAfter || card.hourlyRate || 0),
            cap,
          );
        }
        if (value <= slab.uptoHours)
          return Math.min(Number(slab.price || 0), cap);
      }
      const largest = slabs.at(-1);
      return Math.min(
        Number(largest?.price || 0) +
          Math.max(0, value - Number(largest?.uptoHours || 0)) *
            Number(largest?.perHourAfter || card.hourlyRate || 0),
        cap,
      );
    };
    const days = Math.floor(hours / 24);
    return (
      days * (Number.isFinite(cap) ? cap : charge(24)) + charge(hours % 24)
    );
  }

  async quote(
    location: any,
    slotType: any,
    input: {
      vehicleType: string;
      entryAt: string | Date;
      exitAt: string | Date;
    },
  ): Promise<any> {
    const settings = await this.resolveSettings(
      String(location._id),
      String(location.partnerId),
    );
    const card = await this.findRateCard(
      String(location._id),
      String(slotType._id),
      input.vehicleType,
      input.entryAt,
    );
    if (!card)
      return {
        ok: false,
        code: "NO_RATE_CARD",
        message:
          "Pricing is not published for this vehicle type at this parking.",
      };
    const holidays = await this.holidays
      .find({
        isActive: true,
        startDate: { $lte: new Date(input.exitAt) },
        endDate: { $gte: new Date(input.entryAt) },
        $or: [
          { locationId: location._id },
          { partnerId: location.partnerId, locationId: null },
          { partnerId: null, locationId: null },
        ],
      })
      .lean();
    if (holidays.some((holiday) => holiday.isClosed))
      return {
        ok: false,
        code: "CLOSED_PERIOD",
        message: "This parking is closed for the dates you selected.",
      };
    const peakMultiplier = Math.max(
      Number(card.peakMultiplier || 1),
      ...holidays.map((holiday) => Number(holiday.peakMultiplier || 1)),
      1,
    );
    const durationMinutes = minutesBetween(input.entryAt, input.exitAt);
    const durationHours = billableHours(
      input.entryAt,
      input.exitAt,
      card.minimumBillableHours ?? settings.minimumBillableHours,
    );
    const raw =
      Number(card.freeMinutes || 0) >= durationMinutes
        ? 0
        : this.durationAmount(card, durationHours);
    const baseFee = Number(card.baseFee || 0);
    const durationAmount = Math.round(raw * peakMultiplier);
    const subtotal = Math.round(baseFee + durationAmount);
    const taxPercent = Number(card.taxPercent ?? settings.taxPercent);
    const taxAmount = Math.round((subtotal * taxPercent) / 100);
    return {
      ok: true,
      settings,
      card,
      quote: {
        vehicleType: input.vehicleType,
        slotTypeId: slotType._id,
        slotTypeName: slotType.name,
        durationHours,
        durationMinutes,
        baseFee,
        durationAmount,
        peakMultiplier,
        isPeak: peakMultiplier > 1,
        peakReasons: holidays.map((holiday) => ({
          name: holiday.name,
          type: holiday.type,
        })),
        subtotal,
        taxPercent,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        currency: "INR",
        freeMinutesApplied:
          Number(card.freeMinutes || 0) >= durationMinutes
            ? card.freeMinutes
            : 0,
        pricingMode: card.mode,
      },
    };
  }

  async refundQuote(booking: any, location: any): Promise<any> {
    const settings = await this.resolveSettings(
      String(location._id),
      String(location.partnerId),
    );
    if (!settings.allowCancellation)
      return {
        allowed: false,
        percent: 0,
        refundAmount: 0,
        message: "This booking cannot be cancelled online.",
      };
    const paid = Number(booking.pricing?.amountPaid || 0);
    const hoursUntilEntry =
      (new Date(booking.entryAt).getTime() - Date.now()) / 3_600_000;
    const percent =
      hoursUntilEntry >= settings.freeCancellationHours
        ? settings.refundPercentInsideWindow
        : settings.refundPercentOutsideWindow;
    return {
      allowed: true,
      percent,
      refundAmount: Math.round((paid * percent) / 100),
      hoursUntilEntry: Number(hoursUntilEntry.toFixed(1)),
      freeCancellationHours: settings.freeCancellationHours,
    };
  }

  async commission(location: any, grossAmount: number): Promise<any> {
    const [settings, partner] = await Promise.all([
      this.resolveSettings(String(location._id), String(location.partnerId)),
      this.partners.findById(location.partnerId).lean(),
    ]);
    const percent = partner?.commissionPercent ?? settings.commissionPercent;
    const amount = Math.round((grossAmount * Number(percent)) / 100);
    return {
      percent,
      amount,
      partnerEarning: Math.max(0, grossAmount - amount),
    };
  }
}
