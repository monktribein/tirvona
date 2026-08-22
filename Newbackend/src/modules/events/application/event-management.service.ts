import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { EVENT_MODEL } from "../domain/event.constants";
import { EventException } from "../domain/event.errors";
import { datesInRange, eventSlug, toDateKey } from "../domain/event.utils";
import { EventAccessService, type EventAccess } from "./event-access.service";
import type {
  ApproveEventDto,
  BlockEventDayDto,
  CreateEventDto,
  CreateEventStaffDto,
  EventListQueryDto,
  ReportQueryDto,
  UpdateEventDto,
  UpsertEventSettingDto,
} from "../presentation/dtos/event.dto";

const oid = (value: string): Types.ObjectId => new Types.ObjectId(value);

@Injectable()
export class EventManagementService {
  constructor(
    private readonly accessService: EventAccessService,
    @InjectModel(EVENT_MODEL.Event) private readonly events: Model<any>,
    @InjectModel(EVENT_MODEL.Availability)
    private readonly availability: Model<any>,
    @InjectModel(EVENT_MODEL.Registration)
    private readonly registrations: Model<any>,
    @InjectModel(EVENT_MODEL.Staff) private readonly staff: Model<any>,
    @InjectModel(EVENT_MODEL.Setting) private readonly settings: Model<any>,
    @InjectModel(EVENT_MODEL.ScanLog) private readonly scanLogs: Model<any>,
    @InjectModel(EVENT_MODEL.AshramRef) private readonly ashrams: Model<any>,
  ) {}

  private async assertOwned(access: EventAccess, eventId: string): Promise<any> {
    const event = await this.events.findById(eventId);
    if (!event) throw new EventException("Event not found.", 404);
    this.accessService.assertEvent(access, event);
    return event;
  }

  listAshrams(access: EventAccess): Promise<any[]> {
    const filter =
      access.isPlatformAdmin || access.scopeAllAshrams
        ? {}
        : { _id: { $in: access.ashramIds } };
    return this.ashrams
      .find(filter)
      .select("name ashramCode address.city address.state ownerId status")
      .sort({ name: 1 })
      .limit(500)
      .lean();
  }

