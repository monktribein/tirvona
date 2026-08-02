import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel("Booking") private readonly bookings: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
    @InjectModel("Room") private readonly rooms: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("BookingAuditLog") private readonly audits: Model<any>,
    @InjectModel("AuditLog") private readonly platformAudits: Model<any>,
  ) {}
  private async scope(
    user: AuthenticatedUser,
    requested?: string,
  ): Promise<any> {
    if (user.role === "super_admin") return requested ? requested : undefined;
    const ids =
      user.role === "owner"
        ? (
            await this.ashrams.find({ ownerId: user.id }).select("_id").lean()
          ).map((a: any) => String(a._id))
        : [
            ...new Set([
              ...(user.scopedAshramIds ?? []),
              ...(user.employerAshramId ? [user.employerAshramId] : []),
            ]),
          ];
    if (requested && !ids.includes(requested))
      throw new ForbiddenException("Not authorized for this ashram");
    return requested ?? { $in: ids };
  }
  async dashboard(user: AuthenticatedUser, requested?: string): Promise<any> {
    const ashramId = await this.scope(user, requested);
    const query: any = ashramId ? { ashramId } : {};
    const [bookings, stays, rooms] = await Promise.all([
      this.bookings.find(query).lean(),
      this.ashrams.find(ashramId ? { _id: ashramId } : {}).lean(),
      this.rooms.find(ashramId ? { ashramId } : {}).lean(),
    ]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const paid = (b: any) => Number(b.pricing?.amountPaid ?? 0);
    const confirmed = bookings.filter(
      (b: any) => b.status === "confirmed",
    ).length;
    const checkedIn = bookings.filter(
      (b: any) => b.status === "checked_in",
    ).length;
    const totalInventory = rooms.reduce(
      (n: number, r: any) => n + Number(r.totalInventory ?? 0),
      0,
    );
    const occupied = bookings
      .filter(
        (b: any) =>
          ["confirmed", "checked_in"].includes(b.status) &&
          new Date(b.checkInDate) <= new Date() &&
          new Date(b.checkOutDate) >= new Date(),
      )
      .reduce((n: number, b: any) => n + Number(b.roomsBookedCount ?? 1), 0);
    return {
      totalBookings: bookings.length,
      occupancyRate: bookings.length
        ? Math.min(
            100,
            Math.round(((confirmed + checkedIn) * 100) / bookings.length),
          )
        : 0,
      revenue: bookings.reduce((n: number, b: any) => n + paid(b), 0),
      pendingPayments: bookings.reduce(
        (n: number, b: any) =>
          n + Math.max(0, Number(b.pricing?.totalAmount ?? 0) - paid(b)),
        0,
      ),
      checkInsToday: checkedIn,
      checkoutSoon: checkedIn,
      todayRevenue: bookings
        .filter((b: any) => new Date(b.createdAt) >= today)
        .reduce((n: number, b: any) => n + paid(b), 0),
      monthlyRevenue: bookings
        .filter((b: any) => new Date(b.createdAt) >= month)
        .reduce((n: number, b: any) => n + paid(b), 0),
      availableRooms: Math.max(0, totalInventory - occupied),
      cancelledBookings: bookings.filter((b: any) => b.status === "cancelled")
        .length,
      averageRating: stays.length
        ? Number(
            (
              stays.reduce(
                (n: number, a: any) => n + Number(a.rating?.average ?? 0),
                0,
              ) / stays.length
            ).toFixed(1),
          )
        : 0,
    };
  }
  private jurisdictionFilter(user: AuthenticatedUser): Record<string, any> {
    if (["super_admin", "national_admin"].includes(user.role)) return {};
    if (!user.state)
      throw new ForbiddenException("A state jurisdiction must be assigned");
    if (["district_officer", "inspector"].includes(user.role)) {
      if (!user.district)
        throw new ForbiddenException(
          "A district jurisdiction must be assigned",
        );
      return { "address.state": user.state, "address.district": user.district };
    }
    return { "address.state": user.state };
  }

  async system(user: AuthenticatedUser): Promise<any> {
    const ashramFilter = this.jurisdictionFilter(user);
    const scopedAshrams = await this.ashrams
      .find(ashramFilter)
      .select("_id ownerId")
      .lean();
    const ashramIds = scopedAshrams.map((ashram: any) => ashram._id);
    const bookingFilter = { ashramId: { $in: ashramIds } };
    const scopedBookings = await this.bookings.find(bookingFilter).lean();
    const scopedOwnerCount = new Set(
      scopedAshrams
        .map((ashram: any) => String(ashram.ownerId))
        .filter(Boolean),
    ).size;
    const scopedPilgrimCount = new Set(
      scopedBookings
        .map((booking: any) => String(booking.userId))
        .filter(Boolean),
    ).size;
    const [
      total,
      approved,
      pending,
      rejected,
      pilgrims,
      owners,
      bookings,
      destinations,
      districtStats,
    ] = await Promise.all([
      this.ashrams.countDocuments(ashramFilter),
      this.ashrams.countDocuments({ ...ashramFilter, status: "approved" }),
      this.ashrams.countDocuments({
        ...ashramFilter,
        status: { $in: ["pending_docs", "pending_inspection"] },
      }),
      this.ashrams.countDocuments({ ...ashramFilter, status: "rejected" }),
      Promise.resolve(scopedPilgrimCount),
      Promise.resolve(scopedOwnerCount),
      Promise.resolve(scopedBookings),
      this.ashrams.aggregate([
        { $match: { ...ashramFilter, status: "approved" } },
        { $group: { _id: "$address.city", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      this.ashrams.aggregate([
        { $match: ashramFilter },
        {
          $group: {
            _id: "$address.district",
            approved: {
              $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
            },
            pending: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending_inspection"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { approved: -1 } },
      ]),
    ]);
    const cancellations = bookings.filter(
      (b: any) => b.status === "cancelled",
    ).length;
    return {
      ashrams: { total, approved, pending, rejected },
      users: { pilgrims, owners },
      financials: {
        revenue: bookings.reduce(
          (n: number, b: any) => n + Number(b.pricing?.amountPaid ?? 0),
          0,
        ),
        cancellationRate: bookings.length
          ? Math.round((cancellations * 100) / bookings.length)
          : 0,
        totalBookings: bookings.length,
        approvalRate:
          approved + rejected
            ? Math.round((approved * 100) / (approved + rejected))
            : 0,
        monthlyInspections: [],
      },
      popularDestinations: destinations.map((x: any) => ({
        city: x._id,
        count: x.count,
      })),
      districtStats: districtStats.map((x: any) => ({
        district: x._id || "Unknown",
        approved: x.approved,
        pending: x.pending,
      })),
    };
  }
  async logs(module?: string, action?: string): Promise<any[]> {
    const filter = {
      ...(module ? { module } : {}),
      ...(action ? { action } : {}),
    };
    const [platform, booking] = await Promise.all([
      this.platformAudits
        .find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
      this.audits
        .find(filter)
        .populate("userId", "name email role")
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
    ]);
    return [...platform, ...booking]
      .sort(
        (a: any, b: any) =>
          new Date(b.timestamp ?? b.occurredAt).getTime() -
          new Date(a.timestamp ?? a.occurredAt).getTime(),
      )
      .slice(0, 100);
  }
}
