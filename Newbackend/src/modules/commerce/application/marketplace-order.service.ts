import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type {
  AddressDto,
  ConfirmMarketplacePaymentDto,
  CreateMarketplaceOrderDto,
  MarketplaceOrderQueryDto,
} from "../presentation/dtos/marketplace-order.dto";

const GST_PERCENT = 5;
const SHIPPING_FEE = 60;
const FREE_SHIPPING_ABOVE = 999;

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const ORDER_OVERSIGHT_ROLES = [
  "super_admin",
  "national_admin",
  "marketplace_manager",
];

@Injectable()
export class MarketplaceOrderService {
  constructor(
    @InjectModel("MarketplaceProduct") private readonly products: Model<any>,
    @InjectModel("MarketplaceOrderRecord") private readonly orders: Model<any>,
    @InjectModel("MarketplaceAddress") private readonly addresses: Model<any>,
    @InjectModel("MarketplacePayment") private readonly payments: Model<any>,
    private readonly config: ConfigService,
  ) {}

  async listAddresses(user: AuthenticatedUser): Promise<any[]> {
    return this.addresses
      .find({ customerId: user.id, isDeleted: false })
      .sort({ isDefault: -1, updatedAt: -1 })
      .lean();
  }

  async createAddress(
    user: AuthenticatedUser,
    dto: AddressDto,
  ): Promise<any> {
    const existing = await this.addresses.countDocuments({
      customerId: user.id,
      isDeleted: false,
    });
    if (existing >= 20)
      throw new BadRequestException("Address book is full (20 maximum)");
    const isDefault = dto.isDefault === true || existing === 0;
    if (isDefault) await this.clearDefault(user.id);
    return this.addresses.create({
      ...dto,
      customerId: user.id,
      isDefault,
      isDeleted: false,
    });
  }

  async updateAddress(
    user: AuthenticatedUser,
    id: string,
    dto: AddressDto,
  ): Promise<any> {
    if (dto.isDefault === true) await this.clearDefault(user.id);
    const address = await this.addresses.findOneAndUpdate(
      { _id: id, customerId: user.id, isDeleted: false },
      { $set: { ...dto } },
      { new: true },
    );
    if (!address) throw new NotFoundException("Address not found");
    return address;
  }

  async deleteAddress(user: AuthenticatedUser, id: string): Promise<any> {
    const address = await this.addresses.findOneAndUpdate(
      { _id: id, customerId: user.id, isDeleted: false },
      { $set: { isDeleted: true, isDefault: false } },
      { new: true },
    );
    if (!address) throw new NotFoundException("Address not found");
    const remaining = await this.addresses.findOne({
      customerId: user.id,
      isDeleted: false,
    });
    if (remaining && !(await this.addresses.exists({
      customerId: user.id,
      isDeleted: false,
      isDefault: true,
    })))
      await this.addresses.updateOne(
        { _id: remaining._id },
        { $set: { isDefault: true } },
      );
    return { success: true };
  }

  private clearDefault(customerId: string): Promise<any> {
    return this.addresses.updateMany(
      { customerId, isDefault: true },
      { $set: { isDefault: false } },
    );
  }

  async quote(items: { productId: string; quantity: number }[]): Promise<any> {
    const ids = [...new Set(items.map((item) => item.productId))];
    const rows = await this.products
      .find({ _id: { $in: ids }, status: "active" })
      .lean();
    const byId = new Map(rows.map((row: any) => [String(row._id), row]));

    const lines = items.map((item) => {
      const product = byId.get(item.productId);
      if (!product)
        throw new BadRequestException(
          "One of the items is no longer available",
        );
      const stock = Number(product.stock ?? 0);
      if (product.stock !== undefined && stock < item.quantity)
        throw new BadRequestException(
          `${product.name} has only ${stock} left in stock`,
        );
      const unitPrice = round2(
        Number(product.salePrice ?? product.price ?? 0),
      );
      if (unitPrice <= 0)
        throw new BadRequestException(`${product.name} is not purchasable`);
      return {
        productId: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0] ?? "",
        unitPrice,
        quantity: item.quantity,
        lineTotal: round2(unitPrice * item.quantity),
      };
    });

