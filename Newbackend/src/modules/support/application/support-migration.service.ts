import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import {
  LEGACY_CATEGORY,
  LEGACY_PRIORITY,
  LEGACY_STATUS,
  PRIORITY_RANK,
  SLA_HOURS,
  type TicketPriority,
} from "../domain/support.constants";
import { SupportCategoryService } from "./support-category.service";
import { SupportTicketService } from "./support-ticket.service";

const HOUR = 60 * 60 * 1000;

/**
 * Runs on every boot; idempotent and safe with several instances.
 * 1. Seeds the default support categories (never overwrites admin edits).
 * 2. Upgrades tickets written by the first version of this module
 *    (lower-case status, `title`, embedded `messages`) in place: each gets a
 *    ticket number, the new status/priority/category values, and its
 *    messages moved into `support_ticket_messages`. A ticket is claimed by
 *    setting its number first, so two instances never upgrade the same one.
 */
@Injectable()
export class SupportMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SupportMigrationService.name);

  constructor(
    @InjectModel("SupportTicket") private readonly tickets: Model<any>,
    @InjectModel("SupportMessage") private readonly messages: Model<any>,
    @InjectModel("SupportActivity") private readonly activities: Model<any>,
    private readonly categories: SupportCategoryService,
    private readonly ticketService: SupportTicketService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const seeded = await this.categories.seedDefaults();
      if (seeded) this.logger.log(`Seeded ${seeded} support categor${seeded === 1 ? "y" : "ies"}.`);
      const upgraded = await this.upgradeLegacyTickets();
      if (upgraded) this.logger.log(`Upgraded ${upgraded} legacy support ticket(s).`);
    } catch (error) {
      // A failed upgrade must not stop the API from starting; it retries next boot.
      this.logger.error(`Support migration failed: ${(error as Error).message}`);
    }
  }

  async upgradeLegacyTickets(): Promise<number> {
    const legacy = await this.tickets
      .find({ ticketNumber: { $exists: false } })
      .sort({ createdAt: 1 })
      .limit(5000)
      .lean();
    let upgraded = 0;
    for (const row of legacy as any[]) {
      const ticketNumber = await this.ticketService.nextTicketNumber();
      const claimed = await this.tickets
        .findOneAndUpdate(
          { _id: row._id, ticketNumber: { $exists: false } },
          { $set: { ticketNumber } },
          { new: true, strict: false },
        )
        .lean();
      if (!claimed) continue;

      const createdAt = new Date(row.createdAt ?? Date.now());
      const status = LEGACY_STATUS[row.status] ?? (row.status && String(row.status).toUpperCase()) ?? "OPEN";
      const priority: TicketPriority = LEGACY_PRIORITY[row.priority] ?? "MEDIUM";
      const categoryKey = LEGACY_CATEGORY[row.category] ?? row.category ?? "other";
      const category = await this.categories.find(categoryKey);
      const userId = String(row.userId);

      const oldMessages: any[] = Array.isArray(row.messages) ? row.messages : [];
      const converted = oldMessages
        .filter((m) => m && m.text)
        .map((m) => {
          const at = new Date(m.timestamp ?? createdAt);
          const fromCustomer = String(m.senderId) === userId;
          return {
            ticketId: row._id,
            senderId: m.senderId ?? null,
            senderType: fromCustomer ? "user" : "staff",
            senderRole: fromCustomer ? "customer" : "support",
            internal: false,
            body: String(m.text).slice(0, 5000),
            readAt: at,
            createdAt: at,
            updatedAt: at,
          };
        });
      if (converted.length) await this.messages.create(converted);
      const firstStaff = converted.find((m) => m.senderType === "staff");
      const lastUser = [...converted].reverse().find((m) => m.senderType === "user");
      const lastStaff = [...converted].reverse().find((m) => m.senderType === "staff");
      const last = converted[converted.length - 1];
      const resolvedAt = status === "RESOLVED" ? new Date(row.updatedAt ?? createdAt) : null;

      await this.tickets.updateOne(
        { _id: row._id },
        {
          $set: {
            subject: String(row.title ?? row.subject ?? "Support request").slice(0, 200),
            status,
            priority,
            priorityRank: PRIORITY_RANK[priority],
            category: category ? category.key : "other",
            categoryLabel: category?.label ?? "Other",
            source: "web",
            messageCount: converted.length,
            unreadForUser: 0,
            unreadForStaff: 0,
            lastMessageAt: last?.createdAt ?? null,
            lastUserMessageAt: lastUser?.createdAt ?? null,
            lastStaffMessageAt: lastStaff?.createdAt ?? null,
            lastActivityAt: new Date(row.updatedAt ?? createdAt),
            firstResponseDueAt: new Date(createdAt.getTime() + SLA_HOURS[priority].firstResponse * HOUR),
            resolutionDueAt: new Date(createdAt.getTime() + SLA_HOURS[priority].resolution * HOUR),
            firstResponseAt: firstStaff?.createdAt ?? null,
            firstResponseMinutes: firstStaff
              ? Math.round((firstStaff.createdAt.getTime() - createdAt.getTime()) / 60_000)
              : null,
            resolvedAt,
            resolutionMinutes: resolvedAt
              ? Math.round((resolvedAt.getTime() - createdAt.getTime()) / 60_000)
              : null,
            isEscalated: false,
            reopenedCount: 0,
          },
          $unset: { title: 1, messages: 1 },
        },
        { strict: false },
      );
      await this.activities.create({
        ticketId: row._id,
        actorRole: "system",
        actorName: "System",
        action: "created",
        to: status,
        note: "Imported from the previous support system",
        visibleToUser: true,
        createdAt,
      });
      upgraded++;
    }
    return upgraded;
  }
}
