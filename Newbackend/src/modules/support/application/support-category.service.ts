import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  DEFAULT_CATEGORIES,
  LINKABLE_ENTITY_TYPES,
  SUPPORT_HANDLER_ROLES,
} from "../domain/support.constants";
import type {
  CreateSupportCategoryDto,
  UpdateSupportCategoryDto,
} from "../presentation/support.dto";

@Injectable()
export class SupportCategoryService {
  constructor(
    @InjectModel("SupportCategory") private readonly categories: Model<any>,
    @InjectModel("SupportTicket") private readonly tickets: Model<any>,
  ) {}

  /** Inserts any default category that does not exist yet; never overwrites admin edits. */
  async seedDefaults(): Promise<number> {
    let created = 0;
    for (const [index, seed] of DEFAULT_CATEGORIES.entries()) {
      if (await this.categories.exists({ key: seed.key })) continue;
      try {
        await this.categories.create({ ...seed, sortOrder: (index + 1) * 10, isActive: true });
        created++;
      } catch (error) {
        // Another instance seeded it at the same moment (unique key) — fine.
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    return created;
  }

  listActive(): Promise<any[]> {
    return this.categories
      .find({ isActive: true })
      .select("key label description defaultPriority entityTypes sortOrder")
      .sort({ sortOrder: 1, label: 1 })
      .lean();
  }

  async listAll(): Promise<any[]> {
    const [rows, counts] = await Promise.all([
      this.categories.find({}).sort({ sortOrder: 1, label: 1 }).lean(),
      this.tickets.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
    ]);
    const byKey = new Map(counts.map((c: any) => [c._id, c.count]));
    return rows.map((row: any) => ({ ...row, ticketCount: byKey.get(row.key) ?? 0 }));
  }

  async getActive(key: string): Promise<any> {
    const row = await this.categories.findOne({ key, isActive: true }).lean();
    if (!row) throw new BadRequestException("Please choose a valid support category.");
    return row;
  }

  /** Any category, active or not; null when it no longer exists. */
  find(key: string): Promise<any> {
    return this.categories.findOne({ key }).lean();
  }

  /** Category keys a (non-support) handler role works. */
  async handledBy(role: string): Promise<string[]> {
    const rows = await this.categories.find({ handlerRoles: role }).select("key").lean();
    return rows.map((row: any) => row.key);
  }

  async create(actor: AuthenticatedUser, dto: CreateSupportCategoryDto): Promise<any> {
    this.assertLists(dto);
    const key = dto.key.trim().toLowerCase();
    if (await this.categories.exists({ key }))
      throw new ConflictException(`A category with the key "${key}" already exists.`);
    return this.categories.create({
      ...dto,
      key,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateSupportCategoryDto): Promise<any> {
    this.assertLists(dto);
    const row = await this.categories.findById(id);
    if (!row) throw new NotFoundException("Category not found");
    // The key is referenced by tickets, so it never changes; everything else may.
    Object.assign(row, dto, { updatedBy: actor.id });
    await row.save();
    return row.toObject();
  }

  private assertLists(dto: { entityTypes?: string[]; handlerRoles?: string[] }): void {
    const badType = dto.entityTypes?.find((t) => !LINKABLE_ENTITY_TYPES.includes(t));
    if (badType) throw new BadRequestException(`Unknown linked record type "${badType}".`);
    const badRole = dto.handlerRoles?.find(
      (r) => !(SUPPORT_HANDLER_ROLES as readonly string[]).includes(r),
    );
    if (badRole) throw new BadRequestException(`Role "${badRole}" cannot handle support tickets.`);
  }
}
