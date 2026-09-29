import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { uniqueSlug } from "../../../common/slug/slug.util";
import { escapeRegex } from "../../../common/utils/escape-regex";
import {
  APPROVAL_TRANSITIONS,
  HIDDEN_STATUS,
  VENDOR_CATEGORY_SCOPE,
  MATERIAL_PRODUCT_FIELDS,
  VISIBLE_STATUS,
  assertTransition,
  type ApprovalStatus,
} from "../domain/marketplace.constants";
import { omit } from "../domain/omit";
import type { CreateProductDto, ProductQueryDto, UpdateProductDto } from "../presentation/marketplace.dto";
import { CategoryService } from "./category.service";
import { InventoryService } from "./inventory.service";
import { MarketplaceAuditService } from "./marketplace-audit.service";
import { VendorService } from "./vendor.service";

/** Fields never shown on public product responses. */
const PUBLIC_HIDDEN = "-inventory.reserved -rejectionReason -adminDisabledReason -approvedBy -metadata.internal";

@Injectable()
export class ProductService {
  constructor(
    @InjectModel("MpProduct") private readonly products: Model<any>,
    @InjectModel("MpVendor") private readonly vendors: Model<any>,
    @InjectModel("MpCategory") private readonly categoryModel: Model<any>,
    private readonly vendorService: VendorService,
    private readonly categories: CategoryService,
    private readonly inventory: InventoryService,
    private readonly audit: MarketplaceAuditService,
  ) {}

  /** Public visibility rule, written to the legacy `status` field. */
  isPublic(product: any, vendor: any): boolean {
    return (
      product.approvalStatus === "approved" &&
      product.listingStatus === "active" &&
      !product.adminDisabled &&
      !product.deletedAt &&
      vendor?.status === "active"
    );
  }

  private async syncVisibility(product: any, vendor?: any): Promise<void> {
    const v = vendor ?? (product.vendorId ? await this.vendors.findById(product.vendorId).lean() : null);
    product.status = this.isPublic(product, v) ? VISIBLE_STATUS : HIDDEN_STATUS;
  }

  // ------------------------------------------------------------- vendor
  async vendorCreate(user: AuthenticatedUser, dto: CreateProductDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    if (["suspended", "deactivated", "rejected"].includes(vendor.status)) {
      throw new ForbiddenException("Your store cannot create products in its current state");
    }
    const category = await this.categories.requireActive(dto.categoryId);
    if (dto.sku && (await this.products.exists({ vendorId: vendor._id, sku: dto.sku.toUpperCase() }))) {
      throw new ConflictException("You already have a product with this SKU");
    }
    this.assertPrices(dto.price, dto.salePrice);
    const slug = await uniqueSlug(dto.name, {
      exists: async (s) => Boolean(await this.products.exists({ slug: s })),
      fallback: "product",
    });
    const { stock, trackInventory, lowStockThreshold, ...rest } = dto;
    const product = new this.products({
      ...rest,
      sku: dto.sku?.toUpperCase(),
      vendorId: vendor._id,
      categoryId: category._id,
      category: category.slug, // legacy category filter compatibility
      slug,
      stock: stock ?? 0,
      inventory: { trackInventory: trackInventory ?? true, reserved: 0, sold: 0, lowStockThreshold: lowStockThreshold ?? 5 },
      listingStatus: "draft",
      approvalStatus: "not_submitted",
      status: HIDDEN_STATUS,
      vendor: { name: vendor.storeName, type: vendor.businessType, location: vendor.address?.city ?? "", isVerified: vendor.status === "active" },
    });
    await product.save();
    await this.audit.log(user, "product.created", "MpProduct", product._id, { vendorId: vendor._id });
    return product;
  }

  async vendorList(user: AuthenticatedUser, query: ProductQueryDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    const filter: Record<string, any> = { vendorId: vendor._id, deletedAt: null };
    if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
    if (query.listingStatus) filter.listingStatus = query.listingStatus;
    if (query.search) filter.name = { $regex: escapeRegex(query.search.slice(0, 80)), $options: "i" };
    return this.paginate(filter, query, { updatedAt: -1 });
  }

