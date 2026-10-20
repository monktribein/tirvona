import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { canonicalPaymentStatus } from "../domain/food.constants";
import { FoodQuoteService } from "./food-quote.service";
import { FoodFinanceService } from "./food-finance.service";
import {
  FOOD_STATUS_EVENTS,
  FoodNotificationService,
} from "./food-notification.service";
import { randomBytes } from "crypto";

export interface CreateOrderDto {
  quoteId: string;
  idempotencyKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  stayBookingId?: string;
  stayRoomNumber?: string;
  customerId?: string;
  sessionId?: string;
}

@Injectable()
export class FoodOrderService {
  private readonly logger = new Logger(FoodOrderService.name);

  constructor(
    @InjectModel("FoodOrder") private readonly orderModel: Model<any>,
    @InjectModel("FoodOrderItem")
    private readonly orderItemModel: Model<any>,
    @InjectModel("FoodOrderEvent")
    private readonly orderEventModel: Model<any>,
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    @InjectModel("Booking") private readonly bookingModel: Model<any>,
    private readonly quoteService: FoodQuoteService,
    private readonly financeService: FoodFinanceService,
    @Optional() private readonly notifier?: FoodNotificationService,
  ) {}

  /** Refunds a paid order and tells the customer how it went. Refunds are idempotent per order. */
  private async refundWithNotice(order: any, reason: string, initiatedBy: string) {
    const refund = await this.financeService.initiateRefund(order, reason, initiatedBy);
    if (refund) await this.notifyRefund(order, refund.status);
    return refund;
  }

  /** Tells the customer how the refund really stands: only "refunded" once the gateway has finished. */
  private async notifyRefund(order: any, status: string) {
    await this.notifier?.notify(
      order,
      status === "failed" ? "refund_failed" : status === "refunded" ? "refunded" : "refund_initiated",
    );
  }

  /** Gives failed refunds another go (spaced out, a few times); the gateway is checked first so nothing is refunded twice. */
  async retryFailedRefunds(): Promise<number> {
    let handled = 0;
    for (const order of await this.financeService.refundsDueForRetry()) {
      try {
        await this.refundWithNotice(order, "Automatic retry of a failed refund", "system");
        handled += 1;
      } catch (error) {
        this.logger.error(`Refund retry for order ${order.orderNumber} failed: ${(error as Error).message}`);
      }
    }
    return handled;
  }

  /** Follows refunds the gateway had not finished, and frees refunds that were interrupted mid-flight. */
  async reconcileRefunds(): Promise<number> {
    let handled = await this.financeService.recoverInterruptedRefunds();
    for (const change of await this.financeService.reconcileProcessingRefunds()) {
      const order = await this.orderModel.findById(change.orderId);
      if (order) await this.notifyRefund(order, change.outcome);
      handled += 1;
    }
    return handled;
  }

