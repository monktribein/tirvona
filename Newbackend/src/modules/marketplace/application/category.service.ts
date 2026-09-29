import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { VENDOR_CATEGORY_SCOPE } from "../domain/marketplace.constants";
import type { CreateCategoryDto, UpdateCategoryDto } from "../presentation/marketplace.dto";
import { MarketplaceAuditService } from "./marketplace-audit.service";

const MAX_DEPTH = 5;
const SCOPE = { scope: VENDOR_CATEGORY_SCOPE };

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel("MpCategory") private readonly categories: Model<any>,
    private readonly audit: MarketplaceAuditService,
  ) {}

  /** Active categories as a tree (public). */
  async publicTree(): Promise<any[]> {
    const rows = await this.categories.find({ ...SCOPE, status: "active" }).sort({ sortOrder: 1, displayOrder: 1, name: 1 }).lean();
    return buildTree(rows);
  }

  async adminList(): Promise<any[]> {
    const rows = await this.categories.find(SCOPE).sort({ sortOrder: 1, displayOrder: 1, name: 1 }).lean();
    return buildTree(rows);
  }

  /** Active category by id; used by product validation. */
  async requireActive(categoryId: string): Promise<any> {
    if (!isValidObjectId(categoryId)) throw new BadRequestException("Invalid category");
    const cat = await this.categories.findOne({ _id: categoryId, ...SCOPE, status: "active" }).lean();
    if (!cat) throw new BadRequestException("Category not found or inactive");
    return cat;
  }

  async create(actor: AuthenticatedUser, dto: CreateCategoryDto): Promise<any> {
    if (dto.parentId) await this.assertParent(dto.parentId, null);
    const slug = dto.slug
      ? dto.slug.toLowerCase()
      : await uniqueSlug(dto.name, { exists: async (s) => Boolean(await this.categories.exists({ slug: s })), fallback: "category" });
    if (dto.slug && (await this.categories.exists({ slug }))) throw new ConflictException("Slug already in use");
    const cat = await this.categories.create({
      ...dto,
      slug,
      parentId: dto.parentId || null,
      status: dto.status ?? "active",
      displayOrder: dto.sortOrder ?? 0,
      scope: VENDOR_CATEGORY_SCOPE,
    });
    await this.audit.log(actor, "category.created", "MpCategory", cat._id, { name: cat.name });
    return cat;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateCategoryDto): Promise<any> {
    const cat = await this.categories.findOne({ _id: this.oid(id), ...SCOPE });
    if (!cat) throw new NotFoundException("Category not found");
    if (dto.parentId !== undefined && dto.parentId !== null) await this.assertParent(dto.parentId, String(cat._id));
    if (dto.slug && dto.slug !== cat.slug && (await this.categories.exists({ slug: dto.slug.toLowerCase() }))) {
      throw new ConflictException("Slug already in use");
    }
    const before = cat.toObject();
    Object.assign(cat, dto);
    if (dto.parentId === null) cat.parentId = null;
    if (dto.sortOrder !== undefined) cat.displayOrder = dto.sortOrder;
    await cat.save();
    const changedCommission = before.commissionPercent !== cat.commissionPercent;
    await this.audit.log(
      actor,
      changedCommission ? "category.commission_changed" : "category.updated",
      "MpCategory",
      cat._id,
      { before: { commissionPercent: before.commissionPercent, status: before.status }, after: { commissionPercent: cat.commissionPercent, status: cat.status } },
    );
    return cat;
  }

  async reorder(actor: AuthenticatedUser, order: Array<{ id: string; sortOrder: number }>): Promise<any> {
    for (const item of order) {
      await this.categories.updateOne(
        { _id: this.oid(item.id), ...SCOPE },
        { $set: { sortOrder: item.sortOrder, displayOrder: item.sortOrder } },
      );
    }
    await this.audit.log(actor, "category.reordered", "MpCategory", null, { count: order.length });
    return this.adminList();
  }

  /** Parent must exist and must not create a cycle or exceed MAX_DEPTH. */
  private async assertParent(parentId: string, selfId: string | null): Promise<void> {
    let current: string | null = this.oid(parentId);
    for (let depth = 1; current; depth++) {
      if (selfId && current === selfId) throw new BadRequestException("A category cannot be its own ancestor");
      if (depth > MAX_DEPTH) throw new BadRequestException(`Categories can nest at most ${MAX_DEPTH} levels`);
      const parent: any = await this.categories.findOne({ _id: current, ...SCOPE }).select("parentId").lean();
      if (!parent) throw new BadRequestException("Parent category not found");
      current = parent.parentId ? String(parent.parentId) : null;
    }
  }

  private oid(value: string): string {
    if (!isValidObjectId(value)) throw new NotFoundException("Category not found");
    return value;
  }
}

export function buildTree(rows: any[]): any[] {
  const byId = new Map(rows.map((r) => [String(r._id), { ...r, children: [] as any[] }]));
  const roots: any[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(String(node.parentId)) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
