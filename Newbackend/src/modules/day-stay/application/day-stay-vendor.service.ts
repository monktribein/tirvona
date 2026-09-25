import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { DayStayConfigUpdateDto, DayStayVendorBlockDto } from "../presentation/dtos/day-stay.dto";
import { addDays, istDateString, istDayBounds } from "../domain/day-stay-time";
import { canManageAllAshrams } from "../../../common/auth/ashram-access";
import { assignedAshramIds } from "../../../common/auth/ashram-scope";

const ADMIN_ROLES = ["admin", "super_admin"];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

@Injectable()
export class DayStayVendorService {
  private readonly logger = new Logger(DayStayVendorService.name);

  constructor(
    @InjectModel("Ashram") private readonly ashramModel: Model<any>,
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
    @InjectModel("Room") private readonly roomModel: Model<any>,
  ) {}

  /**
   * Loads a property the user may manage: platform admins manage every
   * property; owners and staff only their own / scoped ones.
   */
  private async findManageableAshram(ashramId: string, user: AuthenticatedUser, lean = false): Promise<any> {
    if (!isValidObjectId(ashramId)) {
      throw new NotFoundException("Property not found or you do not have permission");
    }
    const query = this.ashramModel.findById(ashramId);
    const ashram = lean ? await query.lean() : await query;
    // Same access rule as Stay Management (AshramsService.assertScope).
    const uid = String(user.id ?? user._id);
    const allowed =
      ashram &&
      (ADMIN_ROLES.includes(user.role) ||
        canManageAllAshrams(user) ||
        String(ashram.ownerId) === uid ||
        assignedAshramIds(user).includes(String(ashram._id)));
    if (!allowed) {
      throw new NotFoundException("Property not found or you do not have permission");
    }
    return ashram;
  }

  /**
   * Vendor quick toggle to block Day Stay for today, tomorrow, or custom dates.
   * Today/tomorrow are stored as concrete IST dates so a block never silently
   * carries over to the next day.
   */
  async blockDayStay(dto: DayStayVendorBlockDto, user: AuthenticatedUser): Promise<any> {
    const ashram = await this.findManageableAshram(dto.ashramId, user);

    if (!ashram.dayStayConfig) {
      ashram.dayStayConfig = { enabled: false };
    }

    const today = istDateString(new Date());
    const tomorrow = addDays(today, 1);
    const current: Date[] = ashram.dayStayConfig.blackoutDates || [];
    const toKey = (d: Date) => new Date(d).toISOString().slice(0, 10);
    const add = (dates: string[]) => {
      const keys = new Set(current.map(toKey));
      for (const d of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestException(`Invalid date ${d}`);
        if (!keys.has(d)) current.push(new Date(`${d}T00:00:00.000Z`));
      }
      ashram.dayStayConfig.blackoutDates = current;
    };
    const remove = (date: string) => {
      ashram.dayStayConfig.blackoutDates = current.filter((d) => toKey(d) !== date);
    };

    switch (dto.action) {
      case "today":
        add([today]);
        break;
      case "unblock_today":
        remove(today);
        ashram.dayStayConfig.isBlockedToday = false;
        break;
      case "tomorrow":
        add([tomorrow]);
        break;
      case "unblock_tomorrow":
        remove(tomorrow);
        ashram.dayStayConfig.isBlockedTomorrow = false;
        break;
      case "custom_dates":
        if (dto.dates?.length) add(dto.dates);
        break;
    }

    ashram.markModified("dayStayConfig");
    await ashram.save();
    return {
      success: true,
      dayStayConfig: ashram.dayStayConfig,
    };
  }

  /** Current Day Stay setup of a property and its rooms. */
  async getConfig(ashramId: string, user: AuthenticatedUser): Promise<any> {
    const ashram = await this.findManageableAshram(ashramId, user, true);
    const rooms = await this.roomModel
      .find({ ashramId, deletedAt: null })
      .select("name type totalInventory count dayStayConfig")
      .lean();
    return {
      ashramId: String(ashram._id),
      name: ashram.name,
      dayStayConfig: ashram.dayStayConfig ?? { enabled: false },
      rooms,
    };
  }

