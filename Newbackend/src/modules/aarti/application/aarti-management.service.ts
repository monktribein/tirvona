import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { AARTI_MODEL } from "../domain/aarti.constants";
import { AartiException } from "../domain/aarti.errors";
import { aartiSlug, toDateKey } from "../domain/aarti.utils";
import { AartiAccessService, type AartiAccess } from "./aarti-access.service";
import type {
  AartiListQueryDto,
  ApproveAartiDto,
  BlockSeatsDto,
  CreateAartiPassTypeDto,
  CreateAartiSessionDto,
  CreateAartiStaffDto,
  UpdateAartiPassTypeDto,
  UpdateAartiSessionDto,
  UpsertAartiHolidayDto,
  UpsertAartiPricingDto,
  UpsertAartiSettingDto,
} from "../presentation/dtos/aarti.dto";

@Injectable()
export class AartiManagementService {
  constructor(
    private readonly accessService: AartiAccessService,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.PassType) private readonly passTypes: Model<any>,
    @InjectModel(AARTI_MODEL.Pricing) private readonly pricing: Model<any>,
    @InjectModel(AARTI_MODEL.Availability)
    private readonly availability: Model<any>,
    @InjectModel(AARTI_MODEL.Holiday) private readonly holidays: Model<any>,
    @InjectModel(AARTI_MODEL.Setting) private readonly settings: Model<any>,
    @InjectModel(AARTI_MODEL.Staff) private readonly staff: Model<any>,
    @InjectModel(AARTI_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(AARTI_MODEL.Stream) private readonly streams: Model<any>,
    @InjectModel(AARTI_MODEL.AshramRef) private readonly ashrams: Model<any>,
  ) {}

