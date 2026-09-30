import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import {
  ACTIVE_STATUSES,
  FINISHED_STATUSES,
  LEGACY_CATEGORY,
  PRIORITY_RANK,
  REOPEN_WINDOW_DAYS,
  SLA_HOURS,
  STAFF_TRANSITIONS,
  SUPPORT_AGENT_ROLE,
  SUPPORT_HANDLER_ROLES,
  SUPPORT_MANAGE_ALL_PERMISSION,
  type TicketPriority,
  type TicketStatus,
} from "../domain/support.constants";
import type {
  AdminCreateTicketDto,
  AdminTicketsQueryDto,
  CreateTicketDto,
  MyTicketsQueryDto,
  StaffReplyDto,
  UpdateTicketDto,
} from "../presentation/support.dto";
import { canStaffSee, isStaff, isSupervisor, staffScopeFilter } from "./support-access";
import { SupportAttachmentService } from "./support-attachment.service";
import { SupportCategoryService } from "./support-category.service";
import { SupportEntityService } from "./support-entity.service";

const HOUR = 60 * 60 * 1000;
const minutesSince = (from: Date | string, to = new Date()) =>
  Math.max(0, Math.round((to.getTime() - new Date(from).getTime()) / 60_000));
const idOf = (value: unknown): string | null =>
  value ? String((value as any)?._id ?? value) : null;
const firstName = (name?: string) => String(name ?? "").trim().split(/\s+/)[0] || "";

type Actor = AuthenticatedUser;

@Injectable()
export class SupportTicketService {
  private readonly logger = new Logger(SupportTicketService.name);

  constructor(
    @InjectModel("SupportTicket") private readonly tickets: Model<any>,
    @InjectModel("SupportMessage") private readonly messages: Model<any>,
    @InjectModel("SupportActivity") private readonly activities: Model<any>,
    @InjectModel("SupportCounter") private readonly counters: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    @InjectModel("AuditLog") private readonly auditLogs: Model<any>,
    private readonly categories: SupportCategoryService,
    private readonly entities: SupportEntityService,
    private readonly attachments: SupportAttachmentService,
    private readonly notifier: InAppNotificationService,
  ) {}

  // =================================================================== shared

  /** TIR-000001, TIR-000002, … from one atomic counter, so two requests never share a number. */
  async nextTicketNumber(): Promise<string> {
    const row: any = await this.counters
      .findOneAndUpdate(
        { key: "ticket" },
        { $inc: { seq: 1 }, $setOnInsert: { key: "ticket" } },
        { upsert: true, new: true },
      )
      .lean();
    return `TIR-${String(row.seq).padStart(6, "0")}`;
  }

  private slaDue(priority: TicketPriority, from = new Date()) {
    const sla = SLA_HOURS[priority];
    return {
      firstResponseDueAt: new Date(from.getTime() + sla.firstResponse * HOUR),
      resolutionDueAt: new Date(from.getTime() + sla.resolution * HOUR),
    };
  }

  private assertId(id: string): void {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("Ticket not found");
  }

  private async activity(
    ticketId: unknown,
    actor: Actor | null,
    action: string,
    extra: { from?: string; to?: string; note?: string; visibleToUser?: boolean } = {},
  ): Promise<void> {
    await this.activities.create({
      ticketId,
      actorId: actor?.id ?? null,
      actorRole: actor?.role ?? "system",
      actorName: actor?.name ?? "System",
      action,
      from: extra.from ?? "",
      to: extra.to ?? "",
      note: extra.note ?? "",
      visibleToUser: extra.visibleToUser ?? false,
    });
  }