  async listEvents(
    access: EventAccess,
    query: EventListQueryDto,
  ): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const filter: Record<string, unknown> = {
      ...this.accessService.scopeFilter(access),
    };
    if (query.status) filter.status = query.status;
    if (query.ashramId) filter.ashramId = query.ashramId;
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), "i");
      filter.$or = [{ name: pattern }, { slug: pattern }, { deity: pattern }];
    }
    const [data, total] = await Promise.all([
      this.events
        .find(filter)
        .populate("ashramId", "name ashramCode")
        .sort({ startDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.events.countDocuments(filter),
    ]);
    const withCounts = await Promise.all(
      data.map(async (row) => ({
        ...row,
        registrationCount: await this.registrations.countDocuments({
          eventId: row._id,
          status: { $ne: "cancelled" },
        }),
        dayCount: datesInRange(row.startDate, row.endDate).length,
      })),
    );
    return { data: withCounts, total, page, limit };
  }

  async getEvent(access: EventAccess, id: string): Promise<any> {
    const event = await this.assertOwned(access, id);
    return {
      event,
      days: await this.availability
        .find({ eventId: event._id })
        .sort({ date: 1 })
        .lean(),
      staff: await this.staff
        .find({ ashramId: event.ashramId, status: "active" })
        .populate("userId", "name email phone")
        .lean(),
    };
  }

  async createEvent(
    user: AuthenticatedUser,
    access: EventAccess,
    dto: CreateEventDto,
  ): Promise<any> {
    this.accessService.assertAshram(access, dto.ashramId);
    const ashram = await this.ashrams.findById(dto.ashramId).lean();
    if (!ashram) throw new EventException("Ashram not found.", 404);
    if (toDateKey(dto.endDate) < toDateKey(dto.startDate))
      throw new EventException(
        "The event cannot end before it starts.",
        400,
        "INVALID_RANGE",
      );
    return this.events.create({
      ...dto,
      ownerId: ashram.ownerId ?? user.id,
      slug: eventSlug(dto.name, dto.venue?.city ?? ashram?.address?.city ?? ""),
      status: "draft",
    });
  }

  async updateEvent(
    access: EventAccess,
    id: string,
    dto: UpdateEventDto,
  ): Promise<any> {
    const event = await this.assertOwned(access, id);
    // Changing what the listing actually is sends it back through review;
    // otherwise approval would be a one-time gate anyone could edit past.
    const rereviewFields = ["name", "eventType", "venue", "startDate", "endDate"];
    const needsReview =
      event.status === "approved" &&
      rereviewFields.some((field) => (dto as any)[field] !== undefined);
    Object.assign(event, dto);
    if (toDateKey(event.endDate) < toDateKey(event.startDate))
      throw new EventException("The event cannot end before it starts.", 400);
    if (needsReview && !access.isPlatformAdmin) {
      event.status = "pending";
      event.submittedAt = new Date();
    }
    await event.save();
    return event;
  }

  async submitEvent(access: EventAccess, id: string): Promise<any> {
    const event = await this.assertOwned(access, id);
    if (!["draft", "rejected"].includes(event.status))
      throw new EventException(
        "Only a draft or rejected event can be submitted for review.",
        400,
      );
    event.status = "pending";
    event.submittedAt = new Date();
    event.rejectionReason = "";
    await event.save();
    return event;
  }

  async reviewEvent(
    user: AuthenticatedUser,
    id: string,
    dto: ApproveEventDto,
  ): Promise<any> {
    const event = await this.events.findById(id);
    if (!event) throw new EventException("Event not found.", 404);
    if (dto.decision === "approve") {
      event.status = "approved";
      event.approvedAt = new Date();
      event.approvedBy = user.id;
      event.rejectionReason = "";
    } else {
      event.status = "rejected";
      event.rejectionReason = dto.reason || "Not approved";
    }
    await event.save();
    return event;
  }

  async setStatus(id: string, status: string): Promise<any> {
    const event = await this.events.findById(id);
    if (!event) throw new EventException("Event not found.", 404);
    event.status = status;
    await event.save();
    return event;
  }

  async setFeatured(id: string, isFeatured: boolean): Promise<any> {
    const event = await this.events.findById(id);
    if (!event) throw new EventException("Event not found.", 404);
    event.isFeatured = isFeatured;
    await event.save();
    return event;
  }

  async deleteEvent(access: EventAccess, id: string): Promise<any> {
    const event = await this.assertOwned(access, id);
    if (await this.registrations.exists({ eventId: event._id }))
      throw new EventException(
        "This event has registration history and cannot be deleted.",
        409,
      );
    await Promise.all([
      this.availability.deleteMany({ eventId: event._id }),
      this.staff.updateMany(
        { eventIds: event._id },
        { $pull: { eventIds: event._id } },
      ),
      this.settings.deleteMany({ eventId: event._id }),
      this.scanLogs.deleteMany({ eventId: event._id }),
    ]);
    await this.events.deleteOne({ _id: event._id });
    return { deleted: true, _id: event._id };
  }

  async dayCalendar(access: EventAccess, id: string): Promise<any[]> {
    const event = await this.assertOwned(access, id);
    const rows = await this.availability.find({ eventId: event._id }).lean();
    return datesInRange(event.startDate, event.endDate).map((date) => {
      const row = rows.find(
        (candidate) => toDateKey(candidate.date).getTime() === date.getTime(),
      );
      return {
        date: date.toISOString().slice(0, 10),
        totalCapacity: Number(row?.totalCapacity ?? event.dailyCapacity ?? 0),
        bookedCount: Number(row?.bookedCount ?? 0),
        blockedCount: Number(row?.blockedCount ?? 0),
        isClosed: Boolean(row?.isClosed),
        note: row?.note ?? "",
      };
    });
  }

  /**
   * Blocking bumps `blockedCount`; it never lowers `totalCapacity`, because
   * capacity is the venue's physical truth and cutting it would oversell once
   * the block is lifted.
   */
  async blockDay(access: EventAccess, dto: BlockEventDayDto): Promise<any> {
    const event = await this.assertOwned(access, dto.eventId);
    const date = toDateKey(dto.date);
    const row = await this.availability.findOneAndUpdate(
      { eventId: event._id, date },
      {
        $setOnInsert: {
          eventId: event._id,
          ashramId: event.ashramId,
          date,
          bookedCount: 0,
        },
        $set: {
          totalCapacity: Number(
            dto.totalCapacity ?? event.dailyCapacity ?? 0,
          ),
          blockedCount: Math.max(0, Number(dto.blockedCount ?? 0)),
          ...(dto.isClosed === undefined ? {} : { isClosed: dto.isClosed }),
          ...(dto.note === undefined ? {} : { note: dto.note }),
        },
      },
      { upsert: true, new: true },
    );
    if (
      row.totalCapacity > 0 &&
      row.blockedCount + row.bookedCount > row.totalCapacity
    )
      throw new EventException(
        "You cannot block more places than are still unregistered.",
        400,
      );
    return row;
  }

  async listRegistrations(
    access: EventAccess,
    query: EventListQueryDto,
  ): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const filter: Record<string, unknown> = {
      ...this.accessService.scopeFilter(access),
    };
    if (query.eventId) filter.eventId = query.eventId;
    if (query.status) filter.status = query.status;
    if (query.date) filter.attendDate = toDateKey(query.date);
    if (query.q)
      filter.registrationReference = new RegExp(escapeRegex(query.q), "i");
    const [data, total] = await Promise.all([
      this.registrations
        .find(filter)
        .populate("eventId", "name slug startTime")
        .populate("customerId", "name email phone")
        .sort({ attendDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.registrations.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async dashboard(access: EventAccess, days = 30): Promise<any> {
    const since = new Date(Date.now() - days * 86_400_000);
    const scope =
      access.isPlatformAdmin || access.scopeAllAshrams
        ? {}
        : { ashramId: { $in: access.ashramIds.map(oid) } };
    const today = toDateKey(new Date());

    const [approved, pending, live, totals, byStatus, trend, topEvents, gate] =
      await Promise.all([
        this.events.countDocuments({ ...scope, status: "approved" }),
        this.events.countDocuments({ ...scope, status: "pending" }),
        this.events.countDocuments({
          ...scope,
          status: "approved",
          startDate: { $lte: today },
          endDate: { $gte: today },
        }),
        this.registrations.aggregate([
          { $match: { ...scope, createdAt: { $gte: since } } },
          {
            $group: {
              _id: null,
              registrations: { $sum: 1 },
              seats: { $sum: "$seats" },
              admitted: { $sum: "$checkedInCount" },
            },
          },
        ]),
        this.registrations.aggregate([
          { $match: { ...scope, createdAt: { $gte: since } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        this.registrations.aggregate([
          { $match: { ...scope, createdAt: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              registrations: { $sum: 1 },
              seats: { $sum: "$seats" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.registrations.aggregate([
          { $match: { ...scope, status: { $ne: "cancelled" } } },
          {
            $group: {
              _id: "$eventId",
              registrations: { $sum: 1 },
              seats: { $sum: "$seats" },
            },
          },
          { $sort: { seats: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "event_festivals",
              localField: "_id",
              foreignField: "_id",
              as: "event",
            },
          },
          { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 1,
              registrations: 1,
              seats: 1,
              name: "$event.name",
              slug: "$event.slug",
              city: "$event.venue.city",
              startDate: "$event.startDate",
            },
          },
        ]),
        this.scanLogs.aggregate([
          { $match: { ...scope, scannedAt: { $gte: since } } },
          { $group: { _id: "$result", count: { $sum: 1 } } },
        ]),
      ]);

    return {
      windowDays: days,
      events: { approved, pendingReview: pending, runningNow: live },
      totals: totals[0] ?? { registrations: 0, seats: 0, admitted: 0 },
      byStatus: Object.fromEntries(byStatus.map((row) => [row._id, row.count])),
      trend,
      topEvents,
      gateResults: Object.fromEntries(gate.map((row) => [row._id, row.count])),
    };
  }

  async listStaff(access: EventAccess, ashramId?: string): Promise<any[]> {
    if (ashramId) this.accessService.assertAshram(access, ashramId);
    const filter = ashramId
      ? { ashramId }
      : this.accessService.scopeFilter(access);
    return this.staff
      .find(filter)
      .populate("userId", "name email phone role")
      .populate("ashramId", "name ashramCode")
      .sort({ createdAt: -1 })
      .lean();
  }

  async createStaff(
    user: AuthenticatedUser,
    access: EventAccess,
    dto: CreateEventStaffDto,
  ): Promise<any> {
    this.accessService.assertAshram(access, dto.ashramId);
    const existing = await this.staff.findOne({
      userId: dto.userId,
      ashramId: dto.ashramId,
    });
    if (existing) {
      Object.assign(existing, dto, { status: "active" });
      await existing.save();
      return existing;
    }
    return this.staff.create({ ...dto, createdBy: user.id });
  }

  async setStaffStatus(
    access: EventAccess,
    id: string,
    status: string,
  ): Promise<any> {
    const row = await this.staff.findById(id);
    if (!row) throw new EventException("Staff member not found.", 404);
    this.accessService.assertAshram(access, String(row.ashramId));
    row.status = status;
    await row.save();
    return row;
  }

  async listSettings(access: EventAccess): Promise<any[]> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (!access.isPlatformAdmin && !access.scopeAllAshrams)
      or.push(
        { scope: "ashram", ashramId: { $in: access.ashramIds } },
        { scope: "event", eventId: { $in: access.eventIds } },
      );
    else or.push({ scope: "ashram" }, { scope: "event" });
    return this.settings.find({ $or: or }).lean();
  }

  async upsertSetting(
    user: AuthenticatedUser,
    access: EventAccess,
    dto: UpsertEventSettingDto,
  ): Promise<any> {
    if (dto.scope === "platform" && !access.isPlatformAdmin)
      throw new EventException(
        "Only the platform can change platform-wide event settings.",
        403,
      );
    if (dto.scope === "event" && dto.eventId)
      await this.assertOwned(access, dto.eventId);
    if (dto.scope === "ashram" && dto.ashramId)
      this.accessService.assertAshram(access, dto.ashramId);
    const filter = {
      scope: dto.scope,
      ashramId: dto.ashramId ?? null,
      eventId: dto.eventId ?? null,
    };
    return this.settings.findOneAndUpdate(
      filter,
      { $set: { ...dto, ...filter, updatedBy: user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  reportWindow(query: ReportQueryDto): number {
    return query.days ?? 30;
  }
}
