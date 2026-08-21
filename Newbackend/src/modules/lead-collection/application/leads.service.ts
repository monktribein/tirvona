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

interface AgentLeadScope {
  capturedBy: string;
  state?: string;
  district?: string;
}

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

  private toDocument(
    dto: SaveLeadDto,
    jurisdiction?: { state: string; district: string },
  ): Record<string, unknown> {
    const lat = dto.location?.coordinates?.lat ?? null;
    const lng = dto.location?.coordinates?.lng ?? null;
    const hasFix = typeof lat === "number" && typeof lng === "number";

    return {
      name: dto.name.trim(),
      location: {
        address: dto.location?.address?.trim() ?? "",
        city: dto.location?.city?.trim() ?? "",
        district:
          jurisdiction?.district ?? dto.location?.district?.trim() ?? "",
        state: jurisdiction?.state ?? dto.location?.state?.trim() ?? "",
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
      assignedAgentId:
        dto.assignedAgentId && Types.ObjectId.isValid(dto.assignedAgentId)
          ? new Types.ObjectId(dto.assignedAgentId)
          : null,
      assignedAgentName: dto.assignedAgentName?.trim() ?? "",
      assignedAgentCode: dto.assignedAgentCode?.trim() ?? "",
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
    scope?: AgentLeadScope,
  ): Promise<LeadListResult> {
    const filter = this.buildFilter(query);
    if (scope) {
      filter.capturedBy = this.objectId(scope.capturedBy);
      if (scope.state) filter["location.state"] = scope.state;
      if (scope.district) filter["location.district"] = scope.district;
    }

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

  async findOne(id: string, scope?: AgentLeadScope): Promise<LeadRecord> {
    const row = await this.leads.findById(this.objectId(id)).lean<LeadRecord>();
    if (!row) throw new NotFoundException("Lead not found");
    if (scope && String(row.capturedBy ?? "") !== scope.capturedBy)
      throw new ForbiddenException("This lead belongs to another agent");
    if (
      scope?.state &&
      scope?.district &&
      (row.location.state !== scope.state ||
        row.location.district !== scope.district)
    )
      throw new ForbiddenException("This lead is outside your assigned region");
    return row;
  }

  async create(
    dto: SaveLeadDto,
    agent: AuthenticatedLeadUser,
  ): Promise<LeadRecord> {
    const created = await this.leads.create({
      ...this.toDocument(dto, {
        state: agent.state,
        district: agent.district,
      }),
      status: "pending",
      capturedBy: new Types.ObjectId(agent.id),
      capturedByName: agent.name,
      capturedAt: new Date(),
    });
    return this.findOne(created._id.toString());
  }

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
    scope?: AgentLeadScope,
  ): Promise<LeadRecord> {
    const existing = await this.findOne(id, scope);
    if (scope && existing.status !== "pending")
      throw new ForbiddenException(
        "This lead has already been reviewed and can no longer be edited",
      );

    const update = this.toDocument(
      dto,
      scope?.state && scope?.district
        ? { state: scope.state, district: scope.district }
        : undefined,
    );
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
    scope?: AgentLeadScope,
  ): Promise<{ id: string }> {
    await this.findOne(id, scope);
    await this.leads.findByIdAndDelete(this.objectId(id));
    return { id };
  }

  async stats(scope?: AgentLeadScope): Promise<LeadStats> {
    const match: Record<string, unknown> = scope
      ? { capturedBy: this.objectId(scope.capturedBy) }
      : {};
    if (scope?.state) match["location.state"] = scope.state;
    if (scope?.district) match["location.district"] = scope.district;
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

  async listByDistrict(
    query: LeadQueryDto,
    state: string,
    district: string,
    agentId?: string,
  ): Promise<LeadListResult> {
    const filter = this.buildFilter(query);
    const districtRegex = new RegExp(escapeRegex(district.trim()), "i");
    filter.$or = [
      { "location.district": districtRegex },
      { "location.city": districtRegex },
      { "location.address": districtRegex },
    ];
    if (agentId) filter.capturedBy = this.objectId(agentId);

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

  async statsByDistrict(state: string, district: string): Promise<LeadStats> {
    const districtRegex = new RegExp(escapeRegex(district.trim()), "i");
    const match: Record<string, unknown> = {
      $or: [
        { "location.district": districtRegex },
        { "location.city": districtRegex },
        { "location.address": districtRegex },
      ],
    };
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

