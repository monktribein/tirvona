import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { hash } from "bcryptjs";
import { Types, type Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { leadCollectionConfig } from "../config/lead-collection.config";
import {
  DEFAULT_LEAD_REGIONS,
  LEAD_CONNECTION,
  LEAD_MODEL,
  LEAD_REGION_MODEL,
  LEAD_USER_MODEL,
} from "../domain/lead-collection.constants";
import type {
  LeadDocument,
  LeadUserDocument,
  LeadUserListRow,
  LeadUserRecord,
} from "../domain/lead-collection.types";
import type {
  CreateLeadUserDto,
  CreateLeadRegionDto,
  LeadUserQueryDto,
  ResetLeadUserPasswordDto,
  UpdateLeadUserDto,
} from "../presentation/dtos/lead-user.dto";

export interface LeadAdminActor {
  id: string;
  name: string;
}

@Injectable()
export class LeadUsersService {
  private readonly config = leadCollectionConfig();

  constructor(
    @InjectModel(LEAD_USER_MODEL, LEAD_CONNECTION)
    private readonly leadUsers: Model<LeadUserDocument>,
    @InjectModel(LEAD_MODEL, LEAD_CONNECTION)
    private readonly leads: Model<LeadDocument>,
    @InjectModel(LEAD_REGION_MODEL, LEAD_CONNECTION)
    private readonly regions: Model<any>,
    @InjectModel("Ashram") private readonly ashrams: Model<any>,
  ) {}

  private regionName(state: string, district: string): string {
    return `${district.trim()}, ${state.trim()}`;
  }

  async listRegions(): Promise<
    { state: string; district: string; source: "tirvona" | "custom" }[]
  > {
    const [ashramRows, customRows] = await Promise.all([
      this.ashrams.aggregate<{ state: string; district: string }>([
        {
          $match: {
            deletedAt: null,
            "address.state": { $nin: [null, ""] },
            "address.district": { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id: {
              state: { $toLower: "$address.state" },
              district: { $toLower: "$address.district" },
            },
            state: { $first: "$address.state" },
            district: { $first: "$address.district" },
          },
        },
        { $project: { _id: 0, state: 1, district: 1 } },
      ]),
      this.regions.find().select("state district").lean(),
    ]);
    const merged = new Map<
      string,
      { state: string; district: string; source: "tirvona" | "custom" }
    >();
    for (const def of DEFAULT_LEAD_REGIONS) {
      merged.set(`${def.state}|${def.district}`.toLowerCase(), {
        state: def.state,
        district: def.district,
        source: "tirvona",
      });
    }
    for (const row of ashramRows)
      merged.set(`${row.state}|${row.district}`.toLowerCase(), {
        ...row,
        source: "tirvona",
      });
    for (const row of customRows as any[]) {
      const key = `${row.state}|${row.district}`.toLowerCase();
      if (!merged.has(key))
        merged.set(key, {
          state: row.state,
          district: row.district,
          source: "custom",
        });
    }
    return [...merged.values()].sort(
      (a, b) =>
        a.state.localeCompare(b.state) || a.district.localeCompare(b.district),
    );
  }

  private async assertRegion(state: string, district: string): Promise<void> {
    const isDefault = DEFAULT_LEAD_REGIONS.some(
      (r) =>
        r.state.toLowerCase() === state.trim().toLowerCase() &&
        r.district.toLowerCase() === district.trim().toLowerCase(),
    );
    if (isDefault) return;

    const stateMatch = new RegExp(`^${escapeRegex(state.trim())}$`, "i");
    const districtMatch = new RegExp(`^${escapeRegex(district.trim())}$`, "i");
    const [custom, tirvona] = await Promise.all([
      this.regions.exists({ state: stateMatch, district: districtMatch }),
      this.ashrams.exists({
        deletedAt: null,
        "address.state": stateMatch,
        "address.district": districtMatch,
      }),
    ]);
    if (!custom && !tirvona)
      throw new BadRequestException(
        "Select a region already in Tirvona or add it to the region catalogue first",
      );
  }

  async addRegion(dto: CreateLeadRegionDto, actor: LeadAdminActor) {
    if (!actor.id?.trim())
      throw new BadRequestException("A verified super admin is required");
    const state = dto.state.trim();
    const district = dto.district.trim();
    const exists = await this.listRegions();
    if (
      exists.some(
        (row) =>
          row.state.toLowerCase() === state.toLowerCase() &&
          row.district.toLowerCase() === district.toLowerCase(),
      )
    )
      throw new ConflictException("This region is already available");
    const created = await this.regions.create({
      state,
      district,
      createdByAdminId: actor.id,
      createdByAdminName: actor.name,
    });
    return { id: created._id.toString(), state, district, source: "custom" };
  }

  async removeRegion(state: string, district: string): Promise<{ deleted: boolean }> {
    const assigned = await this.leadUsers.exists({ state, district });
    if (assigned)
      throw new ConflictException(
        "This region is assigned to a field agent and cannot be removed",
      );
    const result = await this.regions.deleteOne({ state, district });
    return { deleted: result.deletedCount === 1 };
  }

  static normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  private objectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid lead user id");
    return new Types.ObjectId(id);
  }

  async list(query: LeadUserQueryDto): Promise<{
    items: LeadUserListRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.role) filter.role = query.role;
    if (query.search?.trim()) {
      const term = new RegExp(escapeRegex(query.search.trim()), "i");
      filter.$or = [
        { name: term },
        { phone: term },
        { email: term },
        { employeeCode: term },
        { state: term },
        { district: term },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.leadUsers
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeadUserRecord[]>(),
      this.leadUsers.countDocuments(filter),
    ]);

    const counts = await this.leads.aggregate<{
      _id: Types.ObjectId;
      total: number;
    }>([
      { $match: { capturedBy: { $in: items.map((item) => item._id) } } },
      { $group: { _id: "$capturedBy", total: { $sum: 1 } } },
    ]);
    const byAgent = new Map(counts.map((row) => [String(row._id), row.total]));

    return {
      items: items.map((item) => ({
        ...item,
        leadCount: byAgent.get(String(item._id)) ?? 0,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<LeadUserRecord> {
    const row = await this.leadUsers
      .findById(this.objectId(id))
      .lean<LeadUserRecord>();
    if (!row) throw new NotFoundException("Lead user not found");
    return row;
  }

  async create(
    dto: CreateLeadUserDto,
    actor: LeadAdminActor,
  ): Promise<LeadUserRecord> {
    if (!actor.id?.trim())
      throw new BadRequestException(
        "A verified super admin is required to create a field agent",
      );
    const phone = LeadUsersService.normalisePhone(dto.phone);
    if (phone.length !== 10)
      throw new BadRequestException("Phone must be a 10-digit mobile number");
    if (await this.leadUsers.exists({ phone }))
      throw new ConflictException("A lead user with this phone already exists");
    await this.assertRegion(dto.state, dto.district);

    const created = await this.leadUsers.create({
      name: dto.name.trim(),
      phone,
      email: dto.email?.trim().toLowerCase() ?? "",
      passwordHash: await hash(dto.password, this.config.bcryptRounds),
      role: dto.role ?? "field_agent",
      status: dto.status ?? "active",
      state: dto.state.trim(),
      district: dto.district.trim(),
      region: this.regionName(dto.state, dto.district),
      employeeCode: dto.employeeCode?.trim() ?? "",
      notes: dto.notes?.trim() ?? "",
      createdByAdminId: actor.id,
      createdByAdminName: actor.name,
    });
    return this.findOne(created._id.toString());
  }

  async update(id: string, dto: UpdateLeadUserDto): Promise<LeadUserRecord> {
    const update: Record<string, unknown> = {};
    let invalidateSessions = false;
    let jurisdiction: { state: string; district: string } | null = null;
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.email !== undefined) update.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) {
      update.role = dto.role;
      invalidateSessions = true;
    }
    if (dto.state !== undefined || dto.district !== undefined) {
      const existing = await this.findOne(id);
      const state = dto.state?.trim() ?? existing.state;
      const district = dto.district?.trim() ?? existing.district;
      await this.assertRegion(state, district);
      update.state = state;
      update.district = district;
      update.region = this.regionName(state, district);
      jurisdiction = { state, district };
      invalidateSessions = true;
    }
    if (dto.employeeCode !== undefined)
      update.employeeCode = dto.employeeCode.trim();
    if (dto.notes !== undefined) update.notes = dto.notes.trim();

    if (dto.phone !== undefined) {
      const phone = LeadUsersService.normalisePhone(dto.phone);
      if (phone.length !== 10)
        throw new BadRequestException("Phone must be a 10-digit mobile number");
      const clash = await this.leadUsers.exists({
        phone,
        _id: { $ne: this.objectId(id) },
      });
      if (clash)
        throw new ConflictException("Another lead user already uses this phone");
      update.phone = phone;
      invalidateSessions = true;
    }

    const inc: Record<string, number> = invalidateSessions
      ? { tokenVersion: 1 }
      : {};
    if (dto.status !== undefined) {
      update.status = dto.status;
      if (dto.status === "suspended") inc.tokenVersion = 1;
    }

    const row = await this.leadUsers
      .findByIdAndUpdate(
        this.objectId(id),
        Object.keys(inc).length ? { $set: update, $inc: inc } : { $set: update },
        { new: true },
      )
      .lean<LeadUserRecord>();
    if (!row) throw new NotFoundException("Lead user not found");
    if (jurisdiction)
      await this.leads.updateMany(
        { capturedBy: row._id },
        {
          $set: {
            "location.state": jurisdiction.state,
            "location.district": jurisdiction.district,
          },
        },
      );
    return row;
  }

  async resetPassword(
    id: string,
    dto: ResetLeadUserPasswordDto,
  ): Promise<{ id: string }> {
    const row = await this.leadUsers.findByIdAndUpdate(
      this.objectId(id),
      {
        $set: { passwordHash: await hash(dto.password, this.config.bcryptRounds) },
        $inc: { tokenVersion: 1 },
      },
      { new: true },
    );
    if (!row) throw new NotFoundException("Lead user not found");
    return { id: row._id.toString() };
  }

  async remove(id: string): Promise<{ id: string; leadsRetained: number }> {
    const objectId = this.objectId(id);
    const row = await this.leadUsers.findByIdAndDelete(objectId);
    if (!row) throw new NotFoundException("Lead user not found");
    const leadsRetained = await this.leads.countDocuments({
      capturedBy: objectId,
    });
    return { id, leadsRetained };
  }

  async listByDistrict(
    state: string,
    district: string,
    query: LeadUserQueryDto,
  ): Promise<{
    items: LeadUserListRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const effDistrict = (query.district || district || "").trim();
    const effState = (query.state || state || "").trim();

    const orClauses: Record<string, unknown>[] = [];
    if (effDistrict) {
      const districtRegex = new RegExp(`^${escapeRegex(effDistrict)}$`, "i");
      const regionRegex = new RegExp(escapeRegex(effDistrict), "i");
      if (effState) {
        const stateRegex = new RegExp(`^${escapeRegex(effState)}$`, "i");
        orClauses.push({ state: stateRegex, district: districtRegex });
      }
      orClauses.push({ district: districtRegex });
      orClauses.push({ region: regionRegex });
    } else if (effState) {
      const stateRegex = new RegExp(`^${escapeRegex(effState)}$`, "i");
      orClauses.push({ state: stateRegex });
    }

    const filter: Record<string, unknown> = {};
    if (orClauses.length > 0) {
      filter.$or = orClauses;
    }
    filter.role = query.role ? query.role : { $in: ["field_agent", "lead_executive", "document_verifier"] };
    if (query.status) filter.status = query.status;
    if (query.search?.trim()) {
      const term = new RegExp(escapeRegex(query.search.trim()), "i");
      filter.$and = [
        {
          $or: [
            { name: term },
            { phone: term },
            { email: term },
            { employeeCode: term },
          ],
        },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.leadUsers
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<LeadUserRecord[]>(),
      this.leadUsers.countDocuments(filter),
    ]);

    const counts = await this.leads.aggregate<{
      _id: Types.ObjectId;
      total: number;
    }>([
      { $match: { capturedBy: { $in: items.map((item) => item._id) } } },
      { $group: { _id: "$capturedBy", total: { $sum: 1 } } },
    ]);
    const byAgent = new Map(counts.map((row) => [String(row._id), row.total]));

    return {
      items: items.map((item) => ({
        ...item,
        leadCount: byAgent.get(String(item._id)) ?? 0,
      })),
      total,
      page,
      limit,
    };
  }

  async findOneInDistrict(
    id: string,
    state: string,
    district: string,
  ): Promise<LeadUserRecord> {
    const row = await this.findOne(id);
    const districtTerm = district.trim().toLowerCase();
    const rowDistrict = (row.district ?? "").trim().toLowerCase();
    const rowRegion = (row.region ?? "").trim().toLowerCase();
    const matches =
      rowDistrict === districtTerm ||
      rowDistrict.includes(districtTerm) ||
      rowRegion.includes(districtTerm);

    const isAuthorizedRole =
      row.role === "field_agent" || row.role === "lead_executive" || row.role === "document_verifier";

    if (!matches || !isAuthorizedRole) {
      throw new ForbiddenException(
        "This agent does not belong to your district",
      );
    }
    return row;
  }

  async createForSupervisor(
    dto: CreateLeadUserDto,
    supervisor: { id: string; name: string; state: string; district: string },
  ): Promise<LeadUserRecord> {
    dto.state = supervisor.state;
    dto.district = supervisor.district;
    dto.role =
      dto.role === "lead_executive"
        ? "lead_executive"
        : dto.role === "document_verifier"
        ? "document_verifier"
        : "field_agent";
    return this.create(dto, { id: supervisor.id, name: supervisor.name });
  }
}

