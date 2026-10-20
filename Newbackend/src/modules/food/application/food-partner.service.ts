import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import {
  canonicalPhone,
  phoneCandidates,
} from "../../../common/phone/phone.util";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import {
  accountLast4,
  encodeAccountNumber,
  hasBankDetails,
} from "./food-bank";
import type {
  AdminOwnerLoginDto,
  AdminCreateFoodVendorDto,
  FoodMenuItemDto,
  FoodMenuItemUpdateDto,
  FoodOutletInputDto,
  FoodOutletUpdateDto,
  FoodVendorListQueryDto,
  FoodVendorStatusDto,
  RegisterFoodVendorDto,
  UpdateFoodVendorDto,
} from "../presentation/food-partner.dto";

/** Who is acting: an owner is limited to their own vendor, an admin is not. */
export interface FoodActor {
  id: string;
  isAdmin: boolean;
}

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Restaurant-partner side of Tirvona Food: signing up as a restaurant owner,
 * managing outlets, menu and inventory, and the Super Admin's view of the same
 * data (create the owner's login, approve, suspend, edit anything).
 */
@Injectable()
export class FoodPartnerService {
  private readonly logger = new Logger(FoodPartnerService.name);

  constructor(
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodProduct") private readonly productModel: Model<any>,
    @InjectModel("FoodProductVariant")
    private readonly variantModel: Model<any>,
    @InjectModel("FoodOrderItem") private readonly orderItemModel: Model<any>,
    @InjectModel("FoodServiceZone") private readonly zoneModel: Model<any>,
    @InjectModel("User") private readonly userModel: Model<any>,
    private readonly crypto: BankAccountCrypto,
  ) {}

  /** Never sends the stored account number out: only the last four digits and whether details are complete. */
  private publicVendor(vendor: any) {
    const plain = vendor?.toObject ? vendor.toObject() : { ...vendor };
    const { bankAccountNumber, settlementProfileId, ...rest } = plain;
    void settlementProfileId;
    return {
      ...rest,
      bankAccountLast4: accountLast4(bankAccountNumber),
      hasBankDetails: hasBankDetails(plain),
    };
  }

  // ------------------------------------------------------------ ownership
  private async vendorForUser(userId: string): Promise<any | null> {
    return this.vendorModel.findOne({ ownerUserId: userId });
  }

  private async requireVendor(actor: FoodActor, vendorId?: string) {
    if (actor.isAdmin) {
      if (!vendorId) throw new BadRequestException("vendorId is required");
      const vendor = await this.vendorModel.findById(vendorId);
      if (!vendor) throw new NotFoundException("Restaurant not found");
      return vendor;
    }
    const vendor = await this.vendorForUser(actor.id);
    if (!vendor)
      throw new NotFoundException("You have not registered a restaurant yet");
    if (vendorId && String(vendor._id) !== String(vendorId))
      throw new ForbiddenException("This is not your restaurant");
    return vendor;
  }

  private async requireOutlet(actor: FoodActor, outletId: string) {
    const outlet = await this.outletModel.findById(outletId);
    if (!outlet) throw new NotFoundException("Outlet not found");
    if (!actor.isAdmin) {
      const vendor = await this.vendorForUser(actor.id);
      if (!vendor || String(vendor._id) !== String(outlet.vendorId))
        throw new ForbiddenException("This is not your outlet");
    }
    return outlet;
  }

  private async requireVariant(actor: FoodActor, variantId: string) {
    const variant = await this.variantModel.findById(variantId);
    if (!variant) throw new NotFoundException("Menu item not found");
    await this.requireOutlet(actor, String(variant.outletId));
    return variant;
  }

  // -------------------------------------------------------------- profile
  async getMyProfile(userId: string) {
    const vendor = await this.vendorForUser(userId);
    if (!vendor) return null;
    return this.vendorDetail(vendor);
  }

  private async vendorDetail(vendor: any) {
    const outlets = await this.outletModel
      .find({ vendorId: vendor._id })
      .lean();
    return { vendor: this.publicVendor(vendor), outlets };
  }

  async register(user: FoodActor, dto: RegisterFoodVendorDto) {
    if (await this.vendorForUser(user.id))
      throw new ConflictException("You already have a restaurant profile");
    return this.createVendor(user.id, dto, "pending_verification");
  }

  private async createVendor(
    ownerUserId: string,
    dto: RegisterFoodVendorDto,
    status: "pending_verification" | "active",
  ) {
    const vendor = await this.vendorModel.create({
      businessName: dto.businessName,
      ownerUserId,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      fssaiReference: dto.fssaiReference,
      complianceStatus: status,
      status,
    });
    try {
      if (dto.outlet) await this.insertOutlet(vendor._id, dto.outlet);
    } catch (error) {
      await this.vendorModel.deleteOne({ _id: vendor._id });
      throw error;
    }
    return this.vendorDetail(vendor);
  }

  async updateVendor(
    actor: FoodActor,
    dto: UpdateFoodVendorDto,
    vendorId?: string,
  ) {
    const vendor = await this.requireVendor(actor, vendorId);
    const fields = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (!fields.length) throw new BadRequestException("No changes supplied");
    for (const [key, value] of fields)
      vendor.set(
        key,
        // The account number is stored encrypted.
        key === "bankAccountNumber"
          ? encodeAccountNumber(this.crypto, String(value))
          : value,
      );
    await vendor.save();
    return this.vendorDetail(vendor);
  }

  // -------------------------------------------------------------- outlets
  private async resolveZones(codes: string[] | undefined) {
    if (!codes) return undefined;
    const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
    if (!unique.length)
      throw new BadRequestException("Select at least one delivery zone");
    const zones = await this.zoneModel.find({ zoneCode: { $in: unique } }).lean();
    const known = new Set(zones.map((z: any) => z.zoneCode));
    const unknown = unique.filter((c) => !known.has(c));
    if (unknown.length)
      throw new BadRequestException(`Unknown delivery zone: ${unknown.join(", ")}`);
    return unique;
  }

  private async insertOutlet(vendorId: unknown, dto: FoodOutletInputDto) {
    const serviceZoneCodes = await this.resolveZones(dto.serviceZoneCodes);
    if (!serviceZoneCodes)
      throw new BadRequestException("Select at least one delivery zone");
    return this.outletModel.create({
      vendorId,
      brandName: dto.brandName,
      address: dto.address,
      serviceZoneCodes,
      fulfilmentModes: dto.fulfilmentModes?.length
        ? dto.fulfilmentModes
        : ["pickup", "vendor_delivery"],
      openTime: dto.openTime,
      closeTime: dto.closeTime,
      contactPhone: dto.contactPhone,
      minOrderPaise: dto.minOrderPaise,
      avgPrepMinutes: dto.avgPrepMinutes,
      capacityPerHour: dto.capacityPerHour,
      lat: dto.lat,
      lng: dto.lng,
      description: dto.description,
      imageUrl: dto.imageUrl,
      // A fresh kitchen starts closed so the owner can finish the menu first.
      isPaused: true,
      // Not a seeded demo rating: a new outlet has no reviews yet.
      rating: 0,
      ratingCount: 0,
    });
  }

  async addOutlet(actor: FoodActor, dto: FoodOutletInputDto, vendorId?: string) {
    const vendor = await this.requireVendor(actor, vendorId);
    return this.insertOutlet(vendor._id, dto);
  }

  async updateOutlet(actor: FoodActor, outletId: string, dto: FoodOutletUpdateDto) {
    const outlet = await this.requireOutlet(actor, outletId);
    const { serviceZoneCodes, ...rest } = dto;
    for (const [key, value] of Object.entries(rest))
      if (value !== undefined) outlet.set(key, value);
    const zones = await this.resolveZones(serviceZoneCodes);
    if (zones) outlet.set("serviceZoneCodes", zones);
    await outlet.save();
    return outlet;
  }

  async setOutletPaused(actor: FoodActor, outletId: string, isPaused: boolean) {
    const outlet = await this.requireOutlet(actor, outletId);
    outlet.isPaused = Boolean(isPaused);
    await outlet.save();
    return outlet;
  }

  // ----------------------------------------------------------------- menu
  async listMenu(actor: FoodActor, outletId: string) {
    await this.requireOutlet(actor, outletId);
    const variants = await this.variantModel
      .find({ outletId })
      .populate("productId")
      .lean();
    return variants.map((v: any) => this.menuRow(v));
  }

  private menuRow(v: any) {
    const rawImages = v.imageUrls?.length ? v.imageUrls : [v.imageUrl].filter(Boolean);
    const imageUrls = Array.isArray(rawImages) ? rawImages : [];
    return {
      id: String(v._id),
      outletId: String(v.outletId),
      sku: v.sku,
      label: v.label,
      family: v.productId?.family ?? "BOWL",
      description: v.productId?.description ?? "",
      contents: v.contents ?? "",
      dietaryTags: v.dietaryTags ?? [],
      pricePaise: v.pricePaise,
      prepMinutes: v.prepMinutes,
      portion: v.portion ?? "",
      dailyCapacity: v.dailyCapacity,
      cutOffTime: v.cutOffTime ?? "",
      imageUrl: v.imageUrl ?? (imageUrls[0] || ""),
      imageUrls,
      isAvailable: Boolean(v.isAvailable),
    };
  }

  async createMenuItem(actor: FoodActor, outletId: string, dto: FoodMenuItemDto) {
    const outlet = await this.requireOutlet(actor, outletId);
    const rawImages = dto.imageUrls ?? (dto.imageUrl ? [dto.imageUrl] : []);
    const cleanImages = rawImages.filter((img) => typeof img === "string" && img.trim().length > 0);
    if (cleanImages.length > 5) {
      throw new BadRequestException("A food product can have at most 5 images");
    }
    const primaryImage = cleanImages[0] ?? dto.imageUrl ?? "";

    // Dishes of an approved restaurant go live with it; a pending restaurant is
    // hidden from customers as a whole, so the dish needs no separate approval.
    const product = await this.productModel.create({
      family: dto.family,
      canonicalName: dto.label,
      description: dto.description,
      defaultImageUrl: primaryImage,
      imageUrls: cleanImages,
      approvedStatus: "approved",
      skuFamily: `PARTNER-${dto.family}`,
    });
    const sku = `${String(outlet._id).slice(-4)}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 5)}`.toUpperCase();
    const variant = await this.variantModel.create({
      outletId: outlet._id,
      productId: product._id,
      sku,
      label: dto.label,
      contents: dto.contents,
      dietaryTags: dto.dietaryTags?.length ? dto.dietaryTags : ["vegetarian"],
      pricePaise: dto.pricePaise,
      prepMinutes: dto.prepMinutes,
      portion: dto.portion,
      dailyCapacity: dto.dailyCapacity,
      cutOffTime: dto.cutOffTime,
      imageUrl: primaryImage,
      imageUrls: cleanImages,
      isAvailable: dto.isAvailable ?? true,
    });
    return this.menuRow({ ...variant.toObject(), productId: product.toObject() });
  }

  async updateMenuItem(actor: FoodActor, variantId: string, dto: FoodMenuItemUpdateDto) {
    const variant = await this.requireVariant(actor, variantId);
    const { family, description, imageUrls: newImageUrls, ...rest } = dto;
    for (const [key, value] of Object.entries(rest))
      if (value !== undefined) variant.set(key, value);

    if (newImageUrls !== undefined) {
      const cleanImages = newImageUrls.filter((img) => typeof img === "string" && img.trim().length > 0);
      if (cleanImages.length > 5) {
        throw new BadRequestException("A food product can have at most 5 images");
      }
      variant.set("imageUrls", cleanImages);
      // The cover always follows the gallery; removing every image clears it
      // instead of leaving a stale cover behind.
      variant.imageUrl = cleanImages[0] ?? "";
    }

    await variant.save();

    const product = await this.productModel.findById(variant.productId);
    if (product) {
      if (family) product.family = family;
      if (description !== undefined) product.description = description;
      if (dto.label) product.canonicalName = dto.label;
      if (newImageUrls !== undefined || variant.imageUrl) product.defaultImageUrl = variant.imageUrl ?? "";
      if (variant.imageUrls) product.imageUrls = variant.imageUrls;
      await product.save();
    }
    return this.menuRow({
      ...variant.toObject(),
      productId: product?.toObject?.() ?? product,
    });
  }

  async deleteMenuItem(actor: FoodActor, variantId: string) {
    const variant = await this.requireVariant(actor, variantId);
    // Past orders keep pointing at the dish; hide it instead of breaking them.
    if (await this.orderItemModel.exists({ variantId: variant._id })) {
      variant.isAvailable = false;
      await variant.save();
      return { deleted: false, hidden: true };
    }
    await this.variantModel.deleteOne({ _id: variant._id });
    await this.productModel.deleteOne({ _id: variant.productId });
    return { deleted: true, hidden: false };
  }

  // ---------------------------------------------------------------- admin
  async listVendors(query: FoodVendorListQueryDto) {
    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== "all") filter.status = query.status;
    const term = query.search?.trim();
    if (term) {
      const rx = { $regex: escapeRegex(term), $options: "i" };
      filter.$or = [
        { businessName: rx },
        { contactName: rx },
        { contactPhone: rx },
        { contactEmail: rx },
      ];
    }
    const vendors = await this.vendorModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const ids = vendors.map((v: any) => v._id);
    const outlets = await this.outletModel
      .find({ vendorId: { $in: ids } })
      .select("vendorId")
      .lean();
    const outletCount = new Map<string, number>();
    for (const o of outlets)
      outletCount.set(
        String(o.vendorId),
        (outletCount.get(String(o.vendorId)) ?? 0) + 1,
      );
    const ownerIds = vendors.map((v: any) => v.ownerUserId).filter(Boolean);
    const owners = ownerIds.length
      ? await this.userModel
          .find({ _id: { $in: ownerIds } })
          .select("name email phone")
          .lean()
      : [];
    const ownerById = new Map(
      owners.map((o: any) => [
        String(o._id),
        { _id: o._id, name: o.name, email: o.email, phone: o.phone },
      ]),
    );
    return vendors.map((v: any) => ({
      ...this.publicVendor(v),
      outletCount: outletCount.get(String(v._id)) ?? 0,
      owner: v.ownerUserId ? (ownerById.get(String(v.ownerUserId)) ?? null) : null,
    }));
  }

  async getVendorForAdmin(vendorId: string) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException("Restaurant not found");
    const owner = vendor.ownerUserId
      ? await this.userModel
          .findOne({ _id: vendor.ownerUserId })
          .select("name email phone status")
          .lean()
      : null;
    return {
      ...(await this.vendorDetail(vendor)),
      owner: owner
        ? { _id: owner._id, name: owner.name, email: owner.email, phone: owner.phone, status: owner.status }
        : null,
    };
  }

  /** Creates the owner's login and restaurant in one step. */
  async createVendorAccount(actor: FoodActor, dto: AdminCreateFoodVendorDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.userModel.exists({ email }))
      throw new ConflictException("Email address already registered");
    if (await this.userModel.exists({ phone: { $in: phoneCandidates(dto.phone) } }))
      throw new ConflictException("Phone number already registered");

    const user = await this.userModel.create({
      name: dto.ownerName,
      email,
      phone: canonicalPhone(dto.phone),
      passwordHash: await bcrypt.hash(dto.password, 12),
      // A normal account, like a marketplace seller: it keeps shopping access
      // and gets its restaurant console from the restaurant record.
      role: "customer",
      status: "active",
      isVerified: true,
    });
    try {
      const detail = await this.createVendor(
        String(user._id),
        dto,
        dto.approve ? "active" : "pending_verification",
      );
      this.logger.log(
        `Restaurant "${dto.businessName}" created by admin ${actor.id} for ${email} (${dto.approve ? "approved" : "pending"})`,
      );
      return detail;
    } catch (error) {
      await this.userModel.deleteOne({ _id: user._id });
      throw error;
    }
  }

  /** Creates a login for a restaurant that has none and attaches it as the owner. */
  async createOwnerLogin(actor: FoodActor, vendorId: string, dto: AdminOwnerLoginDto) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException("Restaurant not found");
    if (
      vendor.ownerUserId &&
      (await this.userModel.exists({ _id: vendor.ownerUserId }))
    )
      throw new ConflictException(
        "This restaurant already has an owner login. Set a new password instead.",
      );

    const email = dto.email.trim().toLowerCase();
    if (await this.userModel.exists({ email }))
      throw new ConflictException("Email address already registered");
    if (await this.userModel.exists({ phone: { $in: phoneCandidates(dto.phone) } }))
      throw new ConflictException("Phone number already registered");

    const user = await this.userModel.create({
      name: dto.ownerName,
      email,
      phone: canonicalPhone(dto.phone),
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: "customer",
      status: "active",
      isVerified: true,
    });
    vendor.ownerUserId = user._id;
    if (!vendor.contactEmail) vendor.contactEmail = email;
    await vendor.save();
    this.logger.log(`Owner login created for "${vendor.businessName}" by admin ${actor.id}`);
    return this.getVendorForAdmin(vendorId);
  }

  /** Sets a new password for the restaurant owner. The old one is never shown: it is stored hashed. */
  async setOwnerPassword(actor: FoodActor, vendorId: string, password: string) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException("Restaurant not found");
    if (
      !vendor.ownerUserId ||
      !(await this.userModel.exists({ _id: vendor.ownerUserId }))
    )
      throw new BadRequestException(
        "This restaurant has no owner login yet. Create one first.",
      );
    await this.userModel.updateOne(
      { _id: vendor.ownerUserId },
      { $set: { passwordHash: await bcrypt.hash(password, 12) } },
    );
    this.logger.log(`Owner password reset for "${vendor.businessName}" by admin ${actor.id}`);
    return { success: true };
  }

  async setVendorStatus(actor: FoodActor, vendorId: string, dto: FoodVendorStatusDto) {
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) throw new NotFoundException("Restaurant not found");
    if (["rejected", "suspended"].includes(dto.status) && !dto.reason?.trim())
      throw new BadRequestException("A reason is required to reject or suspend");
    vendor.status = dto.status;
    vendor.complianceStatus = dto.status;
    await vendor.save();
    this.logger.log(
      `Restaurant "${vendor.businessName}" set to ${dto.status} by admin ${actor.id}${dto.reason ? `: ${dto.reason}` : ""}`,
    );
    return this.vendorDetail(vendor);
  }
}