  private async audit(actor: Actor, action: string, ticket: any, details: Record<string, unknown> = {}) {
    try {
      await this.auditLogs.create({
        userId: actor.id,
        action: `support.${action}`,
        module: "support",
        details: {
          entity: "ticket",
          entityId: String(ticket._id),
          ticketNumber: ticket.ticketNumber,
          actorRole: actor.role,
          ...details,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      // Auditing must never break the action it records.
      this.logger.error(`Audit write failed for support.${action}: ${(error as Error).message}`);
    }
  }

  private customerLink = (ticket: any) => `/profile/support/${ticket._id}`;
  private staffLink = (ticket: any) => `/admin/support/tickets/${ticket._id}`;

  private notifyCustomer(ticket: any, title: string, body: string, kind: string) {
    return this.notifier.notifyUsers([idOf(ticket.userId)!], {
      title,
      body,
      deepLink: this.customerLink(ticket),
      kind,
    });
  }

  private notifyStaff(userIds: Array<string | null>, ticket: any, title: string, body: string, kind: string, except?: string) {
    const ids = userIds.filter((id): id is string => Boolean(id) && id !== except);
    return this.notifier.notifyUsers(ids, { title, body, deepLink: this.staffLink(ticket), kind });
  }

  /** Who hears about an unassigned ticket: support agents plus the category's handler roles (and super admins when urgent). */
  private async staffPool(ticket: any): Promise<string[]> {
    const category: any = await this.categories.find(ticket.category);
    const roles = [SUPPORT_AGENT_ROLE, ...(category?.handlerRoles ?? [])];
    if (ticket.priority === "URGENT") roles.push("super_admin");
    const rows = await this.users
      .find({ role: { $in: roles }, status: "active", isDeleted: { $ne: true } })
      .select("_id")
      .limit(200)
      .lean();
    return rows.map((row: any) => String(row._id));
  }

  private async supervisors(): Promise<string[]> {
    const rows = await this.users
      .find({
        status: "active",
        isDeleted: { $ne: true },
        $or: [
          { role: "super_admin" },
          { role: SUPPORT_AGENT_ROLE, permissions: SUPPORT_MANAGE_ALL_PERMISSION },
        ],
      })
      .select("_id")
      .limit(100)
      .lean();
    return rows.map((row: any) => String(row._id));
  }

  /**
   * Moves a ticket to `to`, only if it is still in the status we read —
   * two agents acting at once cannot overwrite each other's change.
   */
  private async transition(ticket: any, to: TicketStatus, actor: Actor | null, note = ""): Promise<any> {
    const from = ticket.status as TicketStatus;
    if (from === to) return ticket;
    const now = new Date();
    const set: Record<string, unknown> = { status: to, lastActivityAt: now };
    const inc: Record<string, number> = {};
    if (to === "RESOLVED") {
      set.resolvedAt = now;
      set.resolutionMinutes = minutesSince(ticket.createdAt, now);
    } else if (to === "CLOSED") {
      set.closedAt = now;
    } else if (to === "REOPENED") {
      inc.reopenedCount = 1;
      set.resolvedAt = null;
      set.resolutionMinutes = null;
      set.closedAt = null;
      set.resolutionDueAt = this.slaDue(ticket.priority, now).resolutionDueAt;
    } else if ((FINISHED_STATUSES as string[]).includes(from)) {
      set.resolvedAt = null;
      set.resolutionMinutes = null;
      set.closedAt = null;
    }
    const updated = await this.tickets
      .findOneAndUpdate(
        { _id: ticket._id, status: from },
        Object.keys(inc).length ? { $set: set, $inc: inc } : { $set: set },
        { new: true },
      )
      .lean();
    if (!updated)
      throw new ConflictException("This ticket was just updated by someone else. Please refresh and try again.");
    await this.activity(ticket._id, actor, "status_changed", { from, to, note, visibleToUser: true });
    return updated;
  }

  private statusMessage(status: TicketStatus): string {
    switch (status) {
      case "IN_PROGRESS": return "Our team is working on your ticket.";
      case "WAITING_FOR_USER": return "We need a reply from you to continue.";
      case "RESOLVED": return "Your ticket has been marked resolved. Reply if you still need help.";
      case "CLOSED": return "Your ticket has been closed.";
      case "REOPENED": return "Your ticket has been reopened.";
      default: return "Your ticket status has changed.";
    }
  }

  // ================================================================ customer

  async createForCustomer(user: Actor, dto: CreateTicketDto): Promise<any> {
    const category = await this.categories.getActive(dto.category);
    const related = dto.relatedEntity
      ? await this.entities.resolve(dto.relatedEntity.type, dto.relatedEntity, user.id)
      : null;
    const ticket = await this.createTicket(user, {
      userId: user.id,
      subject: dto.subject,
      description: dto.description,
      category,
      priority: category.defaultPriority ?? "MEDIUM",
      related,
      attachmentIds: dto.attachmentIds,
      source: "web",
    });
    await Promise.all([
      this.notifyCustomer(ticket, `Ticket ${ticket.ticketNumber} received`, `We have received "${ticket.subject}". Our team will reply soon.`, "support.created"),
      this.staffPool(ticket).then((ids) =>
        this.notifyStaff(ids, ticket, `New ticket ${ticket.ticketNumber}`, `${category.label}: ${ticket.subject}`, "support.created", user.id),
      ),
    ]);
    return this.customerView(ticket);
  }

  private async createTicket(
    actor: Actor,
    input: {
      userId: string;
      subject: string;
      description: string;
      category: any;
      priority: TicketPriority;
      related: { type: string; entityId: unknown; reference: string; label: string } | null;
      attachmentIds?: string[];
      source: "web" | "admin";
      assignedTo?: string | null;
    },
  ): Promise<any> {
    const _id = new Types.ObjectId();
    // Claim files first under the new id; if anything below fails they stay tied to a ticket that never existed and cannot be reused.
    const attachments = await this.attachments.claim(actor, input.attachmentIds, _id, null);
    const now = new Date();
    const ticketNumber = await this.nextTicketNumber();
    const ticket = await this.tickets.create({
      _id,
      ticketNumber,
      userId: input.userId,
      createdBy: input.source === "admin" ? actor.id : null,
      source: input.source,
      subject: input.subject,
      description: input.description,
      category: input.category.key,
      categoryLabel: input.category.label,
      status: "OPEN",
      priority: input.priority,
      priorityRank: PRIORITY_RANK[input.priority],
      assignedTo: input.assignedTo ?? null,
      assignedAt: input.assignedTo ? now : null,
      relatedEntity: input.related
        ? {
            type: input.related.type,
            entityId: input.related.entityId,
            reference: input.related.reference,
            label: input.related.label,
          }
        : undefined,
      attachments,
      lastActivityAt: now,
      ...this.slaDue(input.priority, now),
    });
    const plain = ticket.toObject();
    await this.activity(_id, actor, "created", {
      to: "OPEN",
      note: input.source === "admin" ? "Raised by support on the customer's behalf" : "",
      visibleToUser: true,
    });
    if (input.assignedTo) await this.activity(_id, actor, "assigned", { to: input.assignedTo });
    await this.audit(actor, "ticket.created", plain, { category: plain.category, source: input.source });
    return plain;
  }

  async listMine(user: Actor, query: MyTicketsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter: Record<string, unknown> = { userId: user.id };
    if (query.status === "active") filter.status = { $in: ACTIVE_STATUSES };
    else if (query.status === "finished") filter.status = { $in: FINISHED_STATUSES };
    else if (query.status) filter.status = query.status.toUpperCase();
    if (query.search) {
      const rx = { $regex: escapeRegex(query.search), $options: "i" };
      filter.$or = [{ ticketNumber: rx }, { subject: rx }, { "relatedEntity.reference": rx }];
    }
    const [rows, total, unread] = await Promise.all([
      this.tickets.find(filter).sort({ lastActivityAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.tickets.countDocuments(filter),
      this.tickets.countDocuments({ userId: user.id, unreadForUser: { $gt: 0 } }),
    ]);
    return { data: rows.map((row: any) => this.customerView(row)), total, page, limit, unreadTickets: unread };
  }

  private async ownTicket(user: Actor, id: string): Promise<any> {
    this.assertId(id);
    const ticket = await this.tickets.findOne({ _id: id, userId: user.id }).lean();
    // 404 for someone else's ticket too: never confirm it exists.
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async getMine(user: Actor, id: string): Promise<any> {
    const ticket = await this.ownTicket(user, id);
    const [messages, activity] = await Promise.all([
      this.messages.find({ ticketId: ticket._id, internal: false }).sort({ createdAt: 1 }).lean(),
      this.activities.find({ ticketId: ticket._id, visibleToUser: true }).sort({ createdAt: 1 }).lean(),
    ]);
    if (ticket.unreadForUser > 0 || messages.some((m: any) => m.senderType === "staff" && !m.readAt)) {
      const now = new Date();
      await this.messages.updateMany(
        { ticketId: ticket._id, internal: false, senderType: "staff", readAt: null },
        { $set: { readAt: now } },
      );
      await this.tickets.updateOne({ _id: ticket._id }, { $set: { unreadForUser: 0 } });
      ticket.unreadForUser = 0;
    }
    return {
      ...this.customerView(ticket),
      messages: messages.map((m: any) => this.customerMessage(m, user)),
      activity: activity.map((a: any) => ({
        _id: String(a._id),
        action: a.action,
        from: a.from,
        to: a.to,
        // Staff notes on a change (e.g. "why I resolved this") are internal; customers only see what changed.
        note: "",
        createdAt: a.createdAt,
      })),
    };
  }

  async replyAsCustomer(user: Actor, id: string, body: string, attachmentIds?: string[]): Promise<any> {
    let ticket = await this.ownTicket(user, id);
    if (ticket.status === "CLOSED")
      throw new BadRequestException("This ticket is closed. Reopen it to continue the conversation.");
    const message = await this.addMessage(ticket, user, "user", body, false, attachmentIds);
    if (ticket.status === "RESOLVED") {
      ticket = await this.transition(ticket, "REOPENED", user, "Customer replied after resolution");
    } else if (ticket.status === "WAITING_FOR_USER") {
      ticket = await this.transition(ticket, ticket.assignedTo ? "IN_PROGRESS" : "OPEN", user, "Customer replied");
    }
    const recipients = ticket.assignedTo ? [idOf(ticket.assignedTo)] : await this.staffPool(ticket);
    await this.notifyStaff(recipients, ticket, `Customer replied on ${ticket.ticketNumber}`, body.slice(0, 140), "support.user_reply", user.id);
    return this.customerMessage(message, user);
  }

  async closeAsCustomer(user: Actor, id: string): Promise<any> {
    const ticket = await this.ownTicket(user, id);
    if (ticket.status === "CLOSED") return this.customerView(ticket);
    const updated = await this.transition(ticket, "CLOSED", user, "Closed by customer");
    await this.audit(user, "ticket.closed_by_customer", updated);
    await this.notifyStaff([idOf(updated.assignedTo)], updated, `${updated.ticketNumber} closed by customer`, updated.subject, "support.closed", user.id);
    return this.customerView(updated);
  }

  async reopenAsCustomer(user: Actor, id: string, reason?: string): Promise<any> {
    const ticket = await this.ownTicket(user, id);
    if (!(FINISHED_STATUSES as string[]).includes(ticket.status))
      throw new BadRequestException("Only a resolved or closed ticket can be reopened.");
    if (!this.withinReopenWindow(ticket))
      throw new BadRequestException(
        `This ticket was finished more than ${REOPEN_WINDOW_DAYS} days ago. Please create a new ticket.`,
      );
    let updated = await this.transition(ticket, "REOPENED", user, reason ?? "Reopened by customer");
    if (reason) await this.addMessage(updated, user, "user", reason, false);
    updated = await this.tickets.findById(updated._id).lean();
    const recipients = updated.assignedTo ? [idOf(updated.assignedTo)] : await this.staffPool(updated);
    await this.notifyStaff(recipients, updated, `${updated.ticketNumber} reopened`, reason || updated.subject, "support.reopened", user.id);
    return this.customerView(updated);
  }

  private withinReopenWindow(ticket: any): boolean {
    const finishedAt = ticket.closedAt ?? ticket.resolvedAt ?? ticket.updatedAt;
    return !finishedAt || Date.now() - new Date(finishedAt).getTime() <= REOPEN_WINDOW_DAYS * 24 * HOUR;
  }

  /** What a customer may see of a ticket: no priority, escalation, assignee identity or SLA internals. */
  customerView(ticket: any) {
    const finished = (FINISHED_STATUSES as string[]).includes(ticket.status);
    return {
      _id: String(ticket._id),
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      categoryLabel: ticket.categoryLabel || ticket.category,
      status: ticket.status,
      relatedEntity: ticket.relatedEntity?.type
        ? {
            type: ticket.relatedEntity.type,
            reference: ticket.relatedEntity.reference,
            label: ticket.relatedEntity.label,
          }
        : null,
      attachments: (ticket.attachments ?? []).map((a: any) => ({
        url: a.url,
        fileName: a.fileName,
        mimeType: a.mimeType,
        bytes: a.bytes,
      })),
      hasAgent: Boolean(ticket.assignedTo),
      messageCount: ticket.messageCount ?? 0,
      unread: ticket.unreadForUser ?? 0,
      lastActivityAt: ticket.lastActivityAt ?? ticket.updatedAt,
      createdAt: ticket.createdAt,
      resolvedAt: ticket.resolvedAt ?? null,
      closedAt: ticket.closedAt ?? null,
      canReply: ticket.status !== "CLOSED",
      canClose: ticket.status !== "CLOSED",
      canReopen: finished && this.withinReopenWindow(ticket),
    };
  }

  private customerMessage(m: any, viewer: Actor) {
    const staff = m.senderType === "staff";
    return {
      _id: String(m._id),
      senderType: m.senderType,
      mine: idOf(m.senderId) === viewer.id,
      senderName: staff ? `${firstName(m.senderName) || "Agent"} · Tirvona Support` : m.senderType === "system" ? "Tirvona" : m.senderName || "You",
      body: m.body,
      attachments: (m.attachments ?? []).map((a: any) => ({ url: a.url, fileName: a.fileName, mimeType: a.mimeType, bytes: a.bytes })),
      readAt: m.readAt ?? null,
      createdAt: m.createdAt,
    };
  }

  /** Writes one conversation entry and updates the ticket's counters atomically. */
  private async addMessage(
    ticket: any,
    actor: Actor,
    senderType: "user" | "staff",
    body: string,
    internal: boolean,
    attachmentIds?: string[],
  ): Promise<any> {
    const _id = new Types.ObjectId();
    const attachments = await this.attachments.claim(actor, attachmentIds, ticket._id, _id);
    const message = await this.messages.create({
      _id,
      ticketId: ticket._id,
      senderId: actor.id,
      senderRole: actor.role,
      senderName: actor.name,
      senderType,
      internal,
      body,
      attachments,
    });
    const now = new Date();
    const set: Record<string, unknown> = { lastActivityAt: now };
    const inc: Record<string, number> = {};
    if (!internal) {
      inc.messageCount = 1;
      set.lastMessageAt = now;
      if (senderType === "user") {
        set.lastUserMessageAt = now;
        inc.unreadForStaff = 1;
      } else {
        set.lastStaffMessageAt = now;
        inc.unreadForUser = 1;
      }
    }
    await this.tickets.updateOne({ _id: ticket._id }, Object.keys(inc).length ? { $set: set, $inc: inc } : { $set: set });
    // First public staff reply stops the first-response SLA clock (only once).
    if (senderType === "staff" && !internal)
      await this.tickets.updateOne(
        { _id: ticket._id, firstResponseAt: null },
        { $set: { firstResponseAt: now, firstResponseMinutes: minutesSince(ticket.createdAt, now) } },
      );
    return message.toObject ? message.toObject() : message;
  }

  // =================================================================== staff

  private async handled(user: Actor): Promise<string[]> {
    if (isSupervisor(user) || user.role === SUPPORT_AGENT_ROLE) return [];
    return this.categories.handledBy(user.role);
  }

  async scopeFor(user: Actor): Promise<Record<string, unknown>> {
    if (!isStaff(user)) throw new ForbiddenException("Support staff only");
    return staffScopeFilter(user, await this.handled(user));
  }

  private async staffTicket(user: Actor, id: string): Promise<any> {
    this.assertId(id);
    const ticket = await this.tickets.findById(id).lean();
    if (!ticket || !isStaff(user) || !canStaffSee(user, ticket, await this.handled(user)))
      throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async adminList(user: Actor, query: AdminTicketsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const and: Record<string, unknown>[] = [await this.scopeFor(user)];
    const now = new Date();
    switch (query.view) {
      case "mine": and.push({ assignedTo: user.id }); break;
      case "unassigned": and.push({ assignedTo: null, status: { $in: ACTIVE_STATUSES } }); break;
      case "urgent": and.push({ priority: "URGENT", status: { $in: ACTIVE_STATUSES } }); break;
      case "escalated": and.push({ isEscalated: true, status: { $in: ACTIVE_STATUSES } }); break;
      case "overdue":
        and.push({
          status: { $in: ACTIVE_STATUSES },
          $or: [
            { firstResponseAt: null, firstResponseDueAt: { $lt: now } },
            { resolutionDueAt: { $lt: now } },
          ],
        });
        break;
    }
    if (query.status?.length) and.push({ status: { $in: query.status } });
    if (query.priority?.length) and.push({ priority: { $in: query.priority } });
    if (query.category) and.push({ category: query.category });
    if (query.assignedTo) and.push({ assignedTo: query.assignedTo });
    if (query.userId) and.push({ userId: query.userId });
    if (query.entityType) and.push({ "relatedEntity.type": query.entityType });
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(`${query.from}T00:00:00.000Z`);
      if (query.to) range.$lte = new Date(`${query.to}T23:59:59.999Z`);
      and.push({ createdAt: range });
    }
    if (query.search) {
      const rx = { $regex: escapeRegex(query.search), $options: "i" };
      const people = await this.users
        .find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] })
        .select("_id")
        .limit(200)
        .lean();
      and.push({
        $or: [
          { ticketNumber: rx },
          { subject: rx },
          { "relatedEntity.reference": rx },
          ...(people.length ? [{ userId: { $in: people.map((p: any) => p._id) } }] : []),
        ],
      });
    }
    const filter = and.length === 1 ? and[0] : { $and: and };
    const sort: Record<string, 1 | -1> =
      query.sort === "oldest" ? { createdAt: 1 }
      : query.sort === "priority" ? { priorityRank: -1, createdAt: 1 }
      : query.sort === "activity" ? { lastActivityAt: -1 }
      : query.sort === "due" ? { resolutionDueAt: 1 }
      : { createdAt: -1 };
    const [rows, total] = await Promise.all([
      this.tickets
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("userId", "name email phone")
        .populate("assignedTo", "name email role")
        .lean(),
      this.tickets.countDocuments(filter),
    ]);
    return { data: rows.map((row: any) => this.staffView(row)), total, page, limit };
  }

  /** Adds live SLA flags to a ticket for staff screens. */
  staffView(ticket: any) {
    const now = Date.now();
    const active = (ACTIVE_STATUSES as string[]).includes(ticket.status);
    const firstResponseOverdue = active && !ticket.firstResponseAt && ticket.firstResponseDueAt && new Date(ticket.firstResponseDueAt).getTime() < now;
    const resolutionOverdue = active && ticket.resolutionDueAt && new Date(ticket.resolutionDueAt).getTime() < now;
    return {
      ...ticket,
      _id: String(ticket._id),
      sla: {
        firstResponseOverdue: Boolean(firstResponseOverdue),
        resolutionOverdue: Boolean(resolutionOverdue),
        breached: Boolean(firstResponseOverdue || resolutionOverdue),
      },
    };
  }

  async adminGet(user: Actor, id: string) {
    const base = await this.staffTicket(user, id);
    const ticket = await this.tickets
      .findById(base._id)
      .populate("userId", "name email phone role status createdAt")
      .populate("assignedTo", "name email role")
      .populate("createdBy", "name role")
      .lean();
    const userId = idOf(base.userId);
    const [messages, activity, related, customerTotals] = await Promise.all([
      this.messages.find({ ticketId: base._id }).sort({ createdAt: 1 }).lean(),
      this.activities.find({ ticketId: base._id }).sort({ createdAt: 1 }).lean(),
      this.entities.summary(base.relatedEntity).catch((error: Error) => {
        this.logger.warn(`Related record lookup failed for ${base.ticketNumber}: ${error.message}`);
        return null;
      }),
      Promise.all([
        this.tickets.countDocuments({ userId }),
        this.tickets.countDocuments({ userId, status: { $in: ACTIVE_STATUSES } }),
      ]),
    ]);
    if (base.unreadForStaff > 0) {
      await this.messages.updateMany(
        { ticketId: base._id, senderType: "user", readAt: null },
        { $set: { readAt: new Date() } },
      );
      await this.tickets.updateOne({ _id: base._id }, { $set: { unreadForStaff: 0 } });
      ticket.unreadForStaff = 0;
    }
    return {
      ticket: this.staffView(ticket),
      messages,
      activity,
      relatedEntity: related,
      customer: {
        ...(typeof ticket.userId === "object" && ticket.userId ? ticket.userId : { _id: userId }),
        totalTickets: customerTotals[0],
        openTickets: customerTotals[1],
      },
      permissions: {
        canAssignOthers: isSupervisor(user),
        isSupervisor: isSupervisor(user),
        transitions: STAFF_TRANSITIONS[base.status as TicketStatus] ?? [],
      },
    };
  }

  async adminCreate(actor: Actor, dto: AdminCreateTicketDto): Promise<any> {
    if (!["super_admin", SUPPORT_AGENT_ROLE].includes(actor.role))
      throw new ForbiddenException("Only the support team can raise tickets for customers.");
    const customer = await this.users.findOne({ _id: dto.userId, isDeleted: { $ne: true } }).select("_id name").lean();
    if (!customer) throw new BadRequestException("That customer account was not found.");
    const category = await this.categories.getActive(dto.category);
    // Staff may link any record, but it must exist.
    const related = dto.relatedEntity ? await this.entities.resolve(dto.relatedEntity.type, dto.relatedEntity) : null;
    let assignedTo: string | null = null;
    if (dto.assignedTo) {
      if (dto.assignedTo !== actor.id && !isSupervisor(actor))
        throw new ForbiddenException("Only a support supervisor can assign tickets to other staff.");
      await this.assertAssignable(dto.assignedTo, category.key);
      assignedTo = dto.assignedTo;
    }
    const priority = (dto.priority as TicketPriority) ?? category.defaultPriority ?? "MEDIUM";
    const ticket = await this.createTicket(actor, {
      userId: dto.userId,
      subject: dto.subject,
      description: dto.description,
      category,
      priority,
      related,
      attachmentIds: dto.attachmentIds,
      source: "admin",
      assignedTo,
    });
    await this.notifyCustomer(ticket, `Ticket ${ticket.ticketNumber} opened for you`, `Our support team opened a ticket: "${ticket.subject}".`, "support.created");
    if (assignedTo)
      await this.notifyStaff([assignedTo], ticket, `${ticket.ticketNumber} assigned to you`, ticket.subject, "support.assigned", actor.id);
    return this.staffView(ticket);
  }

  async update(actor: Actor, id: string, dto: UpdateTicketDto): Promise<any> {
    let ticket = await this.staffTicket(actor, id);
    const changes: string[] = [];

    if (dto.category && dto.category !== ticket.category) {
      const category = await this.categories.getActive(dto.category);
      const from = ticket.categoryLabel || ticket.category;
      ticket = await this.tickets
        .findByIdAndUpdate(ticket._id, { $set: { category: category.key, categoryLabel: category.label, lastActivityAt: new Date() } }, { new: true })
        .lean();
      await this.activity(ticket._id, actor, "category_changed", { from, to: category.label, note: dto.note, visibleToUser: true });
      changes.push("category");
    }

    if (dto.priority && dto.priority !== ticket.priority) {
      const priority = dto.priority as TicketPriority;
      const from = ticket.priority;
      const set: Record<string, unknown> = { priority, priorityRank: PRIORITY_RANK[priority], lastActivityAt: new Date() };
      // SLA targets follow the new priority, measured from when the ticket was raised.
      const due = this.slaDue(priority, new Date(ticket.createdAt));
      if (!ticket.firstResponseAt) set.firstResponseDueAt = due.firstResponseDueAt;
      if (!ticket.resolvedAt) set.resolutionDueAt = due.resolutionDueAt;
      ticket = await this.tickets.findByIdAndUpdate(ticket._id, { $set: set }, { new: true }).lean();
      await this.activity(ticket._id, actor, "priority_changed", { from, to: priority, note: dto.note });
      await this.notifyStaff([idOf(ticket.assignedTo)], ticket, `${ticket.ticketNumber} priority is now ${priority}`, ticket.subject, "support.priority", actor.id);
      changes.push("priority");
    }

    if (dto.status && dto.status !== ticket.status) {
      const to = dto.status as TicketStatus;
      const allowed = STAFF_TRANSITIONS[ticket.status as TicketStatus] ?? [];
      if (!allowed.includes(to))
        throw new BadRequestException(`A ${ticket.status.replace(/_/g, " ").toLowerCase()} ticket cannot be moved to ${to.replace(/_/g, " ").toLowerCase()}.`);
      ticket = await this.transition(ticket, to, actor, dto.note ?? "");
      await this.notifyCustomer(ticket, `${ticket.ticketNumber}: ${to.replace(/_/g, " ").toLowerCase()}`, this.statusMessage(to), to === "RESOLVED" ? "support.resolved" : to === "REOPENED" ? "support.reopened" : "support.status");
      await this.notifyStaff([idOf(ticket.assignedTo)], ticket, `${ticket.ticketNumber} is now ${to.replace(/_/g, " ").toLowerCase()}`, ticket.subject, "support.status", actor.id);
      changes.push("status");
    }

    if (!changes.length) throw new BadRequestException("Nothing to change.");
    await this.audit(actor, "ticket.updated", ticket, { changes, ...dto });
    return this.staffView(ticket);
  }

  private async assertAssignable(assigneeId: string, categoryKey: string): Promise<any> {
    const assignee: any = await this.users
      .findOne({ _id: assigneeId, status: "active", isDeleted: { $ne: true } })
      .select("_id name role permissions")
      .lean();
    const roleOk = assignee && (assignee.role === "super_admin" || (SUPPORT_HANDLER_ROLES as readonly string[]).includes(assignee.role));
    if (!roleOk) throw new BadRequestException("That person cannot be assigned support tickets.");
    if (!["super_admin", SUPPORT_AGENT_ROLE].includes(assignee.role)) {
      const handled = await this.categories.handledBy(assignee.role);
      if (!handled.includes(categoryKey))
        throw new BadRequestException("That person's role does not handle this ticket's category.");
    }
    return assignee;
  }

  async assign(actor: Actor, id: string, assigneeId: string | null | undefined): Promise<any> {
    const ticket = await this.staffTicket(actor, id);
    const current = idOf(ticket.assignedTo);
    const target = assigneeId ?? null;
    if (current === target) return this.staffView(ticket);
    if (!isSupervisor(actor)) {
      // Agents may claim an unassigned ticket or hand back their own; nothing else.
      const claiming = current === null && target === actor.id;
      const releasing = current === actor.id && target === null;
      if (!claiming && !releasing)
        throw new ForbiddenException("Only a support supervisor can assign tickets to other staff.");
    }
    let assigneeName = "";
    if (target) assigneeName = (await this.assertAssignable(target, ticket.category)).name;
    const updated = await this.tickets
      .findOneAndUpdate(
        { _id: ticket._id, assignedTo: current },
        { $set: { assignedTo: target, assignedAt: target ? new Date() : null, lastActivityAt: new Date() } },
        { new: true },
      )
      .lean();
    if (!updated)
      throw new ConflictException("Someone else changed the assignment just now. Please refresh.");
    await this.activity(ticket._id, actor, target ? "assigned" : "unassigned", { from: current ?? "", to: assigneeName || "" });
    await this.audit(actor, "ticket.assigned", updated, { from: current, to: target });
    if (target)
      await this.notifyStaff([target], updated, `${updated.ticketNumber} assigned to you`, updated.subject, "support.assigned", actor.id);
    return this.staffView(updated);
  }

  async escalate(actor: Actor, id: string, reason: string): Promise<any> {
    const ticket = await this.staffTicket(actor, id);
    if (!(ACTIVE_STATUSES as string[]).includes(ticket.status))
      throw new BadRequestException("Only an active ticket can be escalated.");
    const priority: TicketPriority = PRIORITY_RANK[ticket.priority as TicketPriority] >= PRIORITY_RANK.HIGH ? ticket.priority : "HIGH";
    const now = new Date();
    const updated = await this.tickets
      .findByIdAndUpdate(
        ticket._id,
        {
          $set: {
            isEscalated: true,
            escalation: { at: now, by: actor.id, reason },
            priority,
            priorityRank: PRIORITY_RANK[priority],
            lastActivityAt: now,
          },
        },
        { new: true },
      )
      .lean();
    await this.activity(ticket._id, actor, "escalated", { from: ticket.priority, to: priority, note: reason });
    await this.audit(actor, "ticket.escalated", updated, { reason });
    await this.notifyStaff(
      [...(await this.supervisors()), idOf(updated.assignedTo)],
      updated,
      `Escalated: ${updated.ticketNumber}`,
      reason,
      "support.escalated",
      actor.id,
    );
    return this.staffView(updated);
  }

  async replyAsStaff(actor: Actor, id: string, dto: StaffReplyDto): Promise<any> {
    let ticket = await this.staffTicket(actor, id);
    const internal = Boolean(dto.internal);
    if (!internal && ticket.status === "CLOSED")
      throw new BadRequestException("This ticket is closed. Reopen it before replying to the customer.");
    if (dto.status && dto.status !== ticket.status) {
      const allowed = STAFF_TRANSITIONS[ticket.status as TicketStatus] ?? [];
      if (!allowed.includes(dto.status as TicketStatus))
        throw new BadRequestException(`This ticket cannot be moved to ${dto.status.replace(/_/g, " ").toLowerCase()}.`);
    }
    const message = await this.addMessage(ticket, actor, "staff", dto.body, internal, dto.attachmentIds);

    // An agent answering an unassigned ticket takes it.
    if (!internal && !ticket.assignedTo && actor.role === SUPPORT_AGENT_ROLE) {
      const claimed = await this.tickets
        .findOneAndUpdate({ _id: ticket._id, assignedTo: null }, { $set: { assignedTo: actor.id, assignedAt: new Date() } }, { new: true })
        .lean();
      if (claimed) await this.activity(ticket._id, actor, "assigned", { to: actor.name, note: "Took the ticket by replying" });
    }
    ticket = await this.tickets.findById(ticket._id).lean();

    const target = dto.status as TicketStatus | undefined;
    if (target && target !== ticket.status) ticket = await this.transition(ticket, target, actor);
    else if (!internal && ["OPEN", "REOPENED"].includes(ticket.status)) ticket = await this.transition(ticket, "IN_PROGRESS", actor);

    if (internal) {
      await this.notifyStaff([idOf(ticket.assignedTo)], ticket, `Internal note on ${ticket.ticketNumber}`, dto.body.slice(0, 140), "support.note", actor.id);
    } else {
      await this.notifyCustomer(
        ticket,
        `New reply on ${ticket.ticketNumber}`,
        target === "RESOLVED" ? this.statusMessage("RESOLVED") : dto.body.slice(0, 140),
        target === "RESOLVED" ? "support.resolved" : "support.reply",
      );
    }
    await this.audit(actor, internal ? "ticket.note_added" : "ticket.replied", ticket, { messageId: String(message._id) });
    return { message, ticket: this.staffView(ticket) };
  }

  async linkEntity(actor: Actor, id: string, related?: { type: string; entityId?: string; reference?: string }) {
    const ticket = await this.staffTicket(actor, id);
    const resolved = related ? await this.entities.resolve(related.type, related) : null;
    const updated = await this.tickets
      .findByIdAndUpdate(
        ticket._id,
        resolved
          ? { $set: { relatedEntity: { type: resolved.type, entityId: resolved.entityId, reference: resolved.reference, label: resolved.label }, lastActivityAt: new Date() } }
          : { $unset: { relatedEntity: 1 }, $set: { lastActivityAt: new Date() } },
        { new: true },
      )
      .lean();
    await this.activity(ticket._id, actor, resolved ? "entity_linked" : "entity_unlinked", {
      from: ticket.relatedEntity?.label ?? "",
      to: resolved?.label ?? "",
    });
    return this.staffView(updated);
  }

  /** People who can be assigned tickets, with their current open workload. */
  async assignableStaff(actor: Actor): Promise<any[]> {
    if (!isStaff(actor)) throw new ForbiddenException("Support staff only");
    const staff = await this.users
      .find({
        status: "active",
        isDeleted: { $ne: true },
        role: { $in: ["super_admin", ...SUPPORT_HANDLER_ROLES] },
      })
      .select("_id name email role permissions")
      .sort({ name: 1 })
      .limit(300)
      .lean();
    const load = await this.tickets.aggregate([
      { $match: { status: { $in: ACTIVE_STATUSES }, assignedTo: { $ne: null } } },
      { $group: { _id: "$assignedTo", open: { $sum: 1 } } },
    ]);
    const byId = new Map(load.map((row: any) => [String(row._id), row.open]));
    return staff.map((person: any) => ({
      _id: String(person._id),
      name: person.name,
      email: person.email,
      role: person.role,
      isSupervisor: person.role === "super_admin" || (person.permissions ?? []).includes(SUPPORT_MANAGE_ALL_PERMISSION),
      openTickets: byId.get(String(person._id)) ?? 0,
    }));
  }

  /** Customer lookup for staff raising a ticket on someone's behalf. */
  async searchCustomers(actor: Actor, search: string): Promise<any[]> {
    if (!["super_admin", SUPPORT_AGENT_ROLE].includes(actor.role)) throw new ForbiddenException("Support team only");
    const rx = { $regex: escapeRegex(search), $options: "i" };
    return this.users
      .find({ isDeleted: { $ne: true }, $or: [{ name: rx }, { email: rx }, { phone: rx }] })
      .select("_id name email phone role")
      .limit(20)
      .lean();
  }

  // ================================================================== legacy

  /** `POST /support` from the first version: title → subject, old category keys mapped. */
  createLegacy(user: Actor, dto: { title: string; description: string; category: string }) {
    return this.createForCustomer(user, {
      subject: dto.title,
      description: dto.description.length >= 10 ? dto.description : `${dto.description} (no further details)`,
      category: LEGACY_CATEGORY[dto.category] ?? dto.category,
    });
  }
}
