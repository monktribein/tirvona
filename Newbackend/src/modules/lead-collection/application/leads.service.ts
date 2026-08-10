import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types, type Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  LEAD_CONNECTION,
  LEAD_MODEL,
} from "../domain/lead-collection.constants";
import type {
  AuthenticatedLeadUser,
  LeadDocument,
  LeadRecord,
} from "../domain/lead-collection.types";
import type {
  LeadDecisionDto,
  LeadQueryDto,
  SaveLeadDto,
} from "../presentation/dtos/lead.dto";
import type { LeadAdminActor } from "./lead-users.service";

export interface LeadListResult {
  items: LeadRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface LeadStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  converted: number;
  interested: number;
  meetingsRequested: number;
  capturedLast7Days: number;
}

/**
 * Read/write access to the `leads` collection.
 *
 * Two audiences share it: a field agent, who may only touch what they
 * captured and only while it is still pending, and a super admin, who has
 * full CRUD plus the approve/reject decision. Both funnel through here so the
 * ownership rule lives in one place.
 */
@Injectable()
export class LeadsService {
  constructor(
    @InjectModel(LEAD_MODEL, LEAD_CONNECTION)
    private readonly leads: Model<LeadDocument>,
  ) {}

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid lead id");
    return new Types.ObjectId(id);
  }

  /**
   * Build the persisted shape from a capture payload.
   *
   * `geo` is derived here rather than trusted from the client so the GeoJSON
   * mirror can never drift from the `{ lat, lng }` the console displays, and
   * so a partial fix (lat but no lng) yields no Point at all instead of an
   * index-breaking half-coordinate.
   */
  private toDocument(dto: SaveLeadDto): Record<string, unknown> {
    const lat = dto.location?.coordinates?.lat ?? null;
    const lng = dto.location?.coordinates?.lng ?? null;
    const hasFix = typeof lat === "number" && typeof lng === "number";

    return {
      name: dto.name.trim(),
      location: {
        address: dto.location?.address?.trim() ?? "",
        city: dto.location?.city?.trim() ?? "",
        state: dto.location?.state?.trim() ?? "",
        coordinates: { lat, lng },
      },
      geo: hasFix ? { type: "Point", coordinates: [lng, lat] } : undefined,
      roomInventory: {
        totalRooms: dto.roomInventory?.totalRooms ?? null,
        roomPrice: dto.roomInventory?.roomPrice ?? null,
        onlineRooms: dto.roomInventory?.onlineRooms ?? null,
        offlineRooms: dto.roomInventory?.offlineRooms ?? null,
      },
      contact: {
        ownerName: dto.contact?.ownerName?.trim() ?? "",
        phone: dto.contact?.phone?.trim() ?? "",
      },
      notes: dto.notes?.trim() ?? "",
      interest: dto.interest ?? "Interested",
      meeting: {
        requested: dto.meeting?.requested ?? false,
        time: dto.meeting?.requested ? (dto.meeting.time ?? "") : "",
        mode: dto.meeting?.requested ? (dto.meeting.mode ?? "") : "",
      },
      images: dto.images ?? [],
    };
  }

  private buildFilter(query: LeadQueryDto): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.interest) filter.interest = query.interest;
    if (query.city?.trim())
      filter["location.city"] = new RegExp(
        `^${escapeRegex(query.city.trim())}$`,
        "i",
      );
    if (query.capturedBy) filter.capturedBy = this.objectId(query.capturedBy);
    if (query.search?.trim()) {
      const term = new RegExp(escapeRegex(query.search.trim()), "i");
      filter.$or = [
        { name: term },
        { "location.city": term },
        { "location.address": term },
        { "contact.ownerName": term },
        { "contact.phone": term },
        { capturedByName: term },
      ];
    }
    return filter;
  }

  async list(
    query: LeadQueryDto,
    scope?: { capturedBy: string },
  ): Promise<LeadListResult> {
    const filter = this.buildFilter(query);
    // An agent's own view is a hard scope, applied after the query filters so
    // a crafted `capturedBy` in the querystring cannot widen it.
    if (scope) filter.capturedBy = this.objectId(scope.capturedBy);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.leads
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeadRecord[]>(),
      this.leads.countDocuments(filter),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string, scope?: { capturedBy: string }): Promise<LeadRecord> {
    const row = await this.leads.findById(this.objectId(id)).lean<LeadRecord>();
    if (!row) throw new NotFoundException("Lead not found");
    if (scope && String(row.capturedBy ?? "") !== scope.capturedBy)
      throw new ForbiddenException("This lead belongs to another agent");
    return row;
  }

  /** Capture, by a signed-in field agent. */
  async create(
    dto: SaveLeadDto,
    agent: AuthenticatedLeadUser,
  ): Promise<LeadRecord> {
    const created = await this.leads.create({
      ...this.toDocument(dto),
      status: "pending",
      capturedBy: new Types.ObjectId(agent.id),
      capturedByName: agent.name,
      capturedAt: new Date(),
    });
    return this.findOne(created._id.toString());
  }

  /** Capture on an agent's behalf, by an admin working the console. */
  async createAsAdmin(dto: SaveLeadDto): Promise<LeadRecord> {
    const created = await this.leads.create({
      ...this.toDocument(dto),
      status: dto.status ?? "pending",
      capturedByName: "Admin console",
      capturedAt: new Date(),
    });
    return this.findOne(created._id.toString());
  }

  async update(
    id: string,
    dto: SaveLeadDto,
    scope?: { capturedBy: string },
  ): Promise<LeadRecord> {
    const existing = await this.findOne(id, scope);
    // An agent can correct a typo before anyone has looked at the lead; once
    // it is decided, only an admin may touch it.
    if (scope && existing.status !== "pending")
      throw new ForbiddenException(
        "This lead has already been reviewed and can no longer be edited",
      );

    const update = this.toDocument(dto);
    // `geo` is `undefined` when the fix was cleared — $set would store null and
    // break the sparse 2dsphere index, so unset it instead.
    const unset = update.geo === undefined ? { geo: "" } : undefined;
    if (unset) delete update.geo;
    if (!scope && dto.status) update.status = dto.status;

    const row = await this.leads
      .findByIdAndUpdate(
        this.objectId(id),
        unset ? { $set: update, $unset: unset } : { $set: update },
        { new: true },
      )
      .lean<LeadRecord>();
    if (!row) throw new NotFoundException("Lead not found");
    return row;
  }

  /** Approve or reject, recording who decided and why. */
  async decide(
    id: string,
    status: "approved" | "rejected" | "converted" | "pending",
    dto: LeadDecisionDto,
    actor: LeadAdminActor,
  ): Promise<LeadRecord> {
    const row = await this.leads
      .findByIdAndUpdate(
        this.objectId(id),
        {
          $set: {
            status,
            reviewNote: dto.note?.trim() ?? "",
            reviewedByAdminId: actor.id,
            reviewedByAdminName: actor.name,
            reviewedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean<LeadRecord>();
    if (!row) throw new NotFoundException("Lead not found");
    return row;
  }

  async remove(
    id: string,
    scope?: { capturedBy: string },
  ): Promise<{ id: string }> {
    await this.findOne(id, scope);
    await this.leads.findByIdAndDelete(this.objectId(id));
    return { id };
  }

  /**
   * Counters for the console header. Computed in one aggregation rather than
   * eight `countDocuments` round trips.
   */
  async stats(scope?: { capturedBy: string }): Promise<LeadStats> {
    const match = scope
      ? { capturedBy: this.objectId(scope.capturedBy) }
      : {};
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [row] = await this.leads.aggregate<LeadStats>([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          converted: {
            $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] },
          },
          interested: {
            $sum: { $cond: [{ $eq: ["$interest", "Interested"] }, 1, 0] },
          },
          meetingsRequested: {
            $sum: { $cond: [{ $eq: ["$meeting.requested", true] }, 1, 0] },
          },
          capturedLast7Days: {
            $sum: { $cond: [{ $gte: ["$capturedAt", sevenDaysAgo] }, 1, 0] },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return (
      row ?? {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        converted: 0,
        interested: 0,
        meetingsRequested: 0,
        capturedLast7Days: 0,
      }
    );
  }
}
