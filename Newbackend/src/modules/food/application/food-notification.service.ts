import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";

export type FoodNotifyEvent =
  | "paid"
  | "accepted"
  | "rejected"
  | "timeout"
  | "cancelled"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "picked_up"
  | "delivered"
  | "refunded"
  | "refund_initiated"
  | "refund_failed";

/** Order status changes that tell the customer something. COMPLETED is bookkeeping only. */
export const FOOD_STATUS_EVENTS: Record<string, FoodNotifyEvent> = {
  PREPARING: "preparing",
  READY: "ready",
  OUT_FOR_DELIVERY: "out_for_delivery",
  PICKED_UP: "picked_up",
  DELIVERED: "delivered",
};

interface Message {
  title: string;
  body: string;
}

/**
 * In-app inbox, live socket and push messages for food orders: the customer
 * when they signed in, and the restaurant owner. Delivery failures are logged
 * and never thrown, so a notification can never break the order it describes.
 *
 * WhatsApp is not used here: it needs Meta-approved templates, and none exist
 * for food yet. Guest checkouts (no account) therefore only get on-screen
 * order tracking.
 */
@Injectable()
export class FoodNotificationService {
  private readonly logger = new Logger(FoodNotificationService.name);

  constructor(
    @InjectModel("FoodOutlet") private readonly outletModel: Model<any>,
    @InjectModel("FoodVendor") private readonly vendorModel: Model<any>,
    private readonly inApp: InAppNotificationService,
  ) {}

  async notify(order: any, event: FoodNotifyEvent): Promise<void> {
    try {
      const outlet = order?.outletId
        ? await this.outletModel.findById(order.outletId._id ?? order.outletId)
        : null;
      const brand = outlet?.brandName || "the kitchen";
      const customerId = order?.customerId ? String(order.customerId) : "";

      const customerMessage = this.forCustomer(order, event, brand);
      if (customerId && customerMessage) {
        await this.inApp.notifyUsers([customerId], {
          ...customerMessage,
          deepLink: `/food/orders/${order._id}`,
          kind: `food.order.${event}`,
        });
      }

      const vendorMessage = this.forVendor(order, event);
      if (vendorMessage && outlet?.vendorId) {
        const vendor = await this.vendorModel.findById(outlet.vendorId);
        if (vendor?.ownerUserId) {
          await this.inApp.notifyUsers([String(vendor.ownerUserId)], {
            ...vendorMessage,
            deepLink: "/restaurant/dashboard",
            kind: `food.vendor.${event}`,
          });
        }
      }
    } catch (error) {
      this.logger.warn(
        `Food notification "${event}" for order ${order?.orderNumber} failed: ${(error as Error).message}`,
      );
    }
  }

  private forCustomer(order: any, event: FoodNotifyEvent, brand: string): Message | null {
    const title = `Order ${order.orderNumber}`;
    const pickup = order.fulfilmentType === "pickup";
    const amount = `₹${(Number(order.totalPaise ?? 0) / 100).toFixed(2)}`;
    switch (event) {
      case "paid":
        return { title, body: `Payment received. Waiting for ${brand} to accept your order.` };
      case "accepted":
        return { title, body: `${brand} accepted your order.` };
      case "preparing":
        return { title, body: "Your food is being prepared." };
      case "ready":
        return {
          title,
          body: pickup ? "Your order is ready for pickup." : "Your order is ready and will be on its way shortly.",
        };
      case "out_for_delivery":
        return { title, body: "Your order is out for delivery." };
      case "picked_up":
        return { title, body: "Thanks for picking up your order. Enjoy your meal!" };
      case "delivered":
        return { title, body: "Your order has been delivered. Enjoy your meal!" };
      case "rejected":
        return { title, body: `${brand} could not take your order.` };
      case "timeout":
        return { title, body: `${brand} did not respond in time, so your order was cancelled.` };
      case "cancelled":
        return { title, body: "Your order was cancelled." };
      case "refunded":
        return { title, body: `${amount} has been refunded to your original payment method.` };
      case "refund_initiated":
        return {
          title,
          body: `Your refund of ${amount} has been started. It can take 5 to 7 working days to reach your original payment method.`,
        };
      case "refund_failed":
        return {
          title,
          body: "We could not process your refund automatically. Our team is on it and will contact you.",
        };
    }
  }

  private forVendor(order: any, event: FoodNotifyEvent): Message | null {
    const title = `Order ${order.orderNumber}`;
    switch (event) {
      case "paid":
        return { title, body: "New paid order. Please accept it within 10 minutes." };
      case "cancelled":
        return { title, body: "The customer cancelled this order." };
      case "timeout":
        return { title, body: "This order was cancelled because it was not accepted in time." };
      default:
        return null;
    }
  }
}