  private async assertOwnedSession(
    access: AartiAccess,
    sessionId: string,
  ): Promise<any> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new AartiException("Aarti not found.", 404);
    this.accessService.assertSession(access, session);
    return session;
  }

  async listAshrams(access: AartiAccess): Promise<any[]> {
    const filter = access.isPlatformAdmin || access.scopeAllAshrams
      ? {}
      : { _id: { $in: access.ashramIds } };
    return this.ashrams
      .find(filter)
      .select("name ashramCode address.city address.state ownerId status")
      .sort({ name: 1 })
      .limit(500)
      .lean();
  }

  async listSessions(
    access: AartiAccess,
    query: AartiListQueryDto,
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
      this.sessions
        .find(filter)
        .populate("ashramId", "name ashramCode")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.sessions.countDocuments(filter),
    ]);
    const withCounts = await Promise.all(
      data.map(async (row) => ({
        ...row,
        passTypeCount: await this.passTypes.countDocuments({
          sessionId: row._id,
        }),
        bookingCount: await this.bookings.countDocuments({
          sessionId: row._id,
          paymentStatus: "paid",
        }),
      })),
    );
    return { data: withCounts, total, page, limit };
  }

  async getSession(access: AartiAccess, id: string): Promise<any> {
    const session = await this.assertOwnedSession(access, id);
    return {
      session,
      passTypes: await this.passTypes
        .find({ sessionId: session._id })
        .sort({ displayOrder: 1 })
        .lean(),
      pricingRules: await this.pricing.find({ sessionId: session._id }).lean(),
      holidays: await this.holidays.find({ sessionId: session._id }).lean(),
      staff: await this.staff
        .find({ ashramId: session.ashramId, status: "active" })
        .populate("userId", "name email phone")
        .lean(),
    };
  }

  async createSession(
    user: AuthenticatedUser,
    access: AartiAccess,
    dto: CreateAartiSessionDto,
  ): Promise<any> {
    this.accessService.assertAshram(access, dto.ashramId);
    const ashram = await this.ashrams.findById(dto.ashramId).lean();
    if (!ashram) throw new AartiException("Ashram not found.", 404);
    return this.sessions.create({
      ...dto,
      ownerId: ashram.ownerId ?? user.id,
      slug: aartiSlug(dto.name, dto.venue?.city ?? ashram?.address?.city ?? ""),
      status: "draft",
    });
  }

  async updateSession(
    access: AartiAccess,
    id: string,
    dto: UpdateAartiSessionDto,
  ): Promise<any> {
    const session = await this.assertOwnedSession(access, id);
    // An approved listing that changes its ritual details goes back through
    // review — otherwise approval would be a one-time gate anyone could edit past.
    const rereviewFields = ["name", "kind", "deity", "venue", "startTime"];
    const needsReview =
      session.status === "approved" &&
      rereviewFields.some((field) => (dto as any)[field] !== undefined);
    Object.assign(session, dto);
    if (needsReview && !access.isPlatformAdmin) {
      session.status = "pending";
      session.submittedAt = new Date();
    }
    await session.save();
    return session;
  }

  async submitSession(access: AartiAccess, id: string): Promise<any> {
    const session = await this.assertOwnedSession(access, id);
    if (!["draft", "rejected"].includes(session.status))
      throw new AartiException(
        "Only a draft or rejected aarti can be submitted for review.",
        400,
      );
    if (!(await this.passTypes.exists({ sessionId: session._id, isActive: true })))
      throw new AartiException(
        "Add at least one active pass before submitting for review.",
        400,
      );
    session.status = "pending";
    session.submittedAt = new Date();
    session.rejectionReason = "";
    await session.save();
    return session;
  }

  async reviewSession(
    user: AuthenticatedUser,
    id: string,
    dto: ApproveAartiDto,
  ): Promise<any> {
    const session = await this.sessions.findById(id);
    if (!session) throw new AartiException("Aarti not found.", 404);
    if (dto.decision === "approve") {
      session.status = "approved";
      session.approvedAt = new Date();
      session.approvedBy = user.id;
      session.rejectionReason = "";
    } else {
      session.status = "rejected";
      session.rejectionReason = dto.reason || "Not approved";
    }
    await session.save();
    return session;
  }

  async setSessionStatus(id: string, status: string): Promise<any> {
    const session = await this.sessions.findById(id);
    if (!session) throw new AartiException("Aarti not found.", 404);
    session.status = status;
    await session.save();
    return session;
  }

  async setFeatured(id: string, isFeatured: boolean): Promise<any> {
    const session = await this.sessions.findById(id);
    if (!session) throw new AartiException("Aarti not found.", 404);
    session.isFeatured = isFeatured;
    await session.save();
    return session;
  }

  async deleteSession(access: AartiAccess, id: string): Promise<any> {
    const session = await this.assertOwnedSession(access, id);
    if (await this.bookings.exists({ sessionId: session._id }))
      throw new AartiException(
        "This Aarti has booking history and cannot be deleted.",
        409,
      );
    if (await this.streams.exists({ sessionId: session._id }))
      throw new AartiException(
        "Remove the linked Live Pooja before deleting this Aarti.",
        409,
      );

    await Promise.all([
      this.pricing.deleteMany({ sessionId: session._id }),
      this.availability.deleteMany({ sessionId: session._id }),
      this.holidays.deleteMany({ sessionId: session._id }),
      this.settings.deleteMany({ sessionId: session._id }),
      this.staff.updateMany(
        { sessionIds: session._id },
        { $pull: { sessionIds: session._id } },
      ),
      this.passTypes.deleteMany({ sessionId: session._id }),
    ]);
    await this.sessions.deleteOne({ _id: session._id });
    return { deleted: true, _id: session._id };
  }

  async createPassType(
    access: AartiAccess,
    dto: CreateAartiPassTypeDto,
  ): Promise<any> {
    const session = await this.assertOwnedSession(access, dto.sessionId);
    if (
      await this.passTypes.exists({
        sessionId: session._id,
        code: dto.code.toUpperCase(),
      })
    )
      throw new AartiException(
        "A pass with this code already exists for this aarti.",
        409,
      );
    const passType = await this.passTypes.create({
      ...dto,
      ashramId: session.ashramId,
    });
    await this.syncSessionCapacity(String(session._id));
    return passType;
  }

  async updatePassType(
    access: AartiAccess,
    id: string,
    dto: UpdateAartiPassTypeDto,
  ): Promise<any> {
    const passType = await this.passTypes.findById(id);
    if (!passType) throw new AartiException("Pass not found.", 404);
    await this.assertOwnedSession(access, String(passType.sessionId));
    Object.assign(passType, dto);
    await passType.save();
    await this.syncSessionCapacity(String(passType.sessionId));
    return passType;
  }

  async deletePassType(access: AartiAccess, id: string): Promise<any> {
    const passType = await this.passTypes.findById(id);
    if (!passType) throw new AartiException("Pass not found.", 404);
    await this.assertOwnedSession(access, String(passType.sessionId));
    if (
      await this.bookings.exists({
        passTypeId: passType._id,
        status: { $in: ["pending", "upcoming", "checked_in"] },
      })
    )
      throw new AartiException(
        "This pass has active bookings. Deactivate it instead.",
        409,
      );
    await passType.deleteOne();
    await this.syncSessionCapacity(String(passType.sessionId));
    return { deleted: true, _id: id };
  }

  private async syncSessionCapacity(sessionId: string): Promise<void> {
    const [aggregate] = await this.passTypes.aggregate([
      { $match: { sessionId: (await this.sessions.findById(sessionId))?._id } },
      { $group: { _id: null, total: { $sum: "$totalCapacity" } } },
    ]);
    await this.sessions.updateOne(
      { _id: sessionId },
      { $set: { totalCapacity: Number(aggregate?.total ?? 0) } },
    );
  }

  async upsertPricing(
    access: AartiAccess,
    dto: UpsertAartiPricingDto,
  ): Promise<any> {
    await this.assertOwnedSession(access, dto.sessionId);
    if (dto._id) {
      const row = await this.pricing.findById(dto._id);
      if (!row) throw new AartiException("Pricing rule not found.", 404);
      Object.assign(row, dto);
      await row.save();
      return row;
    }
    return this.pricing.create(dto);
  }

  async deletePricing(access: AartiAccess, id: string): Promise<any> {
    const row = await this.pricing.findById(id);
    if (!row) throw new AartiException("Pricing rule not found.", 404);
    await this.assertOwnedSession(access, String(row.sessionId));
    await row.deleteOne();
    return { deleted: true, _id: id };
  }

  async listPricing(access: AartiAccess, sessionId: string): Promise<any[]> {
    await this.assertOwnedSession(access, sessionId);
    return this.pricing.find({ sessionId }).sort({ priority: -1 }).lean();
  }

  async upsertHoliday(
    access: AartiAccess,
    dto: UpsertAartiHolidayDto,
  ): Promise<any> {
    if (dto.sessionId) await this.assertOwnedSession(access, dto.sessionId);
    else if (dto.ashramId) this.accessService.assertAshram(access, dto.ashramId);
    else if (!access.isPlatformAdmin)
      throw new AartiException(
        "Only the platform can create a global festival rule.",
        403,
      );
    if (dto._id) {
      const row = await this.holidays.findById(dto._id);
      if (!row) throw new AartiException("Festival rule not found.", 404);
      Object.assign(row, dto);
      await row.save();
      return row;
    }
    return this.holidays.create(dto);
  }

  async listHolidays(access: AartiAccess, sessionId?: string): Promise<any[]> {
    if (sessionId) {
      await this.assertOwnedSession(access, sessionId);
      return this.holidays.find({ sessionId }).sort({ startDate: 1 }).lean();
    }
    const filter = access.isPlatformAdmin || access.scopeAllAshrams
      ? {}
      : { ashramId: { $in: access.ashramIds } };
    return this.holidays.find(filter).sort({ startDate: 1 }).limit(200).lean();
  }

  async deleteHoliday(access: AartiAccess, id: string): Promise<any> {
    const row = await this.holidays.findById(id);
    if (!row) throw new AartiException("Festival rule not found.", 404);
    if (row.sessionId) await this.assertOwnedSession(access, String(row.sessionId));
    else if (row.ashramId)
      this.accessService.assertAshram(access, String(row.ashramId));
    else if (!access.isPlatformAdmin)
      throw new AartiException("Only the platform can remove this rule.", 403);
    await row.deleteOne();
    return { deleted: true, _id: id };
  }

  async calendar(
    access: AartiAccess,
    sessionId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any[]> {
    await this.assertOwnedSession(access, sessionId);
    return this.availability
      .find({
        sessionId,
        date: { $gte: toDateKey(fromDate), $lte: toDateKey(toDate) },
      })
      .populate("passTypeId", "name code")
      .sort({ date: 1 })
      .lean();
  }

  /**
   * Blocking is a `blockedCount` bump, never a `totalCapacity` cut: capacity is
   * the ashram's physical truth, and cutting it would silently oversell once the
   * block is lifted.
   */
  async blockSeats(access: AartiAccess, dto: BlockSeatsDto): Promise<any> {
    const session = await this.assertOwnedSession(access, dto.sessionId);
    const passType = await this.passTypes.findOne({
      _id: dto.passTypeId,
      sessionId: session._id,
    });
    if (!passType) throw new AartiException("Pass not found.", 404);
    const date = toDateKey(dto.date);
    const row = await this.availability.findOneAndUpdate(
      { passTypeId: passType._id, date },
      {
        $setOnInsert: {
          sessionId: session._id,
          passTypeId: passType._id,
          date,
          totalCapacity: Number(passType.totalCapacity),
          bookedCount: 0,
        },
        $set: {
          blockedCount: Math.max(0, Number(dto.blockedCount ?? 0)),
          ...(dto.isClosed === undefined ? {} : { isClosed: dto.isClosed }),
          ...(dto.customPrice === undefined
            ? {}
            : { customPrice: dto.customPrice }),
          ...(dto.note === undefined ? {} : { note: dto.note }),
        },
      },
      { upsert: true, new: true },
    );
    if (row.blockedCount + row.bookedCount > row.totalCapacity)
      throw new AartiException(
        "You cannot block more seats than are still unsold.",
        400,
      );
    return row;
  }

  async listBookings(
    access: AartiAccess,
    query: AartiListQueryDto,
  ): Promise<any> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const filter: Record<string, unknown> = {
      ...this.accessService.scopeFilter(access),
    };
    if (query.sessionId) filter.sessionId = query.sessionId;
    if (query.status) filter.status = query.status;
    if (query.date) filter.sessionDate = toDateKey(query.date);
    if (query.q)
      filter.bookingReference = new RegExp(escapeRegex(query.q), "i");
    const [data, total] = await Promise.all([
      this.bookings
        .find(filter)
        .populate("sessionId", "name slug startTime")
        .populate("passTypeId", "name code")
        .populate("customerId", "name email phone")
        .sort({ sessionDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.bookings.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async upsertSetting(
    user: AuthenticatedUser,
    access: AartiAccess,
    dto: UpsertAartiSettingDto,
  ): Promise<any> {
    if (dto.scope === "platform" && !access.isPlatformAdmin)
      throw new AartiException(
        "Only the platform can change platform-wide aarti settings.",
        403,
      );
    if (dto.scope === "session" && dto.sessionId)
      await this.assertOwnedSession(access, dto.sessionId);
    if (dto.scope === "ashram" && dto.ashramId)
      this.accessService.assertAshram(access, dto.ashramId);
    const filter = {
      scope: dto.scope,
      ashramId: dto.ashramId ?? null,
      sessionId: dto.sessionId ?? null,
    };
    return this.settings.findOneAndUpdate(
      filter,
      { $set: { ...dto, ...filter, updatedBy: user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async listSettings(access: AartiAccess): Promise<any[]> {
    const or: Record<string, unknown>[] = [{ scope: "platform" }];
    if (!access.isPlatformAdmin && !access.scopeAllAshrams)
      or.push(
        { scope: "ashram", ashramId: { $in: access.ashramIds } },
        { scope: "session", sessionId: { $in: access.sessionIds } },
      );
    else or.push({ scope: "ashram" }, { scope: "session" });
    return this.settings.find({ $or: or }).lean();
  }

  async listStaff(access: AartiAccess, ashramId?: string): Promise<any[]> {
    const filter: Record<string, unknown> = ashramId
      ? { ashramId }
      : this.accessService.scopeFilter(access);
    if (ashramId) this.accessService.assertAshram(access, ashramId);
    return this.staff
      .find(filter)
      .populate("userId", "name email phone role")
      .populate("ashramId", "name ashramCode")
      .sort({ createdAt: -1 })
      .lean();
  }

  async createStaff(
    user: AuthenticatedUser,
    access: AartiAccess,
    dto: CreateAartiStaffDto,
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
    access: AartiAccess,
    id: string,
    status: string,
  ): Promise<any> {
    const row = await this.staff.findById(id);
    if (!row) throw new AartiException("Staff member not found.", 404);
    this.accessService.assertAshram(access, String(row.ashramId));
    row.status = status;
    await row.save();
    return row;
  }
}
