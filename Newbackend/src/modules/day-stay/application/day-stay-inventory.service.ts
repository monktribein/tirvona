import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { DayStayProductsService } from "./day-stay-products.service";

export interface TimeSlotAvailability {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  startUtc: Date;
  endUtc: Date;
  availableUnits: number;
  isAvailable: boolean;
  productCode: string;
  durationMinutes: number;
  price: number;
  discountPrice: number;
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
   */
  async getRoomSlots(
    ashramId: string,
    roomId: string,
    dateStr: string, // YYYY-MM-DD
    productCode?: string,
  ): Promise<TimeSlotAvailability[]> {
    const ashram = await this.ashramModel.findById(ashramId).lean();
    if (!ashram) throw new NotFoundException("Property not found");

    if (!ashram.dayStayConfig?.enabled) {
      return [];
    }

    // Check blackout / quick blocks
    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    if (ashram.dayStayConfig.blackoutDates?.some((d: Date) => new Date(d).toISOString().split("T")[0] === dateStr)) {
      return [];
    }

    const room = await this.roomModel.findOne({ _id: roomId, ashramId }).lean();
    if (!room) throw new NotFoundException("Room not found");

    if (room.dayStayConfig?.enabled === false) {
      return [];
    }

    const totalAllocated = room.dayStayConfig?.allocatedInventory || room.totalInventory || room.count || 5;
    const graceMinutes = ashram.dayStayConfig.defaultGraceMinutes ?? 15;
    const bufferMinutes = ashram.dayStayConfig.defaultHousekeepingBufferMinutes ?? 45;

    // Operating window
    const opStart = ashram.dayStayConfig.operatingHours?.start || ashram.dayStayConfig.operatingHours?.open || "06:00";
    const opEnd = ashram.dayStayConfig.operatingHours?.end || ashram.dayStayConfig.operatingHours?.close || "20:00";

    const [startHour, startMin] = opStart.split(":").map(Number);
    const [endHour, endMin] = opEnd.split(":").map(Number);

    const opStartMins = startHour * 60 + startMin;
    const opEndMins = endHour * 60 + endMin;

    // Fetch products to compute slots
    let targetProducts = room.dayStayConfig?.products?.filter((p: any) => p.enabled) || [];
    if (!targetProducts.length) {
      const catalogProducts = await this.productsService.getActiveProducts();
      const multiplier = room.dayStayConfig?.priceMultiplier || 1.0;
      targetProducts = catalogProducts.map((p) => {
        const pricingMap = room.dayStayConfig?.pricingByProduct;
        let basePrice = 499;
        if (pricingMap) {
          if (typeof pricingMap.get === "function") {
            basePrice = pricingMap.get(p.productCode) || basePrice;
          } else if (pricingMap[p.productCode]) {
            basePrice = pricingMap[p.productCode];
          }
        } else {
          basePrice = p.productCode === "DAY_REST_4H" ? 699 : p.productCode === "DAY_REST_6H" ? 1199 : 699;
        }
        return {
          productCode: p.productCode,
          durationMinutes: p.durationMinutes,
          price: Math.round(basePrice * multiplier),
          discountPrice: Math.round(basePrice * multiplier),
          enabled: true,
        };
      });
    }

    if (productCode) {
      targetProducts = targetProducts.filter((p: any) => p.productCode === productCode.toUpperCase());
    }

    if (!targetProducts.length) {
      return [];
    }

    // Fetch existing active bookings for this room on this date
    // An active booking is status in ['confirmed', 'checked_in', 'pending'] (where pending represents active hold)
    const dayStartUtc = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEndUtc = new Date(`${dateStr}T23:59:59.999Z`);

    const existingBookings = await this.bookingModel.find({
      "rooms.roomId": roomId,
      status: { $in: ["confirmed", "checked_in", "pending"] },
      $or: [
        {
          bookingType: { $in: ["day_rest", "freshen_up"] },
          "dayStayDetails.slotStartTime": { $gte: dayStartUtc, $lte: dayEndUtc },
        },
        {
          // Also check whole-day overnight check-in conflicts if applicable
          bookingType: "overnight",
          checkInDate: { $lte: dayEndUtc },
          checkOutDate: { $gte: dayStartUtc },
        },
      ],
    }).lean();

    const slots: TimeSlotAvailability[] = [];

    // Generate slots in 30-minute stepping increments
    for (const prod of targetProducts) {
      const duration = prod.durationMinutes;

      for (let curMins = opStartMins; curMins + duration <= opEndMins; curMins += 30) {
        const slotStartH = Math.floor(curMins / 60).toString().padStart(2, "0");
        const slotStartM = (curMins % 60).toString().padStart(2, "0");
        const slotEndMins = curMins + duration;
        const slotEndH = Math.floor(slotEndMins / 60).toString().padStart(2, "0");
        const slotEndM = (slotEndMins % 60).toString().padStart(2, "0");

        const slotStartTimeStr = `${slotStartH}:${slotStartM}`;
        const slotEndTimeStr = `${slotEndH}:${slotEndM}`;

        const slotStartUtc = new Date(`${dateStr}T${slotStartTimeStr}:00.000Z`);
        const slotEndUtc = new Date(`${dateStr}T${slotEndTimeStr}:00.000Z`);

        // Time window including turnaround requirement: [slotStartUtc, slotEndUtc + grace + buffer]
        const turnaroundEndUtc = new Date(slotEndUtc.getTime() + (graceMinutes + bufferMinutes) * 60000);

        // Count overlapping active reservations
        let overlappingUnits = 0;
        for (const bk of existingBookings) {
          if (bk.bookingType === "overnight") {
            // If overnight booking exists and uses standard capacity, reduce available pool
            overlappingUnits += (bk.roomsBookedCount || 1);
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

        const availableUnits = Math.max(0, totalAllocated - overlappingUnits);

        slots.push({
          startTime: slotStartTimeStr,
          endTime: slotEndTimeStr,
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
}
