import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { DayStayProductsService } from "./day-stay-products.service";
import {
  addDays,
  hhmmToMinutes,
  istDateString,
  istDayBounds,
  istInstant,
  minutesToHhmm,
} from "../domain/day-stay-time";

export interface TimeSlotAvailability {
  startTime: string; // HH:mm (IST)
  endTime: string;   // HH:mm (IST)
  startUtc: Date;
  endUtc: Date;
  availableUnits: number;
  isAvailable: boolean;
  productCode: string;
  durationMinutes: number;
  price: number;
  discountPrice: number;
}

const FALLBACK_PRICES: Record<string, number> = {
  FRESHEN_UP: 499,
  DAY_REST_3H: 599,
  DAY_REST_4H: 699,
  DAY_REST_6H: 1199,
};

/** True when Day Stay is closed for this IST date (blackouts / quick blocks). */
export function isDayStayBlocked(dayStayConfig: any, dateStr: string, now = new Date()): boolean {
  if (dayStayConfig?.blackoutDates?.some((d: Date) => new Date(d).toISOString().slice(0, 10) === dateStr)) {
    return true;
  }
  const today = istDateString(now);
  if (dayStayConfig?.isBlockedToday && dateStr === today) return true;
  if (dayStayConfig?.isBlockedTomorrow && dateStr === addDays(today, 1)) return true;
  return false;
}

@Injectable()
export class DayStayInventoryService {
  private readonly logger = new Logger(DayStayInventoryService.name);

  constructor(
    @InjectModel("Ashram") private readonly ashramModel: Model<any>,
    @InjectModel("Room") private readonly roomModel: Model<any>,
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
    private readonly productsService: DayStayProductsService,
  ) {}