  /**
   * Creates an order with strict idempotency and server-authoritative quote validation.
   */
  async createOrder(dto: CreateOrderDto) {
    if (!dto.idempotencyKey) {
      throw new BadRequestException("idempotencyKey is required for order creation");
    }
    if (!dto.customerPhone || !dto.customerPhone.trim()) {
      throw new BadRequestException("Valid customer phone number is required");
    }

    // 1. Idempotency Check: if order already created with this key, return it
    const existingOrder = await this.orderModel
      .findOne({ idempotencyKey: dto.idempotencyKey })
      .lean();
    if (existingOrder) {
      this.logger.log(
        `Returning existing order #${existingOrder.orderNumber} for idempotency key ${dto.idempotencyKey}`,
      );
      return existingOrder;
    }

    // 2. Validate unexpired quote
    const quote = await this.quoteService.validateQuote(dto.quoteId);

    // 3. Re-verify fulfilling outlet is active and not paused
    const outlet = await this.outletModel.findById(quote.outletId);
    if (!outlet || outlet.status !== "active" || outlet.isPaused) {
      throw new BadRequestException(
        "Fulfilling outlet is currently paused or inactive",
      );
    }

    // 4. Validate stay booking if stay-delivery requested
    let validatedBookingId = null;
    if (dto.stayBookingId || quote.stayBookingId) {
      const bId = dto.stayBookingId || quote.stayBookingId;
      try {
        const booking = await this.bookingModel.findById(bId);
        if (booking) {
          validatedBookingId = booking._id;
        }
      } catch {
        // Continue gracefully without breaking customer order
      }
    }

    // 5. Generate unique human-readable order number: TF-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = randomBytes(2).toString("hex").toUpperCase();
    const orderNumber = `TF-${dateStr}-${randomHex}`;

    // 6. Vendor acceptance SLA: 10 minutes from creation
    const vendorAcceptanceDeadline = new Date(Date.now() + 10 * 60 * 1000);

    const orderDoc = await this.orderModel.create({
      orderNumber,
      quoteId: quote.quoteId,
      customerId: dto.customerId || quote.customerId || null,
      sessionId: dto.sessionId || quote.sessionId || null,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail || "",
      outletId: outlet._id,
      bookingId: validatedBookingId,
      stayRoomNumber: dto.stayRoomNumber || quote.stayRoomNumber || "",
      fulfilmentType: quote.fulfilmentType,
      deliveryAddress: dto.deliveryAddress || quote.destinationAddress || "",
      deliveryInstructions: dto.deliveryInstructions || "",
      orderStatus: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
      subtotalPaise: quote.subtotalPaise,
      deliveryFeePaise: quote.deliveryFeePaise,
      packagingFeePaise: quote.packagingFeePaise,
      taxPaise: quote.taxPaise,
      discountPaise: quote.discountPaise,
      totalPaise: quote.totalPaise,
      vendorAcceptanceDeadline,
      idempotencyKey: dto.idempotencyKey,
    });

    // 7. Save line items
    for (const item of quote.items) {
      await this.orderItemModel.create({
        orderId: orderDoc._id,
        variantId: item.variantId || null,
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPricePaise: item.unitPricePaise,
        totalPricePaise: item.totalPricePaise,
        dietaryTags: item.dietaryTags,
        contents: item.contents,
        portion: item.portion,
        customerNotes: item.customerNotes,
      });
    }

    // 8. Record initial immutable audit event
    await this.recordOrderEvent(
      orderDoc._id,
      null,
      "PAYMENT_PENDING",
      "customer",
      dto.customerId || "guest",
      "Order created, awaiting payment confirmation",
      { quoteId: quote.quoteId, totalPaise: quote.totalPaise },
    );

    return this.getOrderWithItems(orderDoc._id);
  }

  /**
   * Retrieves an authorized order, enforcing strict tenant and user boundary permissions.
   */
  async getAuthorizedOrder(
    orderId: string,
    actor: {
      userId?: string;
      role?: string;
      sessionId?: string;
      outletId?: string;
    },
  ) {
    const order = await this.getOrderWithItems(orderId);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    // Admins and Finance can view all orders
    if (
      actor.role &&
      ["admin", "super_admin", "govt_admin", "food_admin", "finance", "support"].includes(
        actor.role,
      )
    ) {
      return order;
    }

    // Vendor: outlet access check
    if (
      actor.role === "vendor" ||
      actor.role === "ashram_owner" ||
      actor.role === "stay_admin"
    ) {
      // Check if this vendor owns the outlet
      const outlet = await this.outletModel.findById(order.outletId);
      if (!outlet) throw new ForbiddenException("Unauthorized outlet access");

      const vendor = await this.vendorModel.findOne({
        _id: outlet.vendorId,
        ownerUserId: actor.userId,
      });

      if (vendor || (actor.outletId && actor.outletId === order.outletId.toString())) {
        return order;
      }
    }

    // Customer: must match customer ID or guest session ID
    const isCustomer =
      (actor.userId &&
        order.customerId &&
        order.customerId.toString() === actor.userId) ||
      (actor.sessionId &&
        order.sessionId &&
        order.sessionId === actor.sessionId);

    if (isCustomer) {
      return order;
    }

    // Stay Owner: check if linked to their booking/property
    if (order.bookingId && actor.userId) {
      const booking = await this.bookingModel.findById(order.bookingId);
      if (
        booking &&
        booking.ashramId &&
        actor.role &&
        ["ashram_admin", "ashram_owner", "stay_admin", "stay_owner"].includes(
          actor.role,
        )
      ) {
        if (
          (actor as any).ashramId &&
          (actor as any).ashramId.toString() !== booking.ashramId.toString()
        ) {
          throw new ForbiddenException(
            "You are not authorized to view food orders for another stay property",
          );
        }
        return order;
      }
    }

    throw new ForbiddenException("You are not authorized to view this order");
  }