  /** Turn Day Stay on/off for a property and configure its rooms. */
  async updateConfig(ashramId: string, dto: DayStayConfigUpdateDto, user: AuthenticatedUser): Promise<any> {
    const ashram = await this.findManageableAshram(ashramId, user);
    const cfg = ashram.dayStayConfig ?? {};

    if (dto.enabled !== undefined) cfg.enabled = dto.enabled;
    if (dto.operatingHours) {
      const { start, end } = dto.operatingHours;
      if (!HHMM.test(start) || !HHMM.test(end) || start >= end) {
        throw new BadRequestException("Operating hours must be HH:mm with start before end");
      }
      cfg.operatingHours = { start, end };
    }
    if (dto.defaultGraceMinutes !== undefined) cfg.defaultGraceMinutes = dto.defaultGraceMinutes;
    if (dto.defaultHousekeepingBufferMinutes !== undefined) {
      cfg.defaultHousekeepingBufferMinutes = dto.defaultHousekeepingBufferMinutes;
    }
    if (cfg.enabled && ADMIN_ROLES.includes(user.role) && cfg.verificationStatus !== "verified") {
      cfg.verificationStatus = "verified";
      cfg.verificationData = { ...(cfg.verificationData ?? {}), verifiedAt: new Date(), verifiedBy: user.id };
    }
    ashram.dayStayConfig = cfg;
    ashram.markModified("dayStayConfig");
    await ashram.save();

    for (const r of dto.rooms ?? []) {
      if (!isValidObjectId(r.roomId)) throw new BadRequestException("Invalid roomId");
      const room = await this.roomModel.findOne({ _id: r.roomId, ashramId });
      if (!room) throw new NotFoundException(`Room ${r.roomId} not found in this property`);
      const rc = room.dayStayConfig ?? {};
      if (r.enabled !== undefined) {
        rc.enabled = Boolean(r.enabled);
        if (rc.enabled) rc.eligible = true;
      }
      if (r.allocatedInventory !== undefined) {
        const n = Number(r.allocatedInventory);
        const max = room.totalInventory ?? room.count ?? n;
        if (!Number.isInteger(n) || n < 0 || n > max) {
          throw new BadRequestException(`Allocated units must be between 0 and ${max}`);
        }
        rc.allocatedInventory = n;
      }
      if (Array.isArray(r.products)) {
        rc.products = r.products.map((p: any) => {
          const price = Number(p.price);
          const duration = Number(p.durationMinutes);
          if (!p.productCode || !["freshen_up", "day_rest"].includes(p.productType)) {
            throw new BadRequestException("Each product needs a code and type freshen_up/day_rest");
          }
          if (!(duration > 0) || !(price >= 0)) {
            throw new BadRequestException(`Invalid duration or price for ${p.productCode}`);
          }
          return {
            productCode: String(p.productCode).toUpperCase().trim(),
            productType: p.productType,
            durationMinutes: duration,
            price,
            discountPrice: Number(p.discountPrice) || 0,
            enabled: p.enabled !== false,
          };
        });
      }
      room.dayStayConfig = rc;
      room.markModified("dayStayConfig");
      await room.save();
    }

    this.logger.log(`Day Stay config updated for ${ashramId} by ${user.role} ${user.id}`);
    return this.getConfig(ashramId, user);
  }

  /**
   * Real-time Day Stay reception radar: upcoming arrivals, current resters, checkouts due, and overstays.
   */
  async getLiveRadar(ashramId: string, user: AuthenticatedUser): Promise<any> {
    await this.findManageableAshram(ashramId, user, true);

    const now = new Date();
    const { start: startOfToday, end: endOfToday } = istDayBounds(istDateString(now));

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
