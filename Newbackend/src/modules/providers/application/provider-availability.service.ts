import { Injectable } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  AvailabilityRuleError,
  flattenWeeklyRules,
  freeWindowsOn,
  groupWeeklyRules,
  weeklyRrule,
  type RuleRecord,
  type WeeklyRuleInput,
} from "../domain/availability.util";
import {
  DEFAULT_TIMEZONE,
  MAX_AVAILABILITY_QUERY_DAYS,
  MAX_BLOCK_DAYS,
  PROVIDER_MANAGED_BLOCK_TYPES,
  type CalendarBlockType,
} from "../domain/provider.constants";
import { providerError } from "../domain/provider.errors";
import {
  addDays,
  daysBetween,
  isRealIsoDate,
  isValidTimezone,
  localDateOf,
  localTimeOf,
  dayOfWeekOf,
  zonedToUtc,
} from "../domain/provider-time.util";
import type {
  AvailabilityQueryDto,
  CalendarQueryDto,
  CreateCalendarBlockDto,
  PutAvailabilityRulesDto,
} from "../presentation/dto/provider.dto";
import { pageParams } from "../presentation/dto/common.dto";
import { ProviderAuditService } from "./provider-audit.service";
import { ProviderCalendarService } from "./provider-calendar.service";
import { ProviderProfileService } from "./provider-profile.service";
import { ProviderProjectionService } from "./provider-projection.service";
import { idStr, paged, sameId, toObjectId } from "./provider.helpers";

@Injectable()
export class ProviderAvailabilityService {
  constructor(
    @InjectModel("ProviderProfile") private readonly profileModel: Model<any>,
    @InjectModel("ProviderAvailabilityRule") private readonly rules: Model<any>,
    @InjectModel("ProviderCalendarBlock") private readonly blocks: Model<any>,
    private readonly transactions: TransactionService,
    private readonly profiles: ProviderProfileService,
    private readonly calendar: ProviderCalendarService,
    private readonly projection: ProviderProjectionService,
    private readonly audit: ProviderAuditService,
  ) {}

  // ---------------------------------------------------------------- rules
  async getOwnRules(user: AuthenticatedUser) {
    const provider = await this.profiles.requireOwn(user);
    const rules = await this.calendar.activeRules(provider._id);
    return { success: true, data: this.rulesView(provider._id, rules) };
  }

  /** Replaces the weekly schedule atomically (PUT semantics: the payload is the whole schedule). */
  async putRules(user: AuthenticatedUser, dto: PutAvailabilityRulesDto) {
    const provider = await this.profiles.requireOwn(user);
    this.profiles.assertNotSuspended(provider);
    const existing = await this.calendar.activeRules(provider._id);
    const timezone = dto.timezone ?? existing[0]?.timezone ?? DEFAULT_TIMEZONE;
    if (!isValidTimezone(timezone))
      throw providerError.badRequest("INVALID_TIMEZONE", `"${timezone}" is not a valid IANA timezone`);

    let flat: ReturnType<typeof flattenWeeklyRules>;
    try {
      flat = flattenWeeklyRules(dto.rules as WeeklyRuleInput[]);
    } catch (error) {
      if (error instanceof AvailabilityRuleError)
        throw providerError.badRequest(error.code, error.message);
      throw error;
    }

    await this.transactions.run(async (session) => {
      // Same row lock as reservations, so a booking in flight sees either the old or the new schedule.
      await this.profileModel.updateOne(
        { _id: provider._id },
        { $inc: { calendarSeq: 1 } },
        { session },
      );
      await this.rules.deleteMany(
        { resourceType: "PROVIDER", resourceId: provider._id },
        { session },
      );
      if (flat.length)
        await this.rules.insertMany(
          flat.map(({ dayOfWeek, window }) => ({
            resourceType: "PROVIDER",
            resourceId: provider._id,
            timezone,
            rrule: weeklyRrule(dayOfWeek),
            window,
            status: "ACTIVE",
          })),
          { session },
        );
    });
    await this.projection.rebuild(provider._id);
    await this.audit.log(user, "availability.rules_replaced", "provider_profile", provider._id, {
      slots: flat.length,
      timezone,
    });
    return {
      success: true,
      data: this.rulesView(
        provider._id,
        flat.map(({ dayOfWeek, window }) => ({
          rrule: weeklyRrule(dayOfWeek),
          timezone,
          window,
          status: "ACTIVE",
        })),
      ),
    };
  }

