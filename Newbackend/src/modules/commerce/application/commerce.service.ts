import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { escapeRegex } from "../../../common/utils/escape-regex";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import {
  COMMERCE_REPOSITORY,
  type CommerceRepository,
} from "../domain/commerce.repository";
import type {
  ServiceBookingDto,
  ServiceProviderDto,
  UpdateServiceProviderDto,
  WaitlistDto,
} from "../presentation/dtos/commerce.dto";

@Injectable()
export class CommerceService {
  constructor(
    @Inject(COMMERCE_REPOSITORY)
    private readonly repository: CommerceRepository,
  ) {}
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
