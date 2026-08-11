import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { hash } from "bcryptjs";
import { Types, type Model } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import { leadCollectionConfig } from "../config/lead-collection.config";
import {
  LEAD_CONNECTION,
  LEAD_MODEL,
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
  LeadUserQueryDto,
  ResetLeadUserPasswordDto,
  UpdateLeadUserDto,
} from "../presentation/dtos/lead-user.dto";

/** Who performed an admin action, for the audit fields on the record. */
export interface LeadAdminActor {
  id: string;
  name: string;
}

/**
 * CRUD over `lead_users` — the account table for the lead product.
 *
 * Accounts are only ever created by a platform super admin from the console;
 * there is no public signup path into this collection.
 */
@Injectable()
export class LeadUsersService {
  private readonly config = leadCollectionConfig();

  constructor(
    @InjectModel(LEAD_USER_MODEL, LEAD_CONNECTION)
    private readonly leadUsers: Model<LeadUserDocument>,
    @InjectModel(LEAD_MODEL, LEAD_CONNECTION)
    private readonly leads: Model<LeadDocument>,
  ) {}

  /** Digits only, so `+91 98765 43210` and `9876543210` are one account. */
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

    // Lead counts per agent, so the console can show productivity without an
    // N+1 of one count query per row.
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
    const phone = LeadUsersService.normalisePhone(dto.phone);
    if (phone.length !== 10)
      throw new BadRequestException("Phone must be a 10-digit mobile number");
    if (await this.leadUsers.exists({ phone }))
      throw new ConflictException("A lead user with this phone already exists");

    const created = await this.leadUsers.create({
      name: dto.name.trim(),
      phone,
      email: dto.email?.trim().toLowerCase() ?? "",
      passwordHash: await hash(dto.password, this.config.bcryptRounds),
      role: dto.role ?? "field_agent",
      status: dto.status ?? "active",
      region: dto.region?.trim() ?? "",
      employeeCode: dto.employeeCode?.trim() ?? "",
      notes: dto.notes?.trim() ?? "",
      createdByAdminId: actor.id,
      createdByAdminName: actor.name,
    });
    return this.findOne(created._id.toString());
  }

  async update(id: string, dto: UpdateLeadUserDto): Promise<LeadUserRecord> {
    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.email !== undefined) update.email = dto.email.trim().toLowerCase();
    if (dto.role !== undefined) update.role = dto.role;
    if (dto.region !== undefined) update.region = dto.region.trim();
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
    }

    // Suspension has to invalidate whatever the agent is already carrying, so
    // it bumps `tokenVersion` rather than only flipping the flag.
    const inc: Record<string, number> = {};
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

  /**
   * Hard delete. The captured leads survive — `capturedByName` is denormalised
   * onto each one precisely so the trail does not vanish with the account.
   */
  async remove(id: string): Promise<{ id: string; leadsRetained: number }> {
    const objectId = this.objectId(id);
    const row = await this.leadUsers.findByIdAndDelete(objectId);
    if (!row) throw new NotFoundException("Lead user not found");
    const leadsRetained = await this.leads.countDocuments({
      capturedBy: objectId,
    });
    return { id, leadsRetained };
  }
}
