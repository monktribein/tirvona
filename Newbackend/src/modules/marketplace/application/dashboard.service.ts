import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { LedgerService } from "./ledger.service";
import { MarketplaceAuditService } from "./marketplace-audit.service";
import { PayoutService } from "./payout.service";
import { ProductService } from "./product.service";
import { VendorService } from "./vendor.service";

/** Vendor-order states that count as a paid sale (before any refund). */
const SOLD_STATES = ["confirmed", "processing", "shipped", "delivered", "return_requested", "returned", "refunded"];
const OPEN_STATES = ["confirmed", "processing"];
const PAYOUT_OPEN = ["requested", "under_review", "processing"];

/** Midnight today in India (the marketplace's business day), as a UTC Date. */
export function startOfIndianDay(now = new Date()): Date {
  const IST_OFFSET_MS = 330 * 60 * 1000;
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

/**
 * Read-only dashboard numbers for the seller console and the admin overview.
 * Everything is counted from the marketplace collections and the ledger, so
 * the dashboards never show a number the backend did not compute.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectModel("MpVendor") private readonly vendors: Model<any>,
    @InjectModel("MpProduct") private readonly products: Model<any>,
    @InjectModel("MpMasterOrder") private readonly masterOrders: Model<any>,
    @InjectModel("MpVendorOrder") private readonly vendorOrders: Model<any>,
    @InjectModel("MpPayout") private readonly payoutModel: Model<any>,
    private readonly vendorService: VendorService,
    private readonly productService: ProductService,
    private readonly payouts: PayoutService,
    private readonly ledger: LedgerService,
    private readonly audit: MarketplaceAuditService,
  ) {}

  async vendorDashboard(user: AuthenticatedUser, now = new Date()): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    const vid = vendor._id;
    const live = { vendorId: vid, deletedAt: null };
    const products = { ...live, listingStatus: { $ne: "archived" } };
    const tracked = { ...products, "inventory.trackInventory": { $ne: false } };

    const [
      todayOrders,
      pendingOrders,
      totalProducts,
      liveProducts,
      pendingApproval,
      rejectedProducts,
      outOfStock,
      lowStock,
      salesAgg,
      wallet,
      recentOrders,
      topProducts,
      commission,
    ] = await Promise.all([
      this.vendorOrders.countDocuments({ vendorId: vid, fulfillmentStatus: { $in: SOLD_STATES }, createdAt: { $gte: startOfIndianDay(now) } }),
      this.vendorOrders.countDocuments({ vendorId: vid, fulfillmentStatus: { $in: OPEN_STATES } }),
      this.products.countDocuments(products),
      this.products.countDocuments({ ...products, status: "active" }),
      this.products.countDocuments({ ...products, approvalStatus: "pending" }),
      this.products.countDocuments({ ...products, approvalStatus: "rejected" }),
      this.products.countDocuments({ ...tracked, stock: { $lte: 0 } }),
      this.productService.vendorLowStock(user),
      this.vendorOrders.aggregate([
        { $match: { vendorId: vid, fulfillmentStatus: { $in: SOLD_STATES } } },
        { $group: { _id: null, gross: { $sum: "$total" }, refunded: { $sum: "$refundAmount" }, orders: { $sum: 1 } } },
      ]),
      this.payouts.vendorSummary(vid),
      this.vendorOrders
        .find({ vendorId: vid, fulfillmentStatus: { $nin: ["pending_payment", "expired"] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("vendorOrderNumber items.name items.quantity total fulfillmentStatus createdAt")
        .lean(),
      this.products
        .find({ ...products, "inventory.sold": { $gt: 0 } })
        .sort({ "inventory.sold": -1 })
        .limit(5)
        .select("name slug images price salePrice stock inventory.sold")
        .lean(),
      this.ledger.commissionSummary(String(vid)),
    ]);
    const sales = salesAgg[0] ?? { gross: 0, refunded: 0, orders: 0 };

    return {
      store: { _id: vid, storeName: vendor.storeName, slug: vendor.slug, status: vendor.status, rejectionReason: vendor.rejectionReason, suspensionReason: vendor.suspensionReason },
      orders: { today: todayOrders, pending: pendingOrders, total: sales.orders },
      products: { total: totalProducts, live: liveProducts, pendingApproval, rejected: rejectedProducts, lowStock: lowStock.length, outOfStock },
      sales: { gross: round(sales.gross), refunded: round(sales.refunded) },
      wallet,
      commission,
      recentOrders,
      topProducts: topProducts.map((p: any) => ({ ...p, sold: p.inventory?.sold ?? 0, inventory: undefined })),
      lowStockItems: lowStock.slice(0, 10),
    };
  }

  async adminOverview(): Promise<any> {
    const [vendorGroups, productGroups, orderGroups, openVendorOrders, payoutAgg, commission, recentOrders, activity] = await Promise.all([
      this.vendors.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      this.products.aggregate([
        { $match: { vendorId: { $ne: null }, deletedAt: null, listingStatus: { $ne: "archived" } } },
        { $group: { _id: "$approvalStatus", count: { $sum: 1 } } },
      ]),
      this.masterOrders.aggregate([
        { $group: { _id: "$paymentStatus", count: { $sum: 1 }, paid: { $sum: "$pricing.amountPaid" }, refunded: { $sum: "$pricing.amountRefunded" } } },
      ]),
      this.vendorOrders.countDocuments({ fulfillmentStatus: { $in: OPEN_STATES } }),
      this.payoutModel.aggregate([
        { $match: { status: { $in: PAYOUT_OPEN } } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      ]),
      this.ledger.commissionSummary(),
      this.masterOrders
        .find({ paymentStatus: { $ne: "pending" } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("orderNumber pricing.totalAmount status paymentStatus vendorOrderIds createdAt")
        .lean(),
      this.audit.recent(10),
    ]);

    const count = (rows: any[], key: string) => rows.find((r) => r._id === key)?.count ?? 0;
    const sum = (rows: any[], field: string) => rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
    const paidRows = orderGroups.filter((r: any) => r._id !== "pending" && r._id !== "failed");

    return {
      vendors: {
        total: sum(vendorGroups, "count"),
        active: count(vendorGroups, "active"),
        pending: count(vendorGroups, "pending_verification") + count(vendorGroups, "under_review"),
        /** Stores created but not yet submitted by the seller. */
        draft: count(vendorGroups, "draft"),
        approved: count(vendorGroups, "approved"),
        suspended: count(vendorGroups, "suspended"),
        rejected: count(vendorGroups, "rejected"),
      },
      products: {
        total: sum(productGroups, "count"),
        pending: count(productGroups, "pending"),
        approved: count(productGroups, "approved"),
        rejected: count(productGroups, "rejected"),
      },
      orders: {
        paid: sum(paidRows, "count"),
        awaitingPayment: count(orderGroups, "pending"),
        awaitingFulfilment: openVendorOrders,
      },
      sales: { gross: round(sum(paidRows, "paid")), refunded: round(sum(paidRows, "refunded")) },
      commission,
      payouts: { pendingCount: payoutAgg[0]?.count ?? 0, pendingAmount: round(payoutAgg[0]?.amount ?? 0) },
      recentOrders,
      recentActivity: activity,
    };
  }
}

const round = (n: number) => Math.round(Number(n || 0) * 100) / 100;
