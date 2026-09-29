import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Types, type Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { CreateReviewDto } from "../presentation/marketplace.dto";
import { MarketplaceAuditService } from "./marketplace-audit.service";

/**
 * Product reviews. A review can only be written by the customer of a
 * delivered vendor order that contains the product, so every review is a
 * verified purchase. The product's legacy `rating` / `reviewCount` fields are
 * recalculated from published reviews.
 */
@Injectable()
export class ReviewService {
  constructor(
    @InjectModel("MpReview") private readonly reviews: Model<any>,
    @InjectModel("MpVendorOrder") private readonly vendorOrders: Model<any>,
    @InjectModel("MpProduct") private readonly products: Model<any>,
    private readonly audit: MarketplaceAuditService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateReviewDto): Promise<any> {
    if (!isValidObjectId(dto.vendorOrderId) || !isValidObjectId(dto.productId)) throw new NotFoundException("Order not found");
    const vo = await this.vendorOrders
      .findOne({
        _id: dto.vendorOrderId,
        customerId: user.id,
        fulfillmentStatus: { $in: ["delivered", "return_requested", "returned"] },
        "items.productId": new Types.ObjectId(dto.productId),
      })
      .lean();
    if (!vo) throw new BadRequestException("You can review a product only after it has been delivered to you");
    try {
      const review = await this.reviews.create({
        productId: dto.productId,
        vendorId: (vo as any).vendorId,
        customerId: user.id,
        vendorOrderId: dto.vendorOrderId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
        isVerifiedPurchase: true,
      });
      await this.refreshProductRating(dto.productId);
      return review;
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException("You have already reviewed this purchase");
      throw err;
    }
  }

  async listForProduct(productId: string, query: { page?: number; limit?: number }): Promise<any> {
    if (!isValidObjectId(productId)) throw new NotFoundException("Product not found");
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const filter = { productId, status: "published" };
    const [data, total] = await Promise.all([
      this.reviews
        .find(filter)
        .select("rating title comment isVerifiedPurchase createdAt customerId")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.reviews.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  /** Reviews for moderation (admin) or for one store's own console (vendorId set by the caller). */
  async list(query: { page?: number; limit?: number; status?: string; vendorId?: unknown }): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.vendorId) filter.vendorId = query.vendorId;
    const [data, total] = await Promise.all([
      this.reviews
        .find(filter)
        .select("rating title comment status isVerifiedPurchase createdAt productId vendorId customerId")
        .populate("productId", "name slug")
        .populate("vendorId", "storeName slug")
        .populate("customerId", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.reviews.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  }

  async adminSetStatus(actor: AuthenticatedUser, id: string, status: "published" | "hidden"): Promise<any> {
    if (!isValidObjectId(id)) throw new NotFoundException("Review not found");
    const review = await this.reviews.findByIdAndUpdate(id, { $set: { status } }, { new: true });
    if (!review) throw new NotFoundException("Review not found");
    await this.refreshProductRating(String(review.productId));
    await this.audit.log(actor, `review.${status}`, "MpReview", review._id);
    return review;
  }

  private async refreshProductRating(productId: string): Promise<void> {
    const [agg] = await this.reviews.aggregate([
      { $match: { productId: new Types.ObjectId(productId), status: "published" } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    await this.products.updateOne(
      { _id: productId },
      { $set: { rating: agg ? Math.round(agg.avg * 10) / 10 : 0, reviewCount: agg?.count ?? 0 } },
    );
  }
}