  /**
   * Evaluates available time slots for a given room on a date.
   * `dateStr` and slot times are IST wall-clock; startUtc/endUtc are real instants.
   */
  async getRoomSlots(
    ashramId: string,
    roomId: string,
    dateStr: string, // YYYY-MM-DD
    productCode?: string,
    excludeBookingId?: string,
  ): Promise<TimeSlotAvailability[]> {
    const ashram = await this.ashramModel.findById(ashramId).lean();
    if (!ashram) throw new NotFoundException("Property not found");

    if (!ashram.dayStayConfig?.enabled) {
      return [];
    }

    if (isDayStayBlocked(ashram.dayStayConfig, dateStr)) {
      return [];
    }

    const room = await this.roomModel.findOne({ _id: roomId, ashramId }).lean();
    if (!room) throw new NotFoundException("Room not found");

    if (room.dayStayConfig?.enabled === false) {
      return [];
    }

    // `allocatedInventory` defaults to 0, which legitimately means "the
    // owner hasn't allocated any units to Day Stay yet" — `||` would treat
    // that 0 as "unset" and fall back to the room's full overnight
    // inventory, so this must be a nullish check instead.
    const totalAllocated =
      room.dayStayConfig?.allocatedInventory ?? room.totalInventory ?? room.count ?? 5;
    const graceMinutes = ashram.dayStayConfig.defaultGraceMinutes ?? 15;
    const bufferMinutes = ashram.dayStayConfig.defaultHousekeepingBufferMinutes ?? 45;

    // Operating window
    const opStart = ashram.dayStayConfig.operatingHours?.start || ashram.dayStayConfig.operatingHours?.open || "06:00";
    const opEnd = ashram.dayStayConfig.operatingHours?.end || ashram.dayStayConfig.operatingHours?.close || "20:00";
    const opStartMins = hhmmToMinutes(opStart);
    const opEndMins = hhmmToMinutes(opEnd);

    let targetProducts = await this.resolveRoomProducts(room);

    if (productCode) {
      targetProducts = targetProducts.filter((p: any) => p.productCode === productCode.toUpperCase());
    }

    if (!targetProducts.length) {
      return [];
    }

    // Active occupants of this room on this IST date. A pending booking only
    // counts while its payment hold is still live.
    const { start: dayStartUtc, end: dayEndUtc } = istDayBounds(dateStr);
    const now = new Date();

    const existingBookings = await this.bookingModel.find({
      "rooms.roomId": roomId,
      ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
      $and: [
        {
          $or: [
            { status: { $in: ["confirmed", "checked_in"] } },
            { status: "pending", reservationExpiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            {
              bookingType: { $in: ["day_rest", "freshen_up"] },
              "dayStayDetails.slotStartTime": { $gte: dayStartUtc, $lte: dayEndUtc },
            },
            {
              bookingType: "overnight",
              checkInDate: { $lte: dayEndUtc },
              checkOutDate: { $gt: dayStartUtc },
            },
          ],
        },
      ],
    }).lean();

    const slots: TimeSlotAvailability[] = [];

    // Generate slots in 30-minute stepping increments
    for (const prod of targetProducts) {
      const duration = prod.durationMinutes;

      for (let curMins = opStartMins; curMins + duration <= opEndMins; curMins += 30) {
        const slotStartUtc = istInstant(dateStr, curMins);
        const slotEndUtc = istInstant(dateStr, curMins + duration);

        // Time window including turnaround requirement: [slotStartUtc, slotEndUtc + grace + buffer]
        const turnaroundEndUtc = new Date(slotEndUtc.getTime() + (graceMinutes + bufferMinutes) * 60000);

        // Count overlapping active reservations
        let overlappingUnits = 0;
        for (const bk of existingBookings) {
          if (bk.bookingType === "overnight") {
            // Overnight guests hold the room from check-in to check-out.
            if (slotStartUtc < new Date(bk.checkOutDate) && turnaroundEndUtc > new Date(bk.checkInDate)) {
              overlappingUnits += (bk.roomsBookedCount || 1);
            }
          } else if (bk.dayStayDetails?.slotStartTime && bk.dayStayDetails?.slotEndTime) {
            const bkStart = new Date(bk.dayStayDetails.slotStartTime);
            const bkTurnaroundEnd = new Date(
              new Date(bk.dayStayDetails.slotEndTime).getTime() +
              ((bk.dayStayDetails.graceMinutes ?? graceMinutes) + (bk.dayStayDetails.housekeepingBufferMinutes ?? bufferMinutes)) * 60000
            );

            // Overlap condition:
            if (slotStartUtc < bkTurnaroundEnd && turnaroundEndUtc > bkStart) {
              overlappingUnits += (bk.roomsBookedCount || 1);
            }
          }
        }

        // Slots that have already started can't be booked.
        const availableUnits =
          slotStartUtc <= now ? 0 : Math.max(0, totalAllocated - overlappingUnits);

        slots.push({
          startTime: minutesToHhmm(curMins),
          endTime: minutesToHhmm(curMins + duration),
          startUtc: slotStartUtc,
          endUtc: slotEndUtc,
          availableUnits,
          isAvailable: availableUnits > 0,
          productCode: prod.productCode,
          durationMinutes: duration,
          price: prod.price,
          discountPrice: prod.discountPrice || prod.price,
        });
      }
    }

    return slots;
  }

  /**
   * Products a room sells: its own enabled products, or the global catalog
   * priced for the room. Used by both availability and hold so they agree.
   */
  async resolveRoomProducts(room: any): Promise<any[]> {
    const own = room.dayStayConfig?.products?.filter((p: any) => p.enabled) || [];
    if (own.length) return own;
    const catalogProducts = await this.productsService.getActiveProducts();
    const multiplier = room.dayStayConfig?.priceMultiplier || 1.0;
    const pricingMap = room.dayStayConfig?.pricingByProduct;
    return catalogProducts.map((p) => {
      let basePrice = FALLBACK_PRICES[p.productCode] ?? 699;
      if (pricingMap) {
        const mapped = typeof pricingMap.get === "function" ? pricingMap.get(p.productCode) : pricingMap[p.productCode];
        if (mapped) basePrice = mapped;
      }
      const price = Math.round(basePrice * multiplier);
      return {
        productCode: p.productCode,
        productType: p.productType,
        displayName: p.displayName,
        durationMinutes: p.durationMinutes,
        price,
        discountPrice: price,
        enabled: true,
      };
    });
  }
}
