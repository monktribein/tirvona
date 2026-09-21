import {
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { DayStayVendorBlockDto } from "../presentation/dtos/day-stay.dto";

@Injectable()
export class DayStayVendorService {
  private readonly logger = new Logger(DayStayVendorService.name);

  constructor(
    @InjectModel("Ashram") private readonly ashramModel: Model<any>,
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
    @InjectModel("Room") private readonly roomModel: Model<any>,
  ) {}

  /**
   * Vendor quick toggle to block Day Stay for today, tomorrow, or custom dates.
   */
  async blockDayStay(dto: DayStayVendorBlockDto, ownerId: string): Promise<any> {
    const ashram = await this.ashramModel.findOne({ _id: dto.ashramId, ownerId });
    if (!ashram) {
      throw new NotFoundException("Property not found or you do not have permission");
    }

    if (!ashram.dayStayConfig) {
      ashram.dayStayConfig = { enabled: false };
    }

    switch (dto.action) {
      case "today":
        ashram.dayStayConfig.isBlockedToday = true;
        break;
      case "unblock_today":
        ashram.dayStayConfig.isBlockedToday = false;
        break;
      case "tomorrow":
        ashram.dayStayConfig.isBlockedTomorrow = true;
        break;
      case "unblock_tomorrow":
        ashram.dayStayConfig.isBlockedTomorrow = false;
        break;
      case "custom_dates":
        if (dto.dates?.length) {
          const newDates = dto.dates.map((d) => new Date(`${d}T00:00:00.000Z`));
          ashram.dayStayConfig.blackoutDates = [
            ...(ashram.dayStayConfig.blackoutDates || []),
            ...newDates,
          ];
        }
        break;
    }

    await ashram.save();
    return {
      success: true,
      dayStayConfig: ashram.dayStayConfig,
    };
  }

  /**
   * Real-time Day Stay reception radar: upcoming arrivals, current resters, checkouts due, and overstays.
   */
  async getLiveRadar(ashramId: string, ownerId: string): Promise<any> {
    const ashram = await this.ashramModel.findOne({ _id: ashramId, ownerId }).lean();
    if (!ashram) {
      throw new NotFoundException("Property not found or permission denied");
    }

    const now = new Date();
    const startOfToday = new Date(now.toISOString().split("T")[0] + "T00:00:00.000Z");
    const endOfToday = new Date(now.toISOString().split("T")[0] + "T23:59:59.999Z");

    const bookings = await this.bookingModel
      .find({
        ashramId,
        bookingType: { $in: ["day_rest", "freshen_up"] },
        status: { $in: ["confirmed", "checked_in"] },
        "dayStayDetails.slotStartTime": { $gte: startOfToday, $lte: endOfToday },
      })
      .populate("customerId", "name phone email")
      .populate("rooms.roomId", "name type acType")
      .lean();

    const upcomingArrivals: any[] = [];
    const currentlyResting: any[] = [];
    const checkoutDue: any[] = [];
    const overstays: any[] = [];

    for (const bk of bookings) {
      const start = new Date(bk.dayStayDetails.slotStartTime);
      const end = new Date(bk.dayStayDetails.slotEndTime);
      const graceEnd = bk.dayStayDetails.graceExpiresAt
        ? new Date(bk.dayStayDetails.graceExpiresAt)
        : new Date(end.getTime() + 15 * 60000);

      if (bk.status === "confirmed" && now < start) {
        upcomingArrivals.push(bk);
      } else if (bk.status === "checked_in") {
        if (now <= end) {
          currentlyResting.push(bk);
        } else if (now > end && now <= graceEnd) {
          checkoutDue.push(bk);
        } else if (now > graceEnd) {
          overstays.push({
            ...bk,
            overstayMinutesElapsed: Math.floor((now.getTime() - graceEnd.getTime()) / 60000),
          });
        }
      }
    }

    return {
      upcomingArrivals,
      currentlyResting,
      checkoutDue,
      overstays,
      totalActiveToday: bookings.length,
    };
  }
}