  // --------------------------------------------------------------- blocks
  async listBlocks(user: AuthenticatedUser, query: CalendarQueryDto) {
    const provider = await this.profiles.requireOwn(user);
    const { page, limit, skip } = pageParams(query);
    const timezone = await this.timezoneOf(provider._id);
    const from = query.from ? zonedToUtc(query.from, "00:00", timezone) : new Date();
    const filter: Record<string, unknown> = {
      resourceType: "PROVIDER",
      resourceId: provider._id,
      status: "ACTIVE",
      endAt: { $gt: from },
    };
    if (query.to) filter.startAt = { $lt: zonedToUtc(addDays(query.to, 1), "00:00", timezone) };
    const [rows, total] = await Promise.all([
      this.blocks.find(filter).sort({ startAt: 1 }).skip(skip).limit(limit).lean(),
      this.blocks.countDocuments(filter),
    ]);
    return paged(
      (rows as any[]).map((row) => this.blockView(row, timezone)),
      total,
      page,
      limit,
    );
  }

  async createBlock(user: AuthenticatedUser, dto: CreateCalendarBlockDto) {
    const provider = await this.profiles.requireOwn(user);
    this.profiles.assertNotSuspended(provider);
    const timezone = await this.timezoneOf(provider._id);
    const { start, end } = this.blockRange(dto, timezone);
    const blockType = (dto.blockType ?? "MANUAL") as CalendarBlockType;

    const block = await this.transactions.run((session) =>
      this.calendar.reserve({
        providerId: provider._id,
        start,
        end,
        blockType,
        createdBy: user.id,
        reason: dto.reason,
        // A soft block may sit on top of other soft blocks, never on top of work.
        ignoreBlockTypes: PROVIDER_MANAGED_BLOCK_TYPES,
        session,
      }),
    );
    await this.audit.log(user, "calendar.block_created", "calendar_block", block._id, {
      providerId: idStr(provider._id),
      blockType,
    });
    return { success: true, data: this.blockView(block.toObject(), timezone) };
  }

  async releaseBlock(user: AuthenticatedUser, blockId: string) {
    const provider = await this.profiles.requireOwn(user);
    const block: any = await this.blocks.findById(toObjectId(blockId, "blockId")).lean();
    if (!block || !sameId(block.resourceId, provider._id))
      throw providerError.notFound("BLOCK_NOT_FOUND", "Calendar block not found");
    if (!PROVIDER_MANAGED_BLOCK_TYPES.includes(block.blockType))
      throw providerError.conflict(
        "BLOCK_NOT_RELEASABLE",
        "This time is held by a booking or consultation. Cancel that instead.",
      );
    if (block.status !== "ACTIVE")
      return { success: true, data: null, message: "Block was already released" };
    await this.calendar.release(block._id);
    await this.audit.log(user, "calendar.block_released", "calendar_block", block._id, {
      providerId: idStr(provider._id),
    });
    return { success: true, data: null };
  }

  // --------------------------------------------------- availability query
  /**
   * Free windows per local day. Only windows are returned: block reasons and
   * the identity of whoever holds the time are never exposed.
   */
  async query(actor: AuthenticatedUser | undefined, idOrSlug: string, query: AvailabilityQueryDto) {
    const provider = await this.resolveVisible(actor, idOrSlug);
    const rules = await this.calendar.activeRules(provider._id);
    const timezone = rules[0]?.timezone ?? DEFAULT_TIMEZONE;

    if (!isRealIsoDate(query.from) || (query.to && !isRealIsoDate(query.to)))
      throw providerError.badRequest("INVALID_DATE", "Dates must be real calendar dates (YYYY-MM-DD)");
    const to = query.to ?? query.from;
    if (to < query.from)
      throw providerError.badRequest("INVALID_RANGE", "'to' must not be before 'from'");
    if (daysBetween(query.from, to) + 1 > MAX_AVAILABILITY_QUERY_DAYS)
      throw providerError.badRequest(
        "RANGE_TOO_LARGE",
        `Ask for at most ${MAX_AVAILABILITY_QUERY_DAYS} days at a time`,
      );

    const windowStart = zonedToUtc(query.from, "00:00", timezone);
    const windowEnd = zonedToUtc(addDays(to, 1), "00:00", timezone);
    const blocks = await this.calendar.liveBlocks(provider._id, windowStart, windowEnd);
    const now = new Date();

    const days = [];
    for (let date = query.from; date <= to; date = addDays(date, 1)) {
      const windows = freeWindowsOn({
        date,
        timezone,
        rules,
        blocks,
        now,
        minDurationMinutes: query.durationMinutes,
      });
      days.push({
        date,
        dayOfWeek: dayOfWeekOf(date),
        windows: windows.map((window) => ({
          startAt: window.start.toISOString(),
          endAt: window.end.toISOString(),
          startTime: localTimeOf(window.start, timezone),
          endTime: localDateOf(window.end, timezone) === date ? localTimeOf(window.end, timezone) : "24:00",
        })),
      });
    }
    return {
      success: true,
      data: {
        providerId: idStr(provider._id),
        timezone,
        scheduleConfigured: rules.length > 0,
        days,
      },
    };
  }

