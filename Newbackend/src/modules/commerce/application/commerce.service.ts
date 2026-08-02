import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Types } from "mongoose";
import { escapeRegex } from "../../../common/utils/escape-regex";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  COMMERCE_REPOSITORY,
  type CommerceRepository,
} from "../domain/commerce.repository";
import type {
  MarketplaceOrderDto,
  ProductDto,
  ServiceBookingDto,
  ServiceProviderDto,
  UpdateProductDto,
  UpdateServiceProviderDto,
  WaitlistDto,
} from "../presentation/dtos/commerce.dto";

@Injectable()
export class CommerceService {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly repository: CommerceRepository,
  ) {}
  async categories(): Promise<any> {
    const data = await this.repository.list(
      "categories",
      { status: "active" },
      { displayOrder: 1 },
      0,
      500,
    );
    return { success: true, count: data.length, data };
  }
  async category(slug: string): Promise<any> {
    const clauses: Record<string, unknown>[] = [{ slug }];
    if (Types.ObjectId.isValid(slug)) clauses.push({ _id: slug });

    const category = await this.repository.one("categories", {
      $or: clauses,
      status: "active",
    });
    if (!category)
      throw new NotFoundException("Marketplace category not found.");

    const categoryValues = [category._id, category.slug, category.name].filter(
      Boolean,
    );
    const [products, relatedCategories] = await Promise.all([
      this.repository.list(
        "products",
        {
          status: "active",
          $or: [
            { category: { $in: categoryValues } },
            { categoryId: category._id },
            { categorySlug: category.slug },
          ],
        },
        { isFeatured: -1, updatedAt: -1 },
        0,
        100,
      ),
      this.repository.list(
        "categories",
        { status: "active", _id: { $ne: category._id } },
        { displayOrder: 1 },
        0,
        4,
      ),
    ]);

    return {
      success: true,
      data: {
        category,
        products,
        trustedSellers: category.trustedSellers ?? [],
        reviews: category.reviews ?? [],
        faqs: category.faqs ?? [],
        relatedCategories,
      },
    };
  }
  async products(query: Record<string, string>): Promise<any> {
    const filter = this.filter(query, [
      "name",
      "description",
      "templeSource",
      "category",
    ]);
    if (!query.status) filter.status = "active";
    if (query.status === "all") delete filter.status;
    if (query.templeSource)
      filter.templeSource = {
        $regex: escapeRegex(query.templeSource),
        $options: "i",
      };
    if (query.featured === "true") filter.isFeatured = true;
    const { page, limit, skip } = this.pagination(query);
    const sort: Record<string, 1 | -1> =
      query.sortBy === "price_low"
        ? { price: 1 as const }
        : query.sortBy === "price_high"
          ? { price: -1 as const }
          : { isFeatured: -1 as const, updatedAt: -1 as const };
    const [data, total] = await Promise.all([
      this.repository.list("products", filter, sort, skip, limit),
      this.repository.count("products", filter),
    ]);
    return { success: true, page, count: data.length, total, data };
  }
  async product(idOrSlug: string): Promise<any> {
    const clauses: Record<string, unknown>[] = [{ slug: idOrSlug }];
    if (Types.ObjectId.isValid(idOrSlug)) clauses.push({ _id: idOrSlug });
    const data = await this.repository.one("products", { $or: clauses });
    if (!data) throw new NotFoundException("Spiritual product not found.");
    return { success: true, data };
  }
  async order(user: AuthenticatedUser, dto: MarketplaceOrderDto): Promise<any> {
    const data = await this.repository.create("orders", {
      ...dto,
      orderNumber: `TVN-ORD-${Date.now().toString().slice(-8)}`,
      customerId: user.id,
      paymentStatus: "pending",
      orderStatus: "processing",
    });
    return { success: true, message: "Order placed successfully!", data };
  }
  async createProduct(dto: ProductDto): Promise<any> {
    const data = await this.repository.create("products", {
      ...dto,
      slug: dto.slug || this.slug(dto.name),
      status: dto.status ?? "active",
    });
    return { success: true, data };
  }
  async updateProduct(id: string, dto: UpdateProductDto): Promise<any> {
    const data = await this.repository.update("products", id, {
      ...dto,
      ...(dto.name && !dto.slug ? { slug: this.slug(dto.name) } : {}),
    });
    if (!data) throw new NotFoundException("Product not found");
    return { success: true, data };
  }
  async deleteProduct(id: string): Promise<any> {
    if (!(await this.repository.remove("products", id)))
      throw new NotFoundException("Product not found");
    return { success: true, message: "Product deleted." };
  }
  async waitlist(dto: WaitlistDto): Promise<any> {
    const email = dto.email.toLowerCase();
    const existing = await this.repository.one("waitlist", { email });
    if (existing)
      return {
        success: true,
        message: "You are already on the VIP waitlist!",
        data: existing,
      };
    try {
      const data = await this.repository.create("waitlist", {
        email,
        role: dto.role ?? "buyer",
      });
      return {
        success: true,
        message: "Subscribed to VIP waitlist successfully!",
        data,
      };
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException("You are already on the VIP waitlist!");
      throw error;
    }
  }
  async providers(query: Record<string, string>): Promise<any> {
    const filter = this.filter(query, [
      "name",
      "description",
      "subcategory",
      "city",
      "tagline",
    ]);
    filter.status =
      query.status === "all" ? { $exists: true } : (query.status ?? "active");
    if (query.city)
      filter.city = { $regex: escapeRegex(query.city), $options: "i" };
    if (query.subcategory)
      filter.subcategory = {
        $regex: escapeRegex(query.subcategory),
        $options: "i",
      };
    if (query.pureVeg === "true") filter["specifications.pureVeg"] = true;
    if (query.govtVerified === "true")
      filter["specifications.govtVerified"] = true;
    const { page, limit, skip } = this.pagination(query);
    const sort: Record<string, 1 | -1> =
      query.sortBy === "price_low"
        ? { "pricing.amount": 1 as const }
        : { rating: -1 as const, createdAt: -1 as const };
    const [data, total] = await Promise.all([
      this.repository.list("providers", filter, sort, skip, limit),
      this.repository.count("providers", filter),
    ]);
    return { success: true, page, count: data.length, total, data };
  }
  async provider(id: string): Promise<any> {
    const data = await this.repository.one("providers", { _id: id });
    if (!data) throw new NotFoundException("Service provider not found.");
    return { success: true, data };
  }
  async bookService(
    user: AuthenticatedUser,
    dto: ServiceBookingDto,
  ): Promise<any> {
    const data = await this.repository.create("serviceBookings", {
      ...dto,
      customerId: user.id,
      bookingDate: dto.bookingDate ?? new Date(),
      bookingTime: dto.bookingTime ?? "10:00 AM",
      guestsCount: dto.guestsCount ?? 1,
      status: "confirmed",
      paymentStatus: "pending",
    });
    return { success: true, message: "Service booked successfully!", data };
  }
  async createProvider(dto: ServiceProviderDto): Promise<any> {
    return {
      success: true,
      data: await this.repository.create("providers", {
        ...dto,
        status: dto.status ?? "active",
      }),
    };
  }
  async updateProvider(
    id: string,
    dto: UpdateServiceProviderDto,
  ): Promise<any> {
    const data = await this.repository.update("providers", id, { ...dto });
    if (!data) throw new NotFoundException("Service provider not found");
    return { success: true, data };
  }
  async deleteProvider(id: string): Promise<any> {
    if (!(await this.repository.remove("providers", id)))
      throw new NotFoundException("Service provider not found");
    return { success: true, message: "Service provider deleted." };
  }
  private slug(value: string): string {
    return `${value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}-${Date.now().toString().slice(-4)}`;
  }
  private pagination(query: Record<string, string>): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit, skip: (page - 1) * limit };
  }
  private filter(
    query: Record<string, string>,
    searchFields: string[],
  ): Record<string, any> {
    const filter: Record<string, any> = {};
    if (query.category) filter.category = query.category;
    if (query.search) {
      const term = escapeRegex(query.search.slice(0, 100));
      filter.$or = searchFields.map((field) => ({
        [field]: { $regex: term, $options: "i" },
      }));
    }
    if (query.minPrice || query.maxPrice)
      filter.price = {
        ...(query.minPrice ? { $gte: Number(query.minPrice) } : {}),
        ...(query.maxPrice ? { $lte: Number(query.maxPrice) } : {}),
      };
    return filter;
  }
}
