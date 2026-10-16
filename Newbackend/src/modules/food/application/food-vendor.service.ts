import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";

@Injectable()
export class FoodVendorService {
  constructor(
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodProductVariant")
    private readonly variantModel: Model<any>,
    @InjectModel("FoodOrder") private readonly orderModel: Model<any>,
  ) {}

  /**
   * Returns all outlets belonging to the authenticated vendor user.
   */
  async getMyOutlets(userId: string) {
    const vendors = await this.vendorModel.find({ ownerUserId: userId });
    const vendorIds = vendors.map((v) => v._id);

    return this.outletModel.find({ vendorId: { $in: vendorIds } }).lean();
  }

  /**
   * Allows an authorized vendor to pause/resume their outlet.
   * Preserves all order histories and menus intact.
   */
  async toggleOutletPause(
    outletId: string,
    userId: string,
    isPaused: boolean,
  ) {
    const outlet = await this.outletModel.findById(outletId);
    if (!outlet) throw new NotFoundException("Outlet not found");

    const vendor = await this.vendorModel.findOne({
      _id: outlet.vendorId,
      ownerUserId: userId,
    });
    if (!vendor) {
      throw new ForbiddenException("Unauthorized to modify this outlet");
    }

    outlet.isPaused = Boolean(isPaused);
    await outlet.save();

    return outlet;
  }

  /**
   * Allows an authorized vendor to pause/resume individual menu item availability.
   */
  async toggleVariantAvailability(
    variantId: string,
    userId: string,
    isAvailable: boolean,
  ) {
    const variant = await this.variantModel.findById(variantId);
    if (!variant) throw new NotFoundException("Menu item variant not found");

    const outlet = await this.outletModel.findById(variant.outletId);
    if (!outlet) throw new NotFoundException("Outlet not found");

    const vendor = await this.vendorModel.findOne({
      _id: outlet.vendorId,
      ownerUserId: userId,
    });
    if (!vendor) {
      throw new ForbiddenException("Unauthorized to modify this menu item");
    }

    variant.isAvailable = Boolean(isAvailable);
    await variant.save();

    return variant;
  }

  /**
   * Real, authorized operational metrics for Restaurant Owner Dashboard.
   * Does NOT invent fake metrics when no records exist.
   */
  async getVendorDashboardStats(userId: string) {
    const vendors = await this.vendorModel.find({ ownerUserId: userId });
    const vendorIds = vendors.map((v) => v._id);
    const outlets = await this.outletModel.find({
      vendorId: { $in: vendorIds },
    });
    const outletIds = outlets.map((o) => o._id);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      todayOrdersCount,
      pendingCount,
      preparingCount,
      readyCount,
      completedOrders,
      rejectedCount,
    ] = await Promise.all([
      this.orderModel.countDocuments({
        outletId: { $in: outletIds },
        createdAt: { $gte: startOfToday },
      }),
      this.orderModel.countDocuments({
        outletId: { $in: outletIds },
        orderStatus: "PAID_AWAITING_VENDOR",
      }),
      this.orderModel.countDocuments({
        outletId: { $in: outletIds },
        orderStatus: "PREPARING",
      }),
      this.orderModel.countDocuments({
        outletId: { $in: outletIds },
        orderStatus: { $in: ["READY", "OUT_FOR_DELIVERY", "PICKED_UP"] },
      }),
      this.orderModel.find({
        outletId: { $in: outletIds },
        orderStatus: "COMPLETED",
        paymentStatus: "PAID",
      }),
      this.orderModel.countDocuments({
        outletId: { $in: outletIds },
        orderStatus: { $in: ["VENDOR_REJECTED", "VENDOR_TIMEOUT"] },
      }),
    ]);

    let totalSalesPaise = 0;
    let estimatedSettlementPaise = 0;

    for (const ord of completedOrders) {
      totalSalesPaise += ord.subtotalPaise;
      // 12.5% default platform commission retained
      const commPaise = Math.round((ord.subtotalPaise * 1250) / 10000);
      estimatedSettlementPaise += ord.subtotalPaise - commPaise;
    }

    return {
      todayOrdersCount,
      pendingAcceptanceCount: pendingCount,
      preparingCount,
      readyOrOutCount: readyCount,
      completedCount: completedOrders.length,
      rejectedOrTimedOutCount: rejectedCount,
      totalSalesPaise,
      totalSalesRupees: totalSalesPaise / 100,
      estimatedSettlementPaise,
      estimatedSettlementRupees: estimatedSettlementPaise / 100,
      outlets: outlets.map((o) => ({
        id: o._id,
        brandName: o.brandName,
        status: o.status,
        isPaused: o.isPaused,
        commissionRateBps: o.commissionRateBps,
      })),
    };
  }
}
