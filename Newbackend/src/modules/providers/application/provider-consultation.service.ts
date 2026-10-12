import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import { Types, type Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
import {
  CONSULTATION_CANCEL_REASONS,
  CONSULTATION_REQUEST_HOLD_HOURS,
  CONSULTATION_TRANSITIONS,
  PANDIT_CONSULTANT_TYPES,
  type ConsultationStatus,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import { listingBlockers } from "../domain/provider-visibility";
import { pageParams } from "../presentation/dto/common.dto";
import type {
  CancelWithReasonDto,
  CompleteConsultationDto,
  ConsultationListQueryDto,
  CreateConsultationDto,
  MessageListQueryDto,
  ScheduleConsultationDto,
  SendConsultationMessageDto,
} from "../presentation/dto/booking.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderAvailabilityService } from "./provider-availability.service";
import { ProviderCalendarService } from "./provider-calendar.service";
import { ProviderProfileService } from "./provider-profile.service";
import { idStr, paged, providerConfig, sameId, toObjectId } from "./provider.helpers";

const HOUR = 3_600_000;
const MIN_NOTICE_HOURS = 1;
const MAX_HORIZON_DAYS = 90;
const START_EARLY_MINUTES = 15;

/**
 * Ask-a-Pandit / Ask-a-Jyotishi on shared infrastructure (SRS M18). The two
 * categories are kept apart by expert type, a consultation never creates a
 * booking or a payment by itself (FR-EC-003), and the customer's question and
 * the expert's notes are only ever readable by the people they belong to.
 */
@Injectable()
export class ProviderConsultationService {
  private readonly logger = new Logger(ProviderConsultationService.name);

  constructor(
    @InjectModel("ProviderConsultation") private readonly consultations: Model<any>,
    @InjectModel("ProviderProfile") private readonly profileModel: Model<any>,
    @InjectModel("ProviderBooking") private readonly bookings: Model<any>,
    @InjectModel("ProviderConsultationMessage") private readonly messageModel: Model<any>,
    private readonly transactions: TransactionService,
    private readonly profiles: ProviderProfileService,
    private readonly calendar: ProviderCalendarService,
    private readonly availability: ProviderAvailabilityService,
    private readonly audit: ProviderAuditService,
    private readonly notifier: InAppNotificationService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // --------------------------------------------------------------- create
  async create(user: AuthenticatedUser, dto: CreateConsultationDto) {
    const expert: any = await this.profileModel.findById(toObjectId(dto.expertProviderId)).lean();
    if (
      !expert ||
      listingBlockers(expert, { allowDevFixtures: providerConfig().allowDevFixtures }).length
    )
      throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    if (sameId(expert.userId, user.id))
      throw providerError.forbidden("CANNOT_CONSULT_SELF", "You cannot book a consultation with yourself");

    const settings = expert.consultation;
    if (!settings?.enabled)
      throw providerError.unprocessable(
        "CONSULTATION_NOT_OFFERED",
        "This provider does not offer consultations",
      );
    // Pandit and Jyotish consultations are separate categories with separate experts.
    const compatible =
      dto.consultationType === "JYOTISHI"
        ? expert.providerType === "JYOTISHI"
        : PANDIT_CONSULTANT_TYPES.includes(expert.providerType);
    if (!compatible)
      throw providerError.unprocessable(
        "CONSULTATION_TYPE_MISMATCH",
        dto.consultationType === "JYOTISHI"
          ? "Only a Jyotishi can give a Jyotish consultation"
          : "This expert does not give Pandit/Acharya consultations",
      );
    if (settings.channels?.length && !settings.channels.includes(dto.channel))
      throw providerError.unprocessable(
        "CHANNEL_NOT_OFFERED",
        `This expert offers: ${settings.channels.join(", ")}`,
      );

    const now = new Date();
    const start = new Date(dto.scheduledStartAt);
    if (start.getTime() < now.getTime() + MIN_NOTICE_HOURS * HOUR)
      throw providerError.unprocessable(
        "CONSULTATION_TOO_SOON",
        `Consultations need at least ${MIN_NOTICE_HOURS} hour's notice`,
      );
    if (start.getTime() > now.getTime() + MAX_HORIZON_DAYS * 24 * HOUR)
      throw providerError.unprocessable(
        "CONSULTATION_TOO_FAR",
        `Consultations can be booked up to ${MAX_HORIZON_DAYS} days ahead`,
      );
    const minutes = dto.durationMinutes ?? settings.slotMinutes ?? 30;
    const end = new Date(start.getTime() + minutes * 60_000);

    if (dto.bookingId) await this.assertRelatedBooking(user, dto, expert);

    const holdExpiresAt = new Date(now.getTime() + CONSULTATION_REQUEST_HOLD_HOURS * HOUR);
    const timezone = await this.availability.timezoneOf(expert._id);
    const consultationId = new Types.ObjectId();

    const created = await this.transactions.run(async (session) => {
      const block = await this.calendar.reserve({
        providerId: expert._id,
        start,
        end,
        blockType: "CONSULTATION",
        sourceId: consultationId,
        expiresAt: holdExpiresAt,
        createdBy: user.id,
        requireWithinRules: true,
        session,
      });
      const [row] = await this.consultations.create(
        [
          {
            _id: consultationId,
            consultationType: dto.consultationType,
            customerUserId: toObjectId(user.id),
            expertProviderId: expert._id,
            expertUserId: expert.userId,
            expertSnapshot: {
              id: idStr(expert._id),
              displayName: expert.displayName,
              providerType: expert.providerType,
            },
            customerSnapshot: { name: user.name },
            channel: dto.channel,
            scheduledStartAt: start,
            scheduledEndAt: end,
            timezone,
            questionSummary: dto.questionSummary,
            fee: { amountMinor: settings.feeMinor ?? 0, currency: settings.currency ?? "INR" },
            bookingId: dto.bookingId ? toObjectId(dto.bookingId) : null,
            status: "REQUESTED",
            holdBlockId: block._id,
            holdExpiresAt,
          },
        ],
        { session },
      );
      return row;
    });
    await this.audit.log(user, "consultation.requested", "consultation", created._id, {
      expertProviderId: idStr(expert._id),
      consultationType: dto.consultationType,
      channel: dto.channel,
    });
    await this.notifier.notifyUsers([String(expert.userId)], {
      title: "New consultation request",
      body: "A customer has requested a consultation. Confirm the time to accept it.",
      deepLink: "/provider/consultations",
      kind: "provider.consultation.requested",
    });
    return { success: true, data: await this.view(created._id, "CUSTOMER") };
  }

  // ----------------------------------------------------------- transitions
  /** Expert confirms the requested time, or moves it. */
  async schedule(user: AuthenticatedUser, id: string, dto: ScheduleConsultationDto) {
    const provider = await this.profiles.requireOwn(user);
    this.profiles.assertNotSuspended(provider);
    const row = await this.requireExpertRow(provider, id);
    this.assertMove(row.status, "SCHEDULED");

    const moving = dto.scheduledStartAt
      ? new Date(dto.scheduledStartAt).getTime() !== new Date(row.scheduledStartAt).getTime()
      : false;
    const minutes =
      dto.durationMinutes ??
      Math.round((new Date(row.scheduledEndAt).getTime() - new Date(row.scheduledStartAt).getTime()) / 60_000);
    const start = dto.scheduledStartAt ? new Date(dto.scheduledStartAt) : new Date(row.scheduledStartAt);
    const end = new Date(start.getTime() + minutes * 60_000);
    const changed = moving || dto.durationMinutes !== undefined;
    if (changed && start.getTime() < Date.now() + MIN_NOTICE_HOURS * HOUR)
      throw providerError.unprocessable(
        "CONSULTATION_TOO_SOON",
        `A consultation cannot start sooner than ${MIN_NOTICE_HOURS} hour from now`,
      );

    const updated = await this.transactions.run(async (session) => {
      let holdBlockId = row.holdBlockId;
      if (changed) {
        // Free the old slot first so a small shift does not conflict with itself.
        await this.calendar.release(row.holdBlockId, "RELEASED", session);
        const block = await this.calendar.reserve({
          providerId: provider._id,
          start,
          end,
          blockType: "CONSULTATION",
          sourceId: row._id,
          createdBy: user.id,
          requireWithinRules: true,
          session,
        });
        holdBlockId = block._id;
      } else if (row.status === "REQUESTED") {
        await this.calendar.confirmHold(row.holdBlockId, "CONSULTATION", session);
      }
      const result = await this.consultations.findOneAndUpdate(
        { _id: row._id, status: row.status, stateVersion: row.stateVersion },
        {
          $set: {
            status: "SCHEDULED",
            scheduledStartAt: start,
            scheduledEndAt: end,
            holdBlockId,
            holdExpiresAt: null,
          },
          $inc: { stateVersion: 1 },
        },
        { new: true, session },
      );
      if (!result) throw this.stateConflict();
      return result;
    });
    await this.audit.log(user, "consultation.scheduled", "consultation", row._id, {
      from: row.status,
      moved: changed,
    });
    await this.notifier.notifyUsers([String(row.customerUserId)], {
      title: "Consultation confirmed",
      body: "Your consultation time is confirmed.",
      deepLink: "/consultations",
      kind: "provider.consultation.scheduled",
    });
    return { success: true, data: await this.view(updated._id, "EXPERT") };
  }

  async start(user: AuthenticatedUser, id: string) {
    const provider = await this.profiles.requireOwn(user);
    const row = await this.requireExpertRow(provider, id);
    this.assertMove(row.status, "IN_PROGRESS");
    if (Date.now() < new Date(row.scheduledStartAt).getTime() - START_EARLY_MINUTES * 60_000)
      throw providerError.conflict("CONSULTATION_TOO_EARLY", "It is too early to start this consultation");
    await this.move(row, "IN_PROGRESS", {});
    await this.audit.log(user, "consultation.started", "consultation", row._id);
    return { success: true, data: await this.view(row._id, "EXPERT") };
  }

  /**
   * Completes (or marks a no-show). Completing a Jyotish consultation never
   * creates a booking or a payment: any follow-up is a separate, explicit
   * choice by the customer.
   */
  async complete(user: AuthenticatedUser, id: string, dto: CompleteConsultationDto) {
    const provider = await this.profiles.requireOwn(user);
    const row = await this.requireExpertRow(provider, id);
    const to: ConsultationStatus = dto.noShow ? "NO_SHOW" : "COMPLETED";
    this.assertMove(row.status, to);
    if (Date.now() < new Date(row.scheduledStartAt).getTime())
      throw providerError.conflict(
        "CONSULTATION_TOO_EARLY",
        "A consultation cannot be completed before it starts",
      );
    await this.move(row, to, {
      completedAt: new Date(),
      ...(dto.expertNotes ? { expertNotes: dto.expertNotes } : {}),
    });
    await this.audit.log(user, "consultation.completed", "consultation", row._id, {
      outcome: to,
    });
    return { success: true, data: await this.view(row._id, "EXPERT") };
  }

  async cancel(
    actor: "CUSTOMER" | "EXPERT",
    user: AuthenticatedUser,
    id: string,
    dto: CancelWithReasonDto,
  ) {
    if (!(CONSULTATION_CANCEL_REASONS as readonly string[]).includes(dto.reasonCode))
      throw providerError.badRequest(
        "REASON_CODE_INVALID",
        `reasonCode must be one of: ${CONSULTATION_CANCEL_REASONS.join(", ")}`,
      );
    const row =
      actor === "EXPERT"
        ? await this.requireExpertRow(await this.profiles.requireOwn(user), id)
        : await this.requireCustomerRow(user, id);
    this.assertMove(row.status, "CANCELLED");
    await this.move(row, "CANCELLED", {
      cancelledBy: actor,
      cancelReasonCode: dto.reasonCode,
    });
    await this.audit.log(user, "consultation.cancelled", "consultation", row._id, {
      cancelledBy: actor,
      reasonCode: dto.reasonCode,
    });
    await this.notifier.notifyUsers(
      [String(actor === "EXPERT" ? row.customerUserId : row.expertUserId)],
      {
        title: "Consultation cancelled",
        body: "A consultation was cancelled.",
        deepLink: actor === "EXPERT" ? "/consultations" : "/provider/consultations",
        kind: "provider.consultation.cancelled",
      },
    );
    return { success: true, data: await this.view(row._id, actor) };
  }

  /** Customer or expert, decided from the consultation itself rather than by the caller. */
  async cancelAs(user: AuthenticatedUser, id: string, dto: CancelWithReasonDto) {
    const row: any = await this.consultations
      .findById(toObjectId(id, "consultationId"))
      .select("customerUserId expertUserId")
      .lean();
    if (row && sameId(row.customerUserId, user.id)) return this.cancel("CUSTOMER", user, id, dto);
    if (row && sameId(row.expertUserId, user.id)) return this.cancel("EXPERT", user, id, dto);
    throw providerError.notFound("CONSULTATION_NOT_FOUND", "Consultation not found");
  }

  // ---------------------------------------------------------------- reads
  async listMine(user: AuthenticatedUser, query: ConsultationListQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { customerUserId: toObjectId(user.id) };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.consultations.find(filter).sort({ scheduledStartAt: -1 }).skip(skip).limit(limit).lean(),
      this.consultations.countDocuments(filter),
    ]);
    const unread = await this.unreadCounts((rows as any[]).map((r) => r._id), user.id);
    return paged((rows as any[]).map((row) => ({ ...this.row(row, "CUSTOMER"), unreadCount: unread.get(String(row._id)) ?? 0 })), total, page, limit);
  }

  async listForExpert(user: AuthenticatedUser, query: ConsultationListQueryDto) {
    const provider = await this.profiles.requireOwn(user);
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = { expertProviderId: provider._id };
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.consultations.find(filter).sort({ scheduledStartAt: 1 }).skip(skip).limit(limit).lean(),
      this.consultations.countDocuments(filter),
    ]);
    const unread = await this.unreadCounts((rows as any[]).map((r) => r._id), user.id);
    return paged((rows as any[]).map((row) => ({ ...this.row(row, "EXPERT"), unreadCount: unread.get(String(row._id)) ?? 0 })), total, page, limit);
  }

  async listAdmin(query: ConsultationListQueryDto) {
    const { page, limit, skip } = pageParams(query);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const [rows, total] = await Promise.all([
      this.consultations.find(filter).sort({ scheduledStartAt: -1 }).skip(skip).limit(limit).lean(),
      this.consultations.countDocuments(filter),
    ]);
    return paged(
      (rows as any[]).map((row) => ({
        ...this.row(row, "CUSTOMER"),
        customer: row.customerSnapshot ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async get(user: AuthenticatedUser, id: string) {
    const row: any = await this.consultations.findById(toObjectId(id, "consultationId")).lean();
    const asCustomer = row && sameId(row.customerUserId, user.id);
    const asExpert = row && sameId(row.expertUserId, user.id);
    // Admins have no generic access: notes and questions stay between the two parties (FR-EC-002).
    if (!asCustomer && !asExpert)
      throw providerError.notFound("CONSULTATION_NOT_FOUND", "Consultation not found");
    return { success: true, data: await this.view(row._id, asExpert ? "EXPERT" : "CUSTOMER") };
  }

  // ------------------------------------------------------------- two-way chat
  /** Unread messages per consultation for one viewer (messages sent by the other party). */
  private async unreadCounts(ids: unknown[], viewerId: string): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!ids.length) return out;
    const rows: any[] = await this.messageModel.aggregate([
      {
        $match: {
          consultationId: { $in: ids },
          readAt: null,
          senderUserId: { $ne: toObjectId(viewerId) },
        },
      },
      { $group: { _id: "$consultationId", count: { $sum: 1 } } },
    ]);
    for (const row of rows) out.set(String(row._id), row.count);
    return out;
  }

  /** The two parties of a consultation, or 404. Admins are not parties and have no access. */
  private async requireParty(user: AuthenticatedUser, id: string) {
    const row: any = await this.consultations
      .findById(toObjectId(id, "consultationId"))
      .select("customerUserId expertUserId status customerSnapshot expertSnapshot")
      .lean();
    const isCustomer = row && sameId(row.customerUserId, user.id);
    const isExpert = row && sameId(row.expertUserId, user.id);
    if (!isCustomer && !isExpert)
      throw providerError.notFound("CONSULTATION_NOT_FOUND", "Consultation not found");
    return { row, isCustomer: Boolean(isCustomer) };
  }

  private messageView(m: any) {
    return {
      id: String(m._id),
      senderUserId: String(m.senderUserId),
      senderRole: m.senderRole,
      senderName: m.senderName,
      content: m.content,
      attachments: m.attachments ?? [],
      readAt: m.readAt ?? null,
      createdAt: m.createdAt,
    };
  }

  /**
   * The thread, oldest first. Opening it marks the other party's messages as
   * read in one atomic update (so a message arriving meanwhile is never lost).
   * `after` returns only newer messages, for polling and reconnects.
   */
  async listMessages(user: AuthenticatedUser, id: string, query: MessageListQueryDto = {}) {
    const { row } = await this.requireParty(user, id);
    const filter: Record<string, unknown> = { consultationId: row._id };
    if (query.after) {
      const anchor: any = await this.messageModel
        .findOne({ _id: toObjectId(query.after), consultationId: row._id })
        .select("createdAt")
        .lean();
      if (anchor) filter.createdAt = { $gt: anchor.createdAt };
    }
    const limit = Math.min(query.limit ?? 100, 200);
    // Newest `limit` messages, returned oldest first.
    const newest: any[] = await this.messageModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
    const now = new Date();
    await this.messageModel.updateMany(
      { consultationId: row._id, readAt: null, senderUserId: { $ne: toObjectId(user.id) } },
      { $set: { readAt: now } },
    );
    const messages = newest.reverse().map((m) => ({
      ...this.messageView(m),
      readAt: m.readAt ?? (sameId(m.senderUserId, user.id) ? null : now),
    }));
    return { success: true, data: messages };
  }

  async sendMessage(user: AuthenticatedUser, id: string, dto: SendConsultationMessageDto) {
    const content = (dto.content ?? "").trim();
    if (!content) throw providerError.badRequest("MESSAGE_EMPTY", "Message content cannot be empty");
    const { row, isCustomer } = await this.requireParty(user, id);
    if (row.status === "CANCELLED" || row.status === "NO_SHOW")
      throw providerError.conflict("CONSULTATION_CLOSED", "This consultation is closed to new messages");

    const recipientUserId = isCustomer ? row.expertUserId : row.customerUserId;
    const senderName = isCustomer
      ? row.customerSnapshot?.name ?? user.name ?? "Devotee"
      : row.expertSnapshot?.displayName ?? "Acharya";
    const created = await this.messageModel.create({
      consultationId: row._id,
      senderUserId: toObjectId(user.id),
      senderRole: isCustomer ? "CUSTOMER" : "EXPERT",
      senderName,
      content,
      attachments: (dto.attachments ?? []).map((a) => ({ url: a.url, name: a.name, mimeType: a.mimeType })),
    });
    const message = this.messageView(created.toObject());

    try {
      this.notificationsGateway?.send(String(recipientUserId), "consultation:message", {
        consultationId: String(row._id),
        message,
      });
    } catch (error) {
      this.logger.warn(`Live delivery failed for a consultation message: ${(error as Error).message}`);
    }
    // Content is never copied into the audit trail; the notification carries a short preview only.
    await this.notifier.notifyUsers([String(recipientUserId)], {
      title: `Message from ${senderName}`,
      body: content.slice(0, 100),
      deepLink: isCustomer ? "/provider/consultations" : "/consultations",
      kind: "provider.consultation.message",
    });
    return { success: true, data: message };
  }

  // ------------------------------------------------------------ maintenance
  /** Requests the expert never answered release their slot and tell the customer. */
  async expireUnanswered(now = new Date()): Promise<number> {
    const stale: any[] = await this.consultations
      .find({ status: "REQUESTED", holdExpiresAt: { $ne: null, $lte: now } })
      .limit(100)
      .lean();
    let count = 0;
    for (const row of stale) {
      try {
        await this.transactions.run(async (session) => {
          const result = await this.consultations.updateOne(
            { _id: row._id, status: "REQUESTED", stateVersion: row.stateVersion },
            {
              $set: {
                status: "CANCELLED",
                cancelledBy: "SYSTEM",
                cancelReasonCode: "EXPERT_NO_RESPONSE",
              },
              $inc: { stateVersion: 1 },
            },
            { session },
          );
          if (!result.matchedCount) return;
          await this.calendar.release(row.holdBlockId, "EXPIRED", session);
          count += 1;
        });
        await this.notifier.notifyUsers([String(row.customerUserId)], {
          title: "Consultation not confirmed",
          body: "The expert did not confirm your consultation in time, so the time was released.",
          deepLink: "/consultations",
          kind: "provider.consultation.expired",
        });
      } catch (error) {
        this.logger.warn(`Could not expire consultation ${row._id}: ${(error as Error).message}`);
      }
    }
    return count;
  }

  // ------------------------------------------------------------ internals
  private assertMove(from: ConsultationStatus, to: ConsultationStatus) {
    if (!CONSULTATION_TRANSITIONS[from]?.includes(to))
      throw providerError.conflict(
        "CONSULTATION_INVALID_TRANSITION",
        `A consultation that is ${from} cannot become ${to}`,
      );
  }

  private stateConflict() {
    return providerError.conflict(
      "CONSULTATION_STATE_CONFLICT",
      "The consultation changed while this was being processed. Reload and try again.",
    );
  }

  /** Conditional state change; cancellations also free the calendar. */
  private async move(row: any, to: ConsultationStatus, set: Record<string, unknown>) {
    await this.transactions.run(async (session) => {
      const result = await this.consultations.updateOne(
        { _id: row._id, status: row.status, stateVersion: row.stateVersion },
        { $set: { status: to, ...set }, $inc: { stateVersion: 1 } },
        { session },
      );
      if (!result.matchedCount) throw this.stateConflict();
      if (to === "CANCELLED") await this.calendar.release(row.holdBlockId, "RELEASED", session);
    });
  }

  private async requireExpertRow(provider: any, id: string): Promise<any> {
    const row: any = await this.consultations.findById(toObjectId(id, "consultationId")).lean();
    if (!row || !sameId(row.expertProviderId, provider._id))
      throw providerError.notFound("CONSULTATION_NOT_FOUND", "Consultation not found");
    return row;
  }

  private async requireCustomerRow(user: AuthenticatedUser, id: string): Promise<any> {
    const row: any = await this.consultations.findById(toObjectId(id, "consultationId")).lean();
    if (!row || !sameId(row.customerUserId, user.id))
      throw providerError.notFound("CONSULTATION_NOT_FOUND", "Consultation not found");
    return row;
  }

  /** The related booking must be this customer's booking with this same provider. Jyotish stays out of puja bookings. */
  private async assertRelatedBooking(user: AuthenticatedUser, dto: CreateConsultationDto, expert: any) {
    if (dto.consultationType === "JYOTISHI")
      throw providerError.unprocessable(
        "BOOKING_LINK_NOT_ALLOWED",
        "A Jyotish consultation cannot be linked to a puja booking",
      );
    const booking: any = await this.bookings.findById(toObjectId(dto.bookingId)).select("customerUserId providerId").lean();
    if (!booking || !sameId(booking.customerUserId, user.id) || !sameId(booking.providerId, expert._id))
      throw providerError.unprocessable(
        "BOOKING_NOT_RELATED",
        "That booking is not yours with this provider",
      );
  }

  private async view(id: unknown, viewer: "CUSTOMER" | "EXPERT") {
    let query = this.consultations.findById(toObjectId(id, "consultationId")).select("+questionSummary");
    if (viewer === "EXPERT") query = query.select("+expertNotes");
    const row: any = await query.lean();
    return {
      ...this.row(row, viewer),
      questionSummary: row.questionSummary ?? null,
      ...(viewer === "EXPERT" ? { expertNotes: row.expertNotes ?? null } : {}),
    };
  }

  private row(row: any, viewer: "CUSTOMER" | "EXPERT") {
    return {
      id: idStr(row._id),
      consultationType: row.consultationType,
      status: row.status,
      channel: row.channel,
      scheduledStartAt: row.scheduledStartAt,
      scheduledEndAt: row.scheduledEndAt,
      timezone: row.timezone,
      fee: row.fee,
      bookingId: idStr(row.bookingId) ?? null,
      expert: row.expertSnapshot ?? null,
      ...(viewer === "EXPERT" ? { customer: row.customerSnapshot ?? null } : {}),
      awaitingConfirmationUntil: row.status === "REQUESTED" ? row.holdExpiresAt ?? null : null,
      cancelledBy: row.cancelledBy ?? null,
      cancelReasonCode: row.cancelReasonCode ?? null,
      createdAt: row.createdAt,
    };
  }
}