  /**
   * Vendor accepts order within configured SLA timer.
   */
  async vendorAcceptOrder(orderId: string, vendorUserId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    await this.verifyVendorOutletAccess(order.outletId, vendorUserId);

    if (order.orderStatus !== "PAID_AWAITING_VENDOR") {
      throw new BadRequestException(
        `Order cannot be accepted in current state: ${order.orderStatus}`,
      );
    }

    const fromStatus = order.orderStatus;
    order.orderStatus = "ACCEPTED";
    order.vendorAcceptedAt = new Date();
    await order.save();

    await this.recordOrderEvent(
      order._id,
      fromStatus,
      "ACCEPTED",
      "vendor",
      vendorUserId,
      "Order accepted by restaurant kitchen",
    );
    await this.notifier?.notify(order, "accepted");

    return this.getOrderWithItems(order._id);
  }

  /**
   * Vendor rejects order with mandatory rejection reason.
   * Enforces refund/support workflow rather than silent substitution!
   */
  async vendorRejectOrder(
    orderId: string,
    vendorUserId: string,
    rejectionReason: string,
  ) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new BadRequestException("Rejection reason is required");
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    await this.verifyVendorOutletAccess(order.outletId, vendorUserId);

    if (
      order.orderStatus !== "PAID_AWAITING_VENDOR" &&
      order.orderStatus !== "PAYMENT_PENDING"
    ) {
      throw new BadRequestException(
        `Order cannot be rejected in current state: ${order.orderStatus}`,
      );
    }

    const fromStatus = order.orderStatus;
    order.orderStatus = "VENDOR_REJECTED";
    order.rejectionReason = rejectionReason.trim();
    await order.save();

    await this.recordOrderEvent(
      order._id,
      fromStatus,
      "VENDOR_REJECTED",
      "vendor",
      vendorUserId,
      rejectionReason.trim(),
    );
    await this.notifier?.notify(order, "rejected");

    // Initiate automatic refund workflow for paid order
    if (order.paymentStatus === "PAID") {
      await this.refundWithNotice(
        order,
        `Vendor rejected: ${rejectionReason.trim()}`,
        vendorUserId,
      );
    }