  async vendorGet(user: AuthenticatedUser, id: string): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    return this.ownProduct(vendor._id, id, true);
  }

  async vendorUpdate(user: AuthenticatedUser, id: string, dto: UpdateProductDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    if (["suspended", "deactivated"].includes(vendor.status)) {
      throw new ForbiddenException("Your store cannot edit products in its current state");
    }
    const product = await this.ownProduct(vendor._id, id);
    if (product.listingStatus === "archived") throw new BadRequestException("Archived products cannot be edited");

    if (dto.categoryId && dto.categoryId !== String(product.categoryId)) {
      const category = await this.categories.requireActive(dto.categoryId);
      product.category = category.slug;
    }
    if (dto.sku && dto.sku.toUpperCase() !== product.sku) {
      if (await this.products.exists({ vendorId: vendor._id, sku: dto.sku.toUpperCase(), _id: { $ne: product._id } })) {
        throw new ConflictException("You already have a product with this SKU");
      }
      dto.sku = dto.sku.toUpperCase();
    }
    this.assertPrices(dto.price ?? product.price, dto.salePrice ?? product.salePrice);

    const { stock, trackInventory, lowStockThreshold, ...rest } = dto;
    const material = MATERIAL_PRODUCT_FIELDS.some(
      (f) => (rest as any)[f] !== undefined && JSON.stringify((rest as any)[f]) !== JSON.stringify(product[f] instanceof Types.ObjectId ? String(product[f]) : product[f]),
    );
    Object.assign(product, rest);
    if (trackInventory !== undefined) product.inventory.trackInventory = trackInventory;
    if (lowStockThreshold !== undefined) product.inventory.lowStockThreshold = lowStockThreshold;
    if (stock !== undefined) {
      if (!Number.isInteger(stock) || stock < 0) throw new BadRequestException("Stock must be a whole number of 0 or more");
      product.stock = stock;
    }
    // Content changes to an approved or pending product need a fresh review.
    if (material && ["approved", "pending"].includes(product.approvalStatus)) {
      product.approvalStatus = "pending";
      product.submittedAt = new Date();
    }
    await this.syncVisibility(product, vendor);
    await product.save();
    await this.audit.log(user, "product.updated", "MpProduct", product._id, { fields: Object.keys(dto), resubmitted: material });
    return product;
  }

  async vendorSubmit(user: AuthenticatedUser, id: string): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    this.vendorService.assertCanSell(vendor);
    const product = await this.ownProduct(vendor._id, id);
    if (product.listingStatus === "archived") throw new BadRequestException("Archived products cannot be submitted");
    assertTransition(APPROVAL_TRANSITIONS, product.approvalStatus as ApprovalStatus, "pending", "Product");
    if (!product.images?.length) throw new BadRequestException("Add at least one product image before submitting");
    if (!product.description?.trim()) throw new BadRequestException("Add a description before submitting");
    product.approvalStatus = "pending";
    product.submittedAt = new Date();
    product.rejectionReason = undefined;
    if (product.listingStatus === "draft") product.listingStatus = "active"; // goes live once approved
    await this.syncVisibility(product, vendor);
    await product.save();
    await this.audit.log(user, "product.submitted", "MpProduct", product._id);
    return product;
  }

  /** Vendor on/off switch for an approved listing (no re-approval needed). */
  async vendorSetListing(user: AuthenticatedUser, id: string, listingStatus: "active" | "inactive" | "archived"): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    const product = await this.ownProduct(vendor._id, id);
    if (product.listingStatus === "archived") throw new BadRequestException("Archived products cannot be changed");
    if (listingStatus === "active" && product.adminDisabled) {
      throw new ForbiddenException("This product was disabled by Tirvona and cannot be re-enabled by the store");
    }
    product.listingStatus = listingStatus;
    await this.syncVisibility(product, vendor);
    await product.save();
    await this.audit.log(user, `product.${listingStatus === "archived" ? "archived" : "listing_changed"}`, "MpProduct", product._id, { listingStatus });
    return product;
  }

  async vendorSetStock(user: AuthenticatedUser, id: string, stock: number, lowStockThreshold?: number): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    await this.ownProduct(vendor._id, id);
    const extra = lowStockThreshold !== undefined ? { "inventory.lowStockThreshold": lowStockThreshold } : {};
    const product = await this.inventory.setAvailable({ _id: id, vendorId: vendor._id, deletedAt: null }, stock, extra);
    await this.audit.log(user, "product.stock_set", "MpProduct", id, { stock });
    return product;
  }

  async vendorLowStock(user: AuthenticatedUser): Promise<any[]> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    return this.products
      .find({
        vendorId: vendor._id,
        deletedAt: null,
        listingStatus: { $ne: "archived" },
        "inventory.trackInventory": { $ne: false },
        $expr: { $lte: ["$stock", { $ifNull: ["$inventory.lowStockThreshold", 5] }] },
      })
      .select("name sku stock inventory listingStatus approvalStatus")
      .lean();
  }

  // -------------------------------------------------------------- admin
  async adminList(query: ProductQueryDto): Promise<any> {
    const filter: Record<string, any> = { deletedAt: null };
    if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
    if (query.listingStatus) filter.listingStatus = query.listingStatus;
    if (query.vendorId && isValidObjectId(query.vendorId)) filter.vendorId = new Types.ObjectId(query.vendorId);
    if (query.categoryId && isValidObjectId(query.categoryId)) filter.categoryId = new Types.ObjectId(query.categoryId);
    if (query.search) filter.name = { $regex: escapeRegex(query.search.slice(0, 80)), $options: "i" };
    return this.paginate(filter, query, { submittedAt: -1, updatedAt: -1 }, true);
  }

  async adminGet(id: string): Promise<any> {
    const product = await this.products
      .findById(this.oid(id))
      .populate("vendorId", "storeName slug status userId")
      .populate("categoryId", "name slug")
      .lean();
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async adminReview(actor: AuthenticatedUser, id: string, decision: "approve" | "reject", reason?: string): Promise<any> {
    const product = await this.products.findById(this.oid(id));
    if (!product) throw new NotFoundException("Product not found");
    const to: ApprovalStatus = decision === "approve" ? "approved" : "rejected";
    assertTransition(APPROVAL_TRANSITIONS, product.approvalStatus as ApprovalStatus, to, "Product");
    if (decision === "reject" && !reason?.trim()) throw new BadRequestException("A rejection reason is required");
    product.approvalStatus = to;
    if (decision === "approve") {
      product.approvedAt = new Date();
      product.approvedBy = actor.id;
      product.rejectionReason = undefined;
      if (product.listingStatus === "draft") product.listingStatus = "active";
    } else {
      product.rejectionReason = reason;
    }
    await this.syncVisibility(product);
    await product.save();
    await this.audit.log(actor, `product.${decision === "approve" ? "approved" : "rejected"}`, "MpProduct", product._id, { reason });
    return product;
  }

  async adminSetDisabled(actor: AuthenticatedUser, id: string, disabled: boolean, reason?: string): Promise<any> {
    const product = await this.products.findById(this.oid(id));
    if (!product) throw new NotFoundException("Product not found");
    if (disabled && !reason?.trim()) throw new BadRequestException("A reason is required");
    product.adminDisabled = disabled;
    product.adminDisabledReason = disabled ? reason : undefined;
    await this.syncVisibility(product);
    await product.save();
    await this.audit.log(actor, disabled ? "product.deactivated" : "product.reactivated", "MpProduct", product._id, { reason });
    return product;
  }

  // ------------------------------------------------------------- public
  async publicList(query: ProductQueryDto): Promise<any> {
    const filter: Record<string, any> = {
      status: VISIBLE_STATUS,
      approvalStatus: "approved",
      listingStatus: "active",
      adminDisabled: { $ne: true },
      deletedAt: null,
    };
    if (query.categoryId && isValidObjectId(query.categoryId)) {
      filter.categoryId = { $in: await this.categoryWithDescendants(query.categoryId) };
    }
    if (query.vendorSlug) {
      const vendor = await this.vendors.findOne({ slug: query.vendorSlug.toLowerCase(), status: "active" }).select("_id").lean();
      filter.vendorId = vendor?._id ?? new Types.ObjectId();
    }
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 80));
      filter.$or = ["name", "shortDescription", "description", "templeSource"].map((f) => ({ [f]: { $regex: term, $options: "i" } }));
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }
    if (query.inStock) filter.$and = [{ $or: [{ "inventory.trackInventory": false }, { stock: { $gt: 0 } }] }];
    const sort: Record<string, 1 | -1> =
      query.sortBy === "price_low" ? { price: 1 } :
      query.sortBy === "price_high" ? { price: -1 } :
      query.sortBy === "newest" ? { createdAt: -1 } :
      query.sortBy === "rating" ? { rating: -1 } :
      { isFeatured: -1, updatedAt: -1 };
    const result = await this.paginate(filter, query, sort, false, PUBLIC_HIDDEN, "vendorId", "storeName slug logoUrl");
    result.data = result.data.map(publicShape);
    return result;
  }

  async publicGet(idOrSlug: string): Promise<any> {
    const clauses: Record<string, unknown>[] = [{ slug: idOrSlug }];
    if (isValidObjectId(idOrSlug)) clauses.push({ _id: idOrSlug });
    const product = await this.products
      .findOne({ $or: clauses, status: VISIBLE_STATUS, approvalStatus: "approved", listingStatus: "active", deletedAt: null })
      .select(PUBLIC_HIDDEN)
      .populate("vendorId", "storeName slug logoUrl address.city address.state")
      .populate("categoryId", "name slug parentId")
      .lean();
    if (!product) throw new NotFoundException("Product not found");
    return publicShape(product);
  }

  // ------------------------------------------------------------ helpers
  private async ownProduct(vendorId: unknown, id: string, lean = false): Promise<any> {
    const q = this.products.findOne({ _id: this.oid(id), vendorId, deletedAt: null });
    const product = lean ? await q.lean() : await q;
    // Same 404 whether it doesn't exist or belongs to another vendor.
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  private async categoryWithDescendants(rootId: string): Promise<Types.ObjectId[]> {
    const ids = [new Types.ObjectId(rootId)];
    let frontier = [...ids];
    for (let depth = 0; frontier.length && depth < 5; depth++) {
      const children = await this.categoryModel.find({ parentId: { $in: frontier }, scope: VENDOR_CATEGORY_SCOPE }).select("_id").lean();
      frontier = children.map((c: any) => c._id);
      ids.push(...frontier);
    }
    return ids;
  }

  private assertPrices(price?: number, salePrice?: number): void {
    if (price === undefined || !(price > 0)) throw new BadRequestException("Price must be greater than 0");
    if (salePrice !== undefined && salePrice !== null && (salePrice <= 0 || salePrice > price)) {
      throw new BadRequestException("Sale price must be greater than 0 and not above the list price");
    }
  }

  private async paginate(
    filter: Record<string, any>,
    query: { page?: number; limit?: number },
    sort: Record<string, 1 | -1>,
    populateVendor = false,
    select?: string,
    populatePath?: string,
    populateSelect?: string,
  ): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    let q = this.products.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
    if (select) q = q.select(select);
    if (populateVendor) q = q.populate("vendorId", "storeName slug status");
    if (populatePath) q = q.populate(populatePath, populateSelect);
    const [data, total] = await Promise.all([q.lean(), this.products.countDocuments(filter)]);
    return { data, total, page, limit };
  }

  private oid(value: string): string {
    if (!isValidObjectId(value)) throw new NotFoundException("Product not found");
    return value;
  }
}

/** Public product: selling price + stock flag, no internal counters. */
export function publicShape(p: any) {
  const tracked = p.inventory?.trackInventory !== false;
  const rest = omit(p, ["inventory"]);
  return {
    ...rest,
    sellingPrice: p.salePrice ?? p.price,
    inStock: !tracked || Number(p.stock ?? 0) > 0,
    stock: tracked ? Math.max(0, Number(p.stock ?? 0)) : null,
  };
}
