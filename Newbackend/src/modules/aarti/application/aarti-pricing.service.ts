import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { AARTI_DEFAULTS, AARTI_MODEL } from "../domain/aarti.constants";
import {
  combineDateAndTime,
  runsOnDate,
  toDateKey,
  weekdayOf,
} from "../domain/aarti.utils";

@Injectable()
export class AartiPricingService {
  constructor(
    @InjectModel(AARTI_MODEL.Pricing) private readonly pricing: Model<any>,
    @InjectModel(AARTI_MODEL.Holiday) private readonly holidays: Model<any>,
    @InjectModel(AARTI_MODEL.Setting) private readonly settings: Model<any>,
    @InjectModel(AARTI_MODEL.Availability)
    private readonly availability: Model<any>,
  ) {}

  async resolveSettings(
    sessionId?: string,
    ashramId?: string,
  ): Promise<Record<string, any>> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (ashramId) or.push({ scope: "ashram", ashramId });
    if (sessionId) or.push({ scope: "session", sessionId });
    const rows = await this.settings.find({ $or: or }).lean();
    const result: Record<string, any> = { ...AARTI_DEFAULTS };
    for (const scope of ["platform", "ashram", "session"]) {
      const row = rows.find((candidate) => candidate.scope === scope);
      if (!row) continue;
      for (const key of Object.keys(AARTI_DEFAULTS)) {
        if (row[key] !== null && row[key] !== undefined) result[key] = row[key];
      }
    }
    return result;
  }

  private async findRule(
    sessionId: string,
    passTypeId: string,
    at: Date,
  ): Promise<any | null> {
    const day = toDateKey(at);
    const weekday = weekdayOf(at);
    const rules = await this.pricing
      .find({
        sessionId,
        isActive: true,
        passTypeId: { $in: [passTypeId, null] },
        $and: [
          { $or: [{ validFrom: null }, { validFrom: { $lte: day } }] },
          { $or: [{ validUntil: null }, { validUntil: { $gte: day } }] },
        ],
      })
      .lean();
    return (
      rules
        .filter(
          (rule) =>
            !rule.daysOfWeek?.length || rule.daysOfWeek.includes(weekday),
        )
        .sort(
          (a, b) =>
            Number(b.priority ?? 0) - Number(a.priority ?? 0) ||
            Number(Boolean(b.passTypeId)) - Number(Boolean(a.passTypeId)),
        )[0] ?? null
    );
  }

  /**
   * Festival multipliers stack by `Math.max`, never by product: two overlapping
   * Kumbh entries must not silently 4x a pass price.
   */
  private async peak(
    session: any,
    date: Date,
  ): Promise<{ multiplier: number; closed: boolean; reasons: any[] }> {
    const day = toDateKey(date);
    const rows = await this.holidays
      .find({
        isActive: true,
        startDate: { $lte: day },
        endDate: { $gte: day },
        $or: [
          { sessionId: session._id },
          { ashramId: session.ashramId, sessionId: null },
          { ashramId: null, sessionId: null },
        ],
      })
      .lean();
    return {
      multiplier: Math.max(1, ...rows.map((row) => Number(row.peakMultiplier || 1))),
      closed: rows.some((row) => row.isClosed),
      reasons: rows.map((row) => ({ name: row.name, type: row.type })),
    };
  }

  async quote(
    session: any,
    passType: any,
    input: { sessionDate: string | Date; passCount: number; donationAmount?: number },
  ): Promise<any> {
    const settings = await this.resolveSettings(
      String(session._id),
      String(session.ashramId),
    );
    const date = toDateKey(input.sessionDate);

    if (!runsOnDate(session, date))
      return {
        ok: false,
        code: "NOT_SCHEDULED",
        message: "This aarti is not held on the date you selected.",
      };

    const startsAt = combineDateAndTime(date, session.startTime, session.timezone);
    const endsAt = new Date(
      startsAt.getTime() + Number(session.durationMinutes || 45) * 60_000,
    );

    const opensFrom = Date.now();
    const daysAhead = (startsAt.getTime() - opensFrom) / 86_400_000;
    if (daysAhead > Number(settings.bookingOpensDaysAhead))
      return {
        ok: false,
        code: "TOO_FAR_AHEAD",
        message: `Passes open ${settings.bookingOpensDaysAhead} days before the aarti.`,
      };
    if (
      startsAt.getTime() - opensFrom <
      Number(settings.bookingClosesBeforeMinutes) * 60_000
    )
      return {
        ok: false,
        code: "BOOKING_CLOSED",
        message: "Booking for this aarti has closed.",
      };

    const peak = await this.peak(session, date);
    if (peak.closed)
      return {
        ok: false,
        code: "CLOSED_PERIOD",
        message: "This aarti is not held on the date you selected.",
      };

    const maxPerBooking = Math.min(
      Number(passType.maxPerBooking || settings.maxPassesPerBooking),
      Number(settings.maxPassesPerBooking),
    );
    if (input.passCount > maxPerBooking)
      return {
        ok: false,
        code: "TOO_MANY_PASSES",
        message: `You can reserve up to ${maxPerBooking} passes in one booking.`,
      };

    const dayRow = await this.availability
      .findOne({ passTypeId: passType._id, date })
      .lean();
    const rule = await this.findRule(
      String(session._id),
      String(passType._id),
      date,
    );

    const unitPrice = Math.round(
      (dayRow?.customPrice ??
        rule?.overridePrice ??
        Number(passType.basePrice) * Number(rule?.multiplier ?? 1)) *
        peak.multiplier,
    );
    const subtotal = unitPrice * input.passCount;
    const donationAmount = Math.max(0, Math.round(input.donationAmount ?? 0));
    const taxPercent = Number(rule?.taxPercent ?? settings.taxPercent);
    const taxAmount = Math.round((subtotal * taxPercent) / 100);

    return {
      ok: true,
      settings,
      startsAt,
      endsAt,
      quote: {
        sessionDate: date,
        startsAt,
        endsAt,
        passTypeId: passType._id,
        passTypeName: passType.name,
        unitPrice,
        passCount: input.passCount,
        peakMultiplier: peak.multiplier,
        isPeak: peak.multiplier > 1,
        peakReasons: peak.reasons,
        subtotal,
        donationAmount,
        taxPercent,
        taxAmount,
        totalAmount: subtotal + taxAmount + donationAmount,
        currency: "INR",
        seatsRemaining: dayRow
          ? Math.max(
              0,
              Number(dayRow.totalCapacity) -
                Number(dayRow.blockedCount ?? 0) -
                Number(dayRow.bookedCount ?? 0),
            )
          : Number(passType.totalCapacity),
      },
    };
  }

  async refundQuote(booking: any, session: any): Promise<any> {
    const settings = await this.resolveSettings(
      String(booking.sessionId),
      String(booking.ashramId),
    );
    if (!settings.allowCancellation)
      return {
        allowed: false,
        percent: 0,
        refundAmount: 0,
        message: "This booking cannot be cancelled online.",
      };
    const paid = Number(booking.pricing?.amountPaid || 0);
    const hoursUntilStart =
      (new Date(booking.startsAt).getTime() - Date.now()) / 3_600_000;
    const percent =
      hoursUntilStart >= Number(settings.freeCancellationHours)
        ? Number(settings.refundPercentInsideWindow)
        : Number(settings.refundPercentOutsideWindow);
    // A sankalp donation is an offering to the ashram, not a ticket fee, so it
    // is deliberately excluded from the refundable base.
    const refundable = Math.max(
      0,
      paid - Number(booking.pricing?.donationAmount || 0),
    );
    return {
      allowed: true,
      percent,
      refundAmount: Math.round((refundable * percent) / 100),
      donationRetained: Number(booking.pricing?.donationAmount || 0),
      hoursUntilStart: Number(hoursUntilStart.toFixed(1)),
      freeCancellationHours: settings.freeCancellationHours,
      sessionName: session?.name ?? "",
    };
  }

  async commission(session: any, grossAmount: number): Promise<any> {
    const settings = await this.resolveSettings(
      String(session._id),
      String(session.ashramId),
    );
    const percent =
      session?.commissionPercent ?? Number(settings.commissionPercent);
    const amount = Math.round((grossAmount * Number(percent)) / 100);
    return {
      percent,
      amount,
      ashramEarning: Math.max(0, grossAmount - amount),
    };
  }
}