    const itemsTotal = round2(
      lines.reduce((sum, line) => sum + line.lineTotal, 0),
    );
    const shippingFee = itemsTotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
    const gstAmount = round2((itemsTotal * GST_PERCENT) / 100);
    return {
      items: lines,
      pricing: {
        itemsTotal,
        shippingFee,
        gstAmount,
        gstPercent: GST_PERCENT,
        totalAmount: round2(itemsTotal + shippingFee + gstAmount),
        amountPaid: 0,
        currency: "INR",
      },
    };
  }

  private async resolveAddress(
    user: AuthenticatedUser,
    dto: CreateMarketplaceOrderDto,
  ): Promise<{ snapshot: Record<string, any>; addressId: string | null }> {
    if (dto.addressId) {
      const saved = await this.addresses.findOne({
        _id: dto.addressId,
        customerId: user.id,
        isDeleted: false,
      });
      if (!saved) throw new NotFoundException("Delivery address not found");
      return { snapshot: this.snapshot(saved), addressId: String(saved._id) };
    }
    if (!dto.address)
      throw new BadRequestException("A delivery address is required");
    if (dto.saveAddress) {
      const created = await this.createAddress(user, dto.address);
      return {
        snapshot: this.snapshot(created),
        addressId: String(created._id),
      };
    }
    return { snapshot: this.snapshot(dto.address), addressId: null };
  }

  private snapshot(source: any): Record<string, any> {
    return {
      fullName: source.fullName,
      phone: source.phone,
      line1: source.line1,
      line2: source.line2 ?? "",
      landmark: source.landmark ?? "",
      city: source.city,
      state: source.state,
      pincode: source.pincode,
      country: source.country ?? "India",
    };
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateMarketplaceOrderDto,
  ): Promise<any> {
    const priced = await this.quote(dto.items);
    const { snapshot, addressId } = await this.resolveAddress(user, dto);
    const order = await this.orders.create({
      orderNumber: `TVN-${Date.now().toString(36).toUpperCase()}-${randomUUID()
        .slice(0, 4)
        .toUpperCase()}`,
      customerId: user.id,
      items: priced.items,
      shippingAddress: snapshot,
      addressId,
      pricing: priced.pricing,
      paymentMode: dto.paymentMode ?? "online",
      orderStatus: "pending_payment",
      paymentStatus: "pending",
      notes: dto.notes ?? "",
    });
    return order;
  }

  private scopeFor(user: AuthenticatedUser): Record<string, any> {
    return ORDER_OVERSIGHT_ROLES.includes(user.role)
      ? {}
      : { customerId: user.id };
  }

  async list(
    user: AuthenticatedUser,
    query: MarketplaceOrderQueryDto,
  ): Promise<any> {
    const filter: Record<string, any> = {
      ...this.scopeFor(user),
      ...(query.status ? { orderStatus: query.status } : {}),
    };
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.orders
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .populate("customerId", "name email")
        .lean(),
      this.orders.countDocuments(filter),
    ]);
    return { data, total, page: query.page };
  }

  async get(user: AuthenticatedUser, id: string): Promise<any> {
    const order = await this.orders
      .findOne({ _id: id, ...this.scopeFor(user) })
      .populate("customerId", "name email")
      .lean();
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async cancel(
    user: AuthenticatedUser,
    id: string,
    reason: string,
  ): Promise<any> {
    const order = await this.orders.findOne({ _id: id, ...this.scopeFor(user) });
    if (!order) throw new NotFoundException("Order not found");
    if (["shipped", "delivered", "cancelled", "refunded"].includes(order.orderStatus))
      throw new BadRequestException(
        `An order that is ${order.orderStatus.replace(/_/g, " ")} cannot be cancelled`,
      );
    order.orderStatus = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason = reason || "Cancelled by customer";
    await order.save();
    return order;
  }

  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    status: string,
  ): Promise<any> {
    if (!ORDER_OVERSIGHT_ROLES.includes(user.role))
      throw new ForbiddenException("Not authorized to update orders");
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus !== "paid" && status !== "cancelled")
      throw new BadRequestException(
        "An unpaid order cannot move through fulfilment",
      );
    order.orderStatus = status;
    await order.save();
    return order;
  }

  async paymentOrder(user: AuthenticatedUser, id: string): Promise<any> {
    const order = await this.orders.findOne({ _id: id, customerId: user.id });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "paid")
      throw new BadRequestException("Order is already paid");
    if (order.orderStatus === "cancelled")
      throw new BadRequestException("Order was cancelled");

    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keyId || !keySecret)
      return { demo: true, data: { amount: order.pricing.totalAmount } };

    const gateway = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const gatewayOrder = await gateway.orders.create({
      amount: Math.round(order.pricing.totalAmount * 100),
      currency: "INR",
      receipt: order.orderNumber,
    });
    await this.payments.create({
      orderId: order._id,
      customerId: user.id,
      eventId: `created:${gatewayOrder.id}`,
      provider: "razorpay",
      gatewayOrderId: gatewayOrder.id,
      amount: order.pricing.totalAmount,
      status: "created",
    });
    order.gateway = { provider: "razorpay", orderId: gatewayOrder.id };
    await order.save();
    return {
      demo: false,
      data: {
        orderId: gatewayOrder.id,
        amount: gatewayOrder.amount,
        currency: gatewayOrder.currency,
        keyId,
      },
    };
  }

  private signatureValid(dto: ConfirmMarketplacePaymentDto): boolean {
    const keySecret = this.config.get<string>("razorpayKeySecret");
    if (!keySecret) return this.config.get<string>("nodeEnv") !== "production";
    if (
      !dto.razorpay_order_id ||
      !dto.razorpay_payment_id ||
      !dto.razorpay_signature
    )
      return false;
    const expected = Buffer.from(
      createHmac("sha256", keySecret)
        .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
        .digest("hex"),
    );
    const actual = Buffer.from(dto.razorpay_signature);
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }

  async confirmPayment(
    user: AuthenticatedUser,
    id: string,
    dto: ConfirmMarketplacePaymentDto,
  ): Promise<any> {
    const order = await this.orders.findOne({ _id: id, customerId: user.id });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "paid") return order;

    if (!this.signatureValid(dto)) {
      await this.payments.updateOne(
        { eventId: `failed:${dto.razorpay_payment_id || randomUUID()}` },
        {
          $setOnInsert: {
            orderId: order._id,
            customerId: user.id,
            provider: "razorpay",
            gatewayOrderId: dto.razorpay_order_id,
            gatewayPaymentId: dto.razorpay_payment_id,
            amount: order.pricing.totalAmount,
            status: "failed",
            rawStatus: "signature_mismatch",
          },
        },
        { upsert: true },
      );
      throw new BadRequestException("Payment verification failed");
    }

    const eventId = `captured:${dto.razorpay_payment_id}`;
    const already = await this.payments.exists({ eventId });
    if (!already)
      await this.payments.create({
        orderId: order._id,
        customerId: user.id,
        eventId,
        provider: "razorpay",
        gatewayOrderId: dto.razorpay_order_id,
        gatewayPaymentId: dto.razorpay_payment_id,
        amount: order.pricing.totalAmount,
        status: "captured",
      });

    order.paymentStatus = "paid";
    order.orderStatus = "confirmed";
    order.pricing.amountPaid = order.pricing.totalAmount;
    order.gateway = {
      provider: "razorpay",
      orderId: dto.razorpay_order_id,
      paymentId: dto.razorpay_payment_id,
    };
    await order.save();

    for (const line of order.items)
      await this.products.updateOne(
        { _id: line.productId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity } },
      );

    return order;
  }
}
