import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { PARKING_MODEL } from "../domain/parking.constants";

@Injectable()
export class ParkingReportService {
  constructor(
    @InjectModel(PARKING_MODEL.Booking) private readonly bookings: Model<any>,
    @InjectModel(PARKING_MODEL.Slot) private readonly slots: Model<any>,
    @InjectModel(PARKING_MODEL.Location) private readonly locations: Model<any>,
    @InjectModel(PARKING_MODEL.Commission)
    private readonly commissions: Model<any>,
    @InjectModel(PARKING_MODEL.Transaction)
    private readonly transactions: Model<any>,
  ) {}

  async dashboard(locationIds: string[]): Promise<any> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const [statuses, revenue, slotRows, arrivals, exits] = await Promise.all([
      this.bookings.aggregate([
        {
          $match: {
            locationId: {
              $in: locationIds.map((id) =>
                this.bookings.db.base.Types.ObjectId.createFromHexString(id),
              ),
            },
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.bookings.aggregate([
        {
          $match: {
            locationId: {
              $in: locationIds.map((id) =>
                this.bookings.db.base.Types.ObjectId.createFromHexString(id),
              ),
            },
            paymentStatus: "paid",
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: "$pricing.amountPaid" },
            commission: { $sum: "$commission.amount" },
            partnerEarning: { $sum: "$commission.partnerEarning" },
            bookings: { $sum: 1 },
          },
        },
      ]),
      this.slots.aggregate([
        {
          $match: {
            locationId: {
              $in: locationIds.map((id) =>
                this.slots.db.base.Types.ObjectId.createFromHexString(id),
              ),
            },
            isActive: true,
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      this.bookings.countDocuments({
        locationId: { $in: locationIds },
        status: "upcoming",
        entryAt: { $gte: start, $lte: end },
      }),
      this.bookings.countDocuments({
        locationId: { $in: locationIds },
        status: "checked_in",
        exitAt: { $gte: start, $lte: end },
      }),
    ]);
    const byStatus = Object.fromEntries(
      statuses.map((row) => [row._id, row.count]),
    );
    const bySlot = Object.fromEntries(
      slotRows.map((row) => [row._id, row.count]),
    );
    const totalSlots = Object.values(bySlot).reduce<number>(
      (sum, value) => sum + Number(value),
      0,
    );
    const occupied = Number(bySlot.occupied ?? 0);
    const money = revenue[0] ?? {};
    return {
      todayRevenue: money.revenue ?? 0,
      todayBookings: money.bookings ?? 0,
      todayCommission: money.commission ?? 0,
      todayPartnerEarning: money.partnerEarning ?? 0,
      occupiedSlots: occupied,
      availableSlots: bySlot.available ?? 0,
      reservedSlots: byStatus.upcoming ?? 0,
      maintenanceSlots: bySlot.maintenance ?? 0,
      totalSlots,
      expectedArrivals: arrivals,
      expectedExits: exits,
      occupancyPercent: totalSlots
        ? Number(((occupied / totalSlots) * 100).toFixed(1))
        : 0,
      currentlyParked: byStatus.checked_in ?? 0,
      statusBreakdown: byStatus,
    };
  }

  async reports(
    locationIds: string[],
    fromValue?: string,
    toValue?: string,
  ): Promise<any> {
    const from = new Date(fromValue ?? Date.now() - 30 * 86_400_000);
    const to = new Date(toValue ?? Date.now());
    const objectIds = locationIds.map((id) =>
      this.bookings.db.base.Types.ObjectId.createFromHexString(id),
    );
    const [revenueRows, statusRows, peakRows, stay, popular, occupancy] =
      await Promise.all([
        this.bookings.aggregate([
          {
            $match: {
              locationId: { $in: objectIds },
              paymentStatus: "paid",
              createdAt: { $gte: from, $lte: to },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              revenue: { $sum: "$pricing.amountPaid" },
              commission: { $sum: "$commission.amount" },
              partnerEarning: { $sum: "$commission.partnerEarning" },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.bookings.aggregate([
          {
            $match: {
              locationId: { $in: objectIds },
              createdAt: { $gte: from, $lte: to },
            },
          },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        this.bookings.aggregate([
          {
            $match: {
              locationId: { $in: objectIds },
              entryAt: { $gte: from, $lte: to },
              status: { $nin: ["cancelled", "expired"] },
            },
          },
          { $group: { _id: { $hour: "$entryAt" }, count: { $sum: 1 } } },
        ]),
        this.bookings.aggregate([
          {
            $match: {
              locationId: { $in: objectIds },
              status: "checked_out",
              checkedOutAt: { $gte: from, $lte: to },
              actualDurationMinutes: { $ne: null },
            },
          },
          {
            $group: {
              _id: null,
              averageMinutes: { $avg: "$actualDurationMinutes" },
              maxMinutes: { $max: "$actualDurationMinutes" },
              minMinutes: { $min: "$actualDurationMinutes" },
              count: { $sum: 1 },
            },
          },
        ]),
        this.bookings.aggregate([
          {
            $match: {
              locationId: { $in: objectIds },
              createdAt: { $gte: from, $lte: to },
              status: { $nin: ["cancelled", "expired"] },
            },
          },
          {
            $group: {
              _id: "$locationId",
              bookings: { $sum: 1 },
              revenue: { $sum: "$pricing.amountPaid" },
            },
          },
          { $sort: { bookings: -1 } },
          { $limit: 10 },
        ]),
        this.bookings.aggregate([
          {
            $match: {
              locationId: { $in: objectIds },
              status: { $in: ["upcoming", "checked_in", "checked_out"] },
              entryAt: { $gte: from, $lte: to },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$entryAt" } },
              vehicles: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);
    const byStatus = Object.fromEntries(
      statusRows.map((row) => [row._id, row.count]),
    );
    const total = Object.values(byStatus).reduce<number>(
      (sum, value) => sum + Number(value),
      0,
    );
    const totals = revenueRows.reduce(
      (sum, row) => ({
        revenue: sum.revenue + row.revenue,
        commission: sum.commission + row.commission,
        partnerEarning: sum.partnerEarning + row.partnerEarning,
        bookings: sum.bookings + row.bookings,
      }),
      { revenue: 0, commission: 0, partnerEarning: 0, bookings: 0 },
    );
    return {
      revenue: {
        series: revenueRows.map((row) => ({
          date: row._id,
          revenue: row.revenue,
          commission: row.commission,
          partnerEarning: row.partnerEarning,
          bookings: row.bookings,
        })),
        totals,
      },
      peakHours: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        count: peakRows.find((row) => row._id === hour)?.count ?? 0,
      })),
      cancellations: {
        total,
        cancelled: byStatus.cancelled ?? 0,
        noShow: byStatus.no_show ?? 0,
        completed: byStatus.checked_out ?? 0,
        cancellationRate: total
          ? Number((((byStatus.cancelled ?? 0) / total) * 100).toFixed(1))
          : 0,
        noShowRate: total
          ? Number((((byStatus.no_show ?? 0) / total) * 100).toFixed(1))
          : 0,
        byStatus,
      },
      averageStay: stay[0]
        ? {
            averageMinutes: Math.round(stay[0].averageMinutes),
            averageHours: Number((stay[0].averageMinutes / 60).toFixed(1)),
            maxMinutes: stay[0].maxMinutes,
            minMinutes: stay[0].minMinutes,
            count: stay[0].count,
          }
        : { averageMinutes: 0, averageHours: 0, count: 0 },
      popular,
      occupancy: occupancy.map((row) => ({
        date: row._id,
        vehicles: row.vehicles,
      })),
      range: { from, to },
    };
  }
}
