import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model, Types } from "mongoose";
import { isWithinRules, type RuleRecord } from "../domain/availability.util";
import {
  DEFAULT_TIMEZONE,
  type CalendarBlockType,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import { toObjectId } from "./provider.helpers";

export interface ReserveInput {
  providerId: unknown;
  start: Date;
  end: Date;
  blockType: CalendarBlockType;
  /** Booking or consultation this block belongs to. */
  sourceId?: Types.ObjectId | null;
  /** Temporary holds expire; confirmed work does not. */
  expiresAt?: Date | null;
  createdBy?: unknown;
  reason?: string;
  /** Booking/consultation windows must sit inside recurring availability; manual blocks need not. */
  requireWithinRules?: boolean;
  /**
   * Block types that do NOT conflict with this reservation. Manual and travel
   * blocks are soft (a provider may overlap their own notes), bookings are not.
   */
  ignoreBlockTypes?: readonly CalendarBlockType[];
  session: ClientSession;
}

/**
 * The single place provider time is claimed. Callers must pass the session of
 * a transaction (TransactionService.run).
 *
 * Concurrency: step 1 increments `calendarSeq` on the provider row. Two
 * transactions doing that collide on the row lock; the loser is retried by
 * `withTransaction` and then sees the winner's committed block in step 3, so
 * overlapping reservations of one provider can never both commit even though
 * no unique index can express "intervals must not overlap".
 */
@Injectable()
export class ProviderCalendarService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profiles: Model<any>,
    @InjectModel("ProviderCalendarBlock") private readonly blocks: Model<any>,
    @InjectModel("ProviderAvailabilityRule") private readonly rules: Model<any>,
  ) {}

  async reserve(input: ReserveInput): Promise<any> {
    const providerId = toObjectId(input.providerId, "providerId");
    if (!(input.end > input.start))
      throw providerError.badRequest(
        "CALENDAR_INVALID_RANGE",
        "The end of a calendar block must be after its start",
      );

    // 1. Serialise on the provider row.
    const locked = await this.profiles.findOneAndUpdate(
      { _id: providerId, deletedAt: null },
      { $inc: { calendarSeq: 1 } },
      { new: true, session: input.session, projection: { _id: 1 } },
    );
    if (!locked)
      throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");

    // 2. Recurring availability.
    if (input.requireWithinRules) {
      const rules = await this.activeRules(providerId, input.session);
      const timezone = rules[0]?.timezone ?? DEFAULT_TIMEZONE;
      if (!isWithinRules({ start: input.start, end: input.end, timezone, rules }))
        throw providerError.conflict(
          "PROVIDER_UNAVAILABLE_AT_TIME",
          "The provider is not available at the requested time",
        );
    }

    // 3. Conflicts with live blocks (expired holds no longer count).
    const now = new Date();
    const filter: Record<string, unknown> = {
      resourceType: "PROVIDER",
      resourceId: providerId,
      status: "ACTIVE",
      startAt: { $lt: input.end },
      endAt: { $gt: input.start },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
    if (input.ignoreBlockTypes?.length)
      filter.blockType = { $nin: [...input.ignoreBlockTypes] };
    const conflict = await this.blocks
      .findOne(filter)
      .session(input.session)
      .select("_id")
      .lean();
    if (conflict)
      throw providerError.conflict(
        "PROVIDER_TIME_CONFLICT",
        "The provider already has a commitment at that time",
      );

    // 4. Claim it.
    const [block] = await this.blocks.create(
      [
        {
          resourceType: "PROVIDER",
          resourceId: providerId,
          startAt: input.start,
          endAt: input.end,
          blockType: input.blockType,
          sourceId: input.sourceId ?? null,
          status: "ACTIVE",
          expiresAt: input.expiresAt ?? null,
          reason: input.reason,
          createdBy: input.createdBy,
        },
      ],
      { session: input.session },
    );
    return block;
  }

  /** Releases a block; a block that is already released/expired is left alone. */
  async release(
    blockId: unknown,
    status: "RELEASED" | "EXPIRED" = "RELEASED",
    session?: ClientSession,
  ): Promise<boolean> {
    if (!blockId) return false;
    const result = await this.blocks.updateOne(
      { _id: toObjectId(blockId, "blockId"), status: "ACTIVE" },
      { $set: { status, releasedAt: new Date() } },
      { session },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Turns a temporary hold into committed time.
   *
   * A hold can outlive its expiry until the maintenance job sweeps it, and in
   * that window the slot may have been given to someone else. So, under the
   * same provider row lock as `reserve`, the hold must still be ACTIVE and no
   * other live block may overlap it; otherwise the slot is lost and the caller
   * (e.g. a late payment confirmation) must be told rather than double-selling.
   */
  async confirmHold(
    blockId: unknown,
    blockType: CalendarBlockType,
    session: ClientSession,
  ): Promise<void> {
    const id = toObjectId(blockId, "blockId");
    const block: any = await this.blocks.findById(id).session(session).lean();
    if (!block || block.status !== "ACTIVE")
      throw providerError.conflict(
        "CALENDAR_HOLD_LOST",
        "The reserved time was released before it could be confirmed",
      );
    const locked = await this.profiles.findOneAndUpdate(
      { _id: block.resourceId },
      { $inc: { calendarSeq: 1 } },
      { new: true, session, projection: { _id: 1 } },
    );
    if (!locked)
      throw providerError.notFound("PROVIDER_NOT_FOUND", "Provider not found");
    const rival = await this.blocks
      .findOne({
        _id: { $ne: id },
        resourceType: "PROVIDER",
        resourceId: block.resourceId,
        status: "ACTIVE",
        startAt: { $lt: block.endAt },
        endAt: { $gt: block.startAt },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
      .session(session)
      .select("_id")
      .lean();
    if (rival)
      throw providerError.conflict(
        "CALENDAR_HOLD_LOST",
        "The reserved time was taken by another booking before it could be confirmed",
      );
    await this.blocks.updateOne(
      { _id: id, status: "ACTIVE" },
      { $set: { blockType, expiresAt: null } },
      { session },
    );
  }

  /** Moves a block (used when an expert reschedules a consultation). */
  async reschedule(
    blockId: unknown,
    start: Date,
    end: Date,
    session: ClientSession,
  ): Promise<void> {
    await this.blocks.updateOne(
      { _id: toObjectId(blockId, "blockId"), status: "ACTIVE" },
      { $set: { startAt: start, endAt: end } },
      { session },
    );
  }

  async activeRules(providerId: unknown, session?: ClientSession): Promise<RuleRecord[]> {
    return this.rules
      .find({
        resourceType: "PROVIDER",
        resourceId: toObjectId(providerId, "providerId"),
        status: "ACTIVE",
      })
      .session(session ?? null)
      .lean<RuleRecord[]>();
  }

  /** Live blocks overlapping a window, for slot computation. */
  async liveBlocks(
    providerId: unknown,
    from: Date,
    to: Date,
    session?: ClientSession,
  ): Promise<Array<{ start: Date; end: Date }>> {
    const now = new Date();
    const rows: any[] = await this.blocks
      .find({
        resourceType: "PROVIDER",
        resourceId: toObjectId(providerId, "providerId"),
        status: "ACTIVE",
        startAt: { $lt: to },
        endAt: { $gt: from },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
      .session(session ?? null)
      .select("startAt endAt")
      .lean();
    return rows.map((row) => ({ start: row.startAt, end: row.endAt }));
  }
}