  /** Whole-schedule view used by the public detail page and by search's date filter. */
  async hasFreeWindow(
    providerIds: unknown[],
    date: string,
    durationMinutes: number,
  ): Promise<Set<string>> {
    const ok = new Set<string>();
    if (!providerIds.length) return ok;
    const ids = providerIds.map((id) => toObjectId(id));
    const allRules: any[] = await this.rules
      .find({ resourceType: "PROVIDER", resourceId: { $in: ids }, status: "ACTIVE" })
      .lean();
    const byProvider = new Map<string, RuleRecord[]>();
    for (const rule of allRules) {
      const key = String(rule.resourceId);
      byProvider.set(key, [...(byProvider.get(key) ?? []), rule]);
    }
    const now = new Date();
    for (const id of ids) {
      const rules = byProvider.get(String(id)) ?? [];
      if (!rules.length) continue;
      const timezone = rules[0].timezone ?? DEFAULT_TIMEZONE;
      const start = zonedToUtc(date, "00:00", timezone);
      const end = zonedToUtc(addDays(date, 1), "00:00", timezone);
      const blocks = await this.calendar.liveBlocks(id, start, end);
      if (
        freeWindowsOn({ date, timezone, rules, blocks, now, minDurationMinutes: durationMinutes })
          .length
      )
        ok.add(String(id));
    }
    return ok;
  }

  async timezoneOf(providerId: unknown): Promise<string> {
    const rules = await this.calendar.activeRules(providerId);
    return rules[0]?.timezone ?? DEFAULT_TIMEZONE;
  }

  // ------------------------------------------------------------ internals
  private async resolveVisible(
    actor: AuthenticatedUser | undefined,
    idOrSlug: string,
  ): Promise<any> {
    try {
      return await this.profiles.findPublicProfile(idOrSlug);
    } catch (error) {
      // A provider may look at their own schedule while still being onboarded.
      const key = String(idOrSlug).toLowerCase();
      const own: any = actor
        ? await this.profileModel
            .findOne({
              userId: toObjectId(actor.id),
              deletedAt: null,
              ...(/^[a-f0-9]{24}$/.test(key) ? { _id: key } : { slug: key }),
            })
            .lean()
        : null;
      if (own) return own;
      throw error;
    }
  }

  private rulesView(
    providerId: unknown,
    rules: Array<Pick<RuleRecord, "rrule" | "window" | "status" | "timezone">>,
  ) {
    return {
      providerId: idStr(providerId),
      timezone: rules[0]?.timezone ?? DEFAULT_TIMEZONE,
      rules: groupWeeklyRules(rules),
    };
  }

  private blockRange(dto: CreateCalendarBlockDto, timezone: string): { start: Date; end: Date } {
    const hasInstants = Boolean(dto.startAt || dto.endAt);
    const hasDates = Boolean(dto.startDate || dto.endDate);
    if (hasInstants === hasDates)
      throw providerError.badRequest(
        "BLOCK_RANGE_REQUIRED",
        "Give either startAt and endAt, or startDate and endDate",
      );
    let start: Date;
    let end: Date;
    if (hasInstants) {
      if (!dto.startAt || !dto.endAt)
        throw providerError.badRequest("BLOCK_RANGE_REQUIRED", "Both startAt and endAt are required");
      start = new Date(dto.startAt);
      end = new Date(dto.endAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        throw providerError.badRequest("INVALID_DATE", "startAt/endAt must be ISO 8601 date-times");
    } else {
      if (!dto.startDate || !dto.endDate)
        throw providerError.badRequest("BLOCK_RANGE_REQUIRED", "Both startDate and endDate are required");
      if (!isRealIsoDate(dto.startDate) || !isRealIsoDate(dto.endDate))
        throw providerError.badRequest("INVALID_DATE", "Dates must be real calendar dates (YYYY-MM-DD)");
      start = zonedToUtc(dto.startDate, "00:00", timezone);
      end = zonedToUtc(addDays(dto.endDate, 1), "00:00", timezone); // end date is inclusive
    }
    if (end <= start)
      throw providerError.badRequest("INVALID_RANGE", "The block must end after it starts");
    if (end.getTime() - start.getTime() > MAX_BLOCK_DAYS * 86_400_000)
      throw providerError.badRequest("RANGE_TOO_LARGE", `A block can span at most ${MAX_BLOCK_DAYS} days`);
    if (end <= new Date())
      throw providerError.badRequest("BLOCK_IN_PAST", "That period is already over");
    return { start, end };
  }

  private blockView(block: any, timezone: string) {
    const startAt: Date = block.startAt;
    const endAt: Date = block.endAt;
    return {
      id: idStr(block._id),
      providerId: idStr(block.resourceId),
      startAt,
      endAt,
      // Local calendar dates, inclusive of the last day: what a date picker needs.
      startDate: localDateOf(startAt, timezone),
      endDate: localDateOf(new Date(endAt.getTime() - 1), timezone),
      blockType: block.blockType,
      reason: block.reason ?? null,
      sourceId: idStr(block.sourceId) ?? null,
      releasable: PROVIDER_MANAGED_BLOCK_TYPES.includes(block.blockType),
    };
  }
}
