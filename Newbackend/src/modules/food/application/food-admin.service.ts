import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";

@Injectable()
export class FoodAdminService {
  private readonly logger = new Logger(FoodAdminService.name);

  constructor(
    @InjectModel("FoodProduct") private readonly productModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodOrder") private readonly orderModel: Model<any>,
    @InjectModel("FoodServiceZone") private readonly zoneModel: Model<any>,
    @InjectModel("FoodRefund") private readonly refundModel: Model<any>,
    @InjectModel("FoodReviewAndComplaint")
    private readonly reviewModel: Model<any>,
  ) {}

  /**
   * Approves a controlled catalogue product or dietary declaration.
   */
  async approveProduct(productId: string, adminUserId: string) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException("Product not found");

    product.approvedStatus = "approved";
    await product.save();

    this.logger.log(
      `Product "${product.canonicalName}" approved by admin ${adminUserId}`,
    );
    return product;
  }

  /**
   * Modifies outlet commission terms with effective date and audit note.
   */
  async updateOutletCommission(
    outletId: string,
    adminUserId: string,
    commissionRateBps: number,
    reason: string,
  ) {
    if (commissionRateBps < 500 || commissionRateBps > 3000) {
      throw new BadRequestException(
        "Commission rate basis points must be between 500 (5%) and 3000 (30%)",
      );
    }

    const outlet = await this.outletModel.findById(outletId);
    if (!outlet) throw new NotFoundException("Outlet not found");

    const previousBps = outlet.commissionRateBps;
    outlet.commissionRateBps = commissionRateBps;
    await outlet.save();

    this.logger.log(
      `Commission for outlet "${outlet.brandName}" updated from ${previousBps / 100}% to ${commissionRateBps / 100}% by admin ${adminUserId}. Reason: ${reason}`,
    );

    return {
      outletId: outlet._id,
      brandName: outlet.brandName,
      previousRateBps: previousBps,
      newRateBps: commissionRateBps,
      updatedBy: adminUserId,
      reason,
      updatedAt: new Date(),
    };
  }

  /**
   * Operations exception queue for Food Admin: timeouts, refunds, complaints.
   */
  async getExceptionQueue() {
    const [timedOutOrders, pendingRefunds, complaints] = await Promise.all([
      this.orderModel
        .find({
          orderStatus: { $in: ["VENDOR_TIMEOUT", "VENDOR_REJECTED"] },
        })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("outletId", "brandName contactPhone")
        .lean(),
      this.refundModel
        .find({ status: { $in: ["pending", "failed"] } })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("orderId")
        .lean(),
      this.reviewModel
        .find({ complaintStatus: { $in: ["open", "investigating"] } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return {
      vendorExceptions: timedOutOrders,
      pendingRefunds,
      openComplaints: complaints,
    };
  }
}
