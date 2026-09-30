import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { ACTIVE_STATUSES, TICKET_PRIORITIES, TICKET_STATUSES } from "../domain/support.constants";
import { isSupervisor } from "./support-access";
import { SupportTicketService } from "./support-ticket.service";

/** Start of "today" in India (UTC+5:30), where the support team works. */
export const startOfIstDay = (now = new Date()): Date => {
  const offset = 330 * 60_000;
  const ist = new Date(now.getTime() + offset);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - offset);
};

/**
 * Support KPIs. Every number is computed from stored ticket fields (response
 * and resolution minutes are written when they happen), scoped to the
 * tickets the viewer is allowed to see.
 */
@Injectable()
export class SupportDashboardService {
  constructor(
    @InjectModel("SupportTicket") private readonly tickets: Model<any>,
    @InjectModel("SupportCategory") private readonly categories: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    private readonly ticketService: SupportTicketService,
  ) {}

  async overview(user: AuthenticatedUser) {
    const scope = await this.ticketService.scopeFor(user);
    const within = (extra: Record<string, unknown>) =>
      Object.keys(scope).length ? { $and: [scope, extra] } : extra;
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const active = { status: { $in: ACTIVE_STATUSES } };

    const [
      total,
      byStatusRaw,
      byPriorityRaw,
      byCategoryRaw,
      urgentOpen,
      escalatedOpen,
      unassignedOpen,
      overdueOpen,
      resolvedToday,
      createdToday,
      responseRaw,
      resolutionRaw,
      workloadRaw,
      categoryRows,
    ] = await Promise.all([
      this.tickets.countDocuments(within({})),
      this.tickets.aggregate([{ $match: within({}) }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.tickets.aggregate([{ $match: within(active) }, { $group: { _id: "$priority", count: { $sum: 1 } } }]),
      this.tickets.aggregate([{ $match: within({}) }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
      this.tickets.countDocuments(within({ ...active, priority: "URGENT" })),
      this.tickets.countDocuments(within({ ...active, isEscalated: true })),
      this.tickets.countDocuments(within({ ...active, assignedTo: null })),
      this.tickets.countDocuments(
        within({
          ...active,
          $or: [
            { firstResponseAt: null, firstResponseDueAt: { $lt: now } },
            { resolutionDueAt: { $lt: now } },
          ],
        }),
      ),
      this.tickets.countDocuments(within({ resolvedAt: { $gte: startOfIstDay(now) } })),
      this.tickets.countDocuments(within({ createdAt: { $gte: startOfIstDay(now) } })),
      this.tickets.aggregate([
        { $match: within({ createdAt: { $gte: since30 }, firstResponseMinutes: { $gte: 0 } }) },
        { $group: { _id: null, avg: { $avg: "$firstResponseMinutes" }, count: { $sum: 1 } } },
      ]),
      this.tickets.aggregate([
        { $match: within({ resolvedAt: { $gte: since30 }, resolutionMinutes: { $gte: 0 } }) },
        { $group: { _id: null, avg: { $avg: "$resolutionMinutes" }, count: { $sum: 1 } } },
      ]),
      this.tickets.aggregate([
        { $match: within({ ...active, assignedTo: { $ne: null } }) },
        { $group: { _id: "$assignedTo", open: { $sum: 1 } } },
      ]),
      this.categories.find({}).select("key label").lean(),
    ]);

    const countMap = (rows: any[]) => new Map(rows.map((row: any) => [row._id, row.count]));
    const statusMap = countMap(byStatusRaw);
    const priorityMap = countMap(byPriorityRaw);
    const labels = new Map(categoryRows.map((row: any) => [row.key, row.label]));

    const staffIds = workloadRaw.map((row: any) => row._id);
    const staff = staffIds.length
      ? await this.users.find({ _id: { $in: staffIds } }).select("name role").lean()
      : [];
    const staffName = new Map(staff.map((s: any) => [String(s._id), s]));

    const avg = (rows: any[]) =>
      rows[0]?.count ? { minutes: Math.round(rows[0].avg), sample: rows[0].count } : { minutes: null, sample: 0 };

    return {
      scope: isSupervisor(user) ? "all" : "own_queue",
      totals: {
        total,
        open: statusMap.get("OPEN") ?? 0,
        inProgress: statusMap.get("IN_PROGRESS") ?? 0,
        waitingForUser: statusMap.get("WAITING_FOR_USER") ?? 0,
        reopened: statusMap.get("REOPENED") ?? 0,
        resolved: statusMap.get("RESOLVED") ?? 0,
        closed: statusMap.get("CLOSED") ?? 0,
        urgentOpen,
        escalatedOpen,
        unassignedOpen,
        overdueOpen,
        resolvedToday,
        createdToday,
      },
      averages: {
        /** Over tickets raised in the last 30 days that have had a first staff reply. */
        firstResponse: avg(responseRaw),
        /** Over tickets resolved in the last 30 days. */
        resolution: avg(resolutionRaw),
      },
      byStatus: TICKET_STATUSES.map((status) => ({ key: status, count: statusMap.get(status) ?? 0 })),
      byPriority: TICKET_PRIORITIES.map((priority) => ({ key: priority, count: priorityMap.get(priority) ?? 0 })),
      byCategory: byCategoryRaw
        .map((row: any) => ({ key: row._id, label: labels.get(row._id) ?? row._id, count: row.count }))
        .sort((a: any, b: any) => b.count - a.count),
      workload: workloadRaw
        .map((row: any) => {
          const person: any = staffName.get(String(row._id));
          return { userId: String(row._id), name: person?.name ?? "Former staff", role: person?.role ?? "", open: row.open };
        })
        .sort((a: any, b: any) => b.open - a.open),
    };
  }
}
