import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import { AARTI_MODEL } from "../domain/aarti.constants";
import { toDateKey } from "../domain/aarti.utils";
import { AartiAccessService, type AartiAccess } from "./aarti-access.service";

const oid = (value: string): Types.ObjectId => new Types.ObjectId(value);

@Injectable()
export class AartiReportService {
  constructor(
    private readonly accessService: AartiAccessService,
    @InjectModel(AARTI_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(AARTI_MODEL.Session) private readonly sessions: Model<any>,
    @InjectModel(AARTI_MODEL.Commission)
    private readonly commissions: Model<any>,
    @InjectModel(AARTI_MODEL.Stream) private readonly streams: Model<any>,
    @InjectModel(AARTI_MODEL.ScanLog) private readonly scanLogs: Model<any>,
  ) {}

  private scope(access: AartiAccess): Record<string, unknown> {
    if (access.isPlatformAdmin || access.scopeAllAshrams) return {};
    return { ashramId: { $in: access.ashramIds.map(oid) } };
  }

  async dashboard(access: AartiAccess, days = 30): Promise<any> {
    const since = new Date(Date.now() - days * 86_400_000);
    const scope = this.scope(access);
    const paid = { ...scope, paymentStatus: "paid" };

    const [
      sessionCount,
      pendingSessions,
      streamCount,
      liveStreams,
      totals,
      byStatus,
      trend,
      topSessions,
      commissionTotals,
    ] = await Promise.all([
      this.sessions.countDocuments({ ...scope, status: "approved" }),
      this.sessions.countDocuments({ ...scope, status: "pending" }),
      this.streams.countDocuments({ ...scope, status: "approved" }),
      this.streams.countDocuments({
        ...scope,
        status: "approved",
        startsAt: { $lte: new Date() },
        $or: [{ endsAt: null }, { endsAt: { $gte: new Date() } }],
      }),
      this.bookings.aggregate([
        { $match: { ...paid, createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            bookings: { $sum: 1 },
            passes: { $sum: "$passCount" },
            gross: { $sum: "$pricing.totalAmount" },
            donations: { $sum: "$pricing.donationAmount" },
            refunds: { $sum: "$pricing.refundAmount" },
          },
        },
      ]),
      this.bookings.aggregate([
        { $match: { ...scope, createdAt: { $gte: since } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.bookings.aggregate([
        { $match: { ...paid, createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            bookings: { $sum: 1 },
            passes: { $sum: "$passCount" },
            revenue: { $sum: "$pricing.totalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.bookings.aggregate([
        { $match: { ...paid, createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$sessionId",
            bookings: { $sum: 1 },
            passes: { $sum: "$passCount" },
            revenue: { $sum: "$pricing.totalAmount" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "aarti_sessions",
            localField: "_id",
            foreignField: "_id",
            as: "session",
          },
        },
        { $unwind: { path: "$session", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            bookings: 1,
            passes: 1,
            revenue: 1,
            name: "$session.name",
            slug: "$session.slug",
            city: "$session.venue.city",
          },
        },
      ]),
      this.commissions.aggregate([
        { $match: { ...scope, createdAt: { $gte: since } } },
        {
          $group: {
            _id: "$settlementStatus",
            amount: { $sum: "$ashramEarning" },
            commission: { $sum: "$commissionAmount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      windowDays: days,
      sessions: { approved: sessionCount, pendingReview: pendingSessions },
      streams: { approved: streamCount, liveNow: liveStreams },
      totals: totals[0] ?? {
        bookings: 0,
        passes: 0,
        gross: 0,
        donations: 0,
        refunds: 0,
      },
      byStatus: Object.fromEntries(
        byStatus.map((row) => [row._id, row.count]),
      ),
      trend,
      topSessions,
      settlements: commissionTotals,
    };
  }

  async sessionReport(
    access: AartiAccess,
    sessionId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> {
    const session = await this.sessions.findById(sessionId);
    if (session) this.accessService.assertSession(access, session);
    const range = {
      $gte: toDateKey(fromDate),
      $lte: toDateKey(toDate),
    };
    const [byDate, byPassType, gate] = await Promise.all([
      this.bookings.aggregate([
        {
          $match: {
            sessionId: oid(sessionId),
            paymentStatus: "paid",
            sessionDate: range,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$sessionDate" } },
            bookings: { $sum: 1 },
            passes: { $sum: "$passCount" },
            admitted: { $sum: "$checkedInCount" },
            revenue: { $sum: "$pricing.totalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      this.bookings.aggregate([
        {
          $match: {
            sessionId: oid(sessionId),
            paymentStatus: "paid",
            sessionDate: range,
          },
        },
        {
          $group: {
            _id: "$passTypeId",
            passes: { $sum: "$passCount" },
            revenue: { $sum: "$pricing.totalAmount" },
          },
        },
        {
          $lookup: {
            from: "aarti_pass_types",
            localField: "_id",
            foreignField: "_id",
            as: "passType",
          },
        },
        { $unwind: { path: "$passType", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            passes: 1,
            revenue: 1,
            name: "$passType.name",
            code: "$passType.code",
          },
        },
      ]),
      this.scanLogs.aggregate([
        { $match: { sessionId: oid(sessionId) } },
        { $group: { _id: "$result", count: { $sum: 1 } } },
      ]),
    ]);
    return {
      session: session
        ? { _id: session._id, name: session.name, slug: session.slug }
        : null,
      byDate,
      byPassType,
      gateResults: Object.fromEntries(gate.map((row) => [row._id, row.count])),
    };
  }

  async settlements(access: AartiAccess, status?: string): Promise<any> {
    const filter: Record<string, unknown> = {
      ...this.scope(access),
      ...(status ? { settlementStatus: status } : {}),
    };
    const [rows, totals] = await Promise.all([
      this.commissions
        .find(filter)
        .populate("sessionId", "name slug")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
      this.commissions.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            gross: { $sum: "$grossAmount" },
            commission: { $sum: "$commissionAmount" },
            payable: { $sum: "$ashramEarning" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);
    return {
      data: rows,
      totals: totals[0] ?? { gross: 0, commission: 0, payable: 0, count: 0 },
    };
  }
}