    return this.getOrderWithItems(order._id);
  }

  /**
   * Updates preparation and fulfilment lifecycle by authorized vendor.
   * Enforces backend order state machine:
   * ACCEPTED -> PREPARING -> READY -> OUT_FOR_DELIVERY / PICKED_UP -> DELIVERED -> COMPLETED
   */
  async updateVendorOrderStatus(
    orderId: string,
    vendorUserId: string,
    newStatus: string,
  ) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    await this.verifyVendorOutletAccess(order.outletId, vendorUserId);

    const validTransitions: Record<string, string[]> = {
      ACCEPTED: ["PREPARING"],
      PREPARING: ["READY"],
      READY: ["OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED"],
      OUT_FOR_DELIVERY: ["DELIVERED"],
      PICKED_UP: ["COMPLETED"],
      DELIVERED: ["COMPLETED"],
    };

    const allowed = validTransitions[order.orderStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.orderStatus} to ${newStatus}`,
      );
    }

    const fromStatus = order.orderStatus;
    order.orderStatus = newStatus;

    if (newStatus === "PREPARING") order.preparedAt = new Date();
    if (newStatus === "READY") order.readyAt = new Date();
    if (newStatus === "OUT_FOR_DELIVERY") order.outForDeliveryAt = new Date();
    if (newStatus === "DELIVERED") order.deliveredAt = new Date();
    if (newStatus === "COMPLETED") order.completedAt = new Date();

    await order.save();

    await this.recordOrderEvent(
      order._id,
      fromStatus,
      newStatus,
      "vendor",
      vendorUserId,
      `Order status updated to ${newStatus}`,
    );
    const statusEvent = FOOD_STATUS_EVENTS[newStatus];
    if (statusEvent) await this.notifier?.notify(order, statusEvent);

    return this.getOrderWithItems(order._id);
  }

  /**
   * Customer-initiated cancellation request.
   */
  async cancelOrder(orderId: string, customerId: string, reason: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    if (
      order.customerId &&
      order.customerId.toString() !== customerId &&
      order.sessionId !== customerId
    ) {
      throw new ForbiddenException("Unauthorized to cancel this order");
    }

    // Only cancellable before kitchen accepts
    if (
      order.orderStatus !== "PAYMENT_PENDING" &&
      order.orderStatus !== "PAID_AWAITING_VENDOR"
    ) {
      throw new BadRequestException(
        "Order cannot be cancelled once accepted and preparing in kitchen",
      );
    }

    const fromStatus = order.orderStatus;
    order.orderStatus = "CANCELLED";
    order.cancelledAt = new Date();
    order.rejectionReason = reason || "Cancelled by customer";
    await order.save();

    await this.recordOrderEvent(
      order._id,
      fromStatus,
      "CANCELLED",
      "customer",
      customerId,
      reason || "Cancelled by customer",
    );
    await this.notifier?.notify(order, "cancelled");

    if (order.paymentStatus === "PAID") {
      await this.refundWithNotice(
        order,
        "Customer cancellation before vendor acceptance",
        customerId,
      );
    }

    return this.getOrderWithItems(order._id);
  }

  /**
   * Cancels and refunds paid orders the kitchen did not accept within the SLA.
   * Run every 30 seconds by FoodMaintenanceService. Each order is claimed with a
   * conditional update, so concurrent runs (or a kitchen accepting at the same
   * moment) can never process the same order twice. Orders that timed out but
   * whose refund never completed are retried; refunds are idempotent per order.
   * Returns how many orders were handled.
   */
  async checkVendorTimeouts() {
    const overdue = await this.orderModel.find({
      orderStatus: "PAID_AWAITING_VENDOR",
      vendorAcceptanceDeadline: { $lt: new Date() },
    });

    let handled = 0;
    for (const candidate of overdue) {
      try {
        const order = await this.orderModel.findOneAndUpdate(
          { _id: candidate._id, orderStatus: "PAID_AWAITING_VENDOR" },
          { $set: { orderStatus: "VENDOR_TIMEOUT" } },
          { new: true },
        );
        // Accepted, cancelled or taken by another instance a moment ago.
        if (!order) continue;

        await this.recordOrderEvent(
          order._id,
          "PAID_AWAITING_VENDOR",
          "VENDOR_TIMEOUT",
          "system",
          "system_scheduler",
          "Vendor failed to accept within the 10-minute SLA",
        );
        await this.notifier?.notify(order, "timeout");
        await this.refundWithNotice(
          order,
          "Vendor SLA timeout: kitchen did not respond",
          "system",
        );
        handled += 1;
      } catch (error) {
        this.logger.error(
          `Vendor timeout for order ${candidate.orderNumber} failed: ${(error as Error).message}`,
        );
      }
    }

    // A previous run flipped the order but its refund did not finish. The grace
    // period keeps this from racing a refund that is still in flight.
    const unrefunded = await this.orderModel.find({
      orderStatus: "VENDOR_TIMEOUT",
      paymentStatus: "PAID",
      updatedAt: { $lt: new Date(Date.now() - 2 * 60_000) },
    });
    for (const order of unrefunded) {
      try {
        await this.refundWithNotice(
          order,
          "Vendor SLA timeout: kitchen did not respond",
          "system",
        );
        handled += 1;
      } catch (error) {
        this.logger.error(
          `Refund retry for timed-out order ${order.orderNumber} failed: ${(error as Error).message}`,
        );
      }
    }

    return handled;
  }

  /**
   * Lists orders for a vendor's outlet(s)
   */
  async getVendorOrders(vendorUserId: string, status?: string) {
    const vendors = await this.vendorModel.find({ ownerUserId: vendorUserId });
    const vendorIds = vendors.map((v) => v._id);

    const outlets = await this.outletModel.find({ vendorId: { $in: vendorIds } });
    const outletIds = outlets.map((o) => o._id);

    const filter: any = { outletId: { $in: outletIds } };
    if (status && status !== "ALL") {
      filter.orderStatus = status;
    }

    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return Promise.all(orders.map((o) => this.getOrderWithItems(o._id)));
  }

  /**
   * Lists orders for customer history
   */
  async getCustomerOrders(customerId: string) {
    const orders = await this.orderModel
      .find({ customerId })
      .sort({ createdAt: -1 })
      .lean();

    return Promise.all(orders.map((o) => this.getOrderWithItems(o._id)));
  }

  /**
   * Operations exception queue for Food Admin
   */
  async getAdminOrders(filter: any = {}) {
    const orders = await this.orderModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return Promise.all(orders.map((o) => this.getOrderWithItems(o._id)));
  }

  private async verifyVendorOutletAccess(outletId: any, vendorUserId: string) {
    const outlet = await this.outletModel.findById(outletId);
    if (!outlet) throw new NotFoundException("Outlet not found");

    const vendor = await this.vendorModel.findOne({
      _id: outlet.vendorId,
      ownerUserId: vendorUserId,
    });

    if (!vendor) {
      throw new ForbiddenException(
        "You do not have permission to manage orders for this restaurant outlet",
      );
    }
  }

  private async getOrderWithItems(orderId: any) {
    const order = await this.orderModel
      .findById(orderId)
      .populate("outletId", "brandName address contactPhone lat lng rating")
      .lean();
    if (!order) return null;

    const items = await this.orderItemModel.find({ orderId: order._id }).lean();
    const events = await this.orderEventModel
      .find({ orderId: order._id })
      .sort({ createdAt: 1 })
      .lean();

    const refund: any = await this.financeService.latestRefund?.(order._id);
    return {
      ...order,
      // Refund progress is reported through orderStatus and `refund`, never through paymentStatus.
      paymentStatus: canonicalPaymentStatus(order.paymentStatus),
      refund: refund
        ? {
            status: refund.status,
            amountRupees: refund.amountPaise / 100,
            failureReason: refund.status === "failed" ? refund.failureReason : undefined,
            resolvedAt: refund.resolvedAt ?? null,
          }
        : null,
      subtotalRupees: order.subtotalPaise / 100,
      deliveryFeeRupees: order.deliveryFeePaise / 100,
      packagingFeeRupees: order.packagingFeePaise / 100,
      taxRupees: order.taxPaise / 100,
      totalRupees: order.totalPaise / 100,
      items: items.map((i) => ({
        ...i,
        unitPriceRupees: i.unitPricePaise / 100,
        totalPriceRupees: i.totalPricePaise / 100,
      })),
      events,
    };
  }

  private async recordOrderEvent(
    orderId: any,
    fromStatus: string | null,
    toStatus: string,
    actorType: "customer" | "vendor" | "admin" | "system",
    actorId: string,
    reason: string,
    metadata?: any,
  ) {
    return this.orderEventModel.create({
      orderId,
      fromStatus,
      toStatus,
      actorType,
      actorId,
      reason,
      metadata,
    });
  }
}
