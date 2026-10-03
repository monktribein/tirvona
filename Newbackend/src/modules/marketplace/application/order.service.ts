import {
  BadRequestException,
  HttpException,

  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isValidObjectId, Types, type Model } from "mongoose";
import Razorpay from "razorpay";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { TransactionService } from "../../../common/database/transaction.service";
import {
  FULFILLMENT_TRANSITIONS,

  VENDOR_FULFILLMENT_ACTIONS,
  VISIBLE_STATUS,
  assertTransition,
  type FulfillmentStatus,
} from "../domain/marketplace.constants";
import { omit } from "../domain/omit";
import { splitCart, toPaise, type CartLineInput } from "../domain/pricing";
import type {
  CheckoutDto,
  ConfirmPaymentDto,
  OrderQueryDto,
  UpdateFulfillmentDto,
} from "../presentation/marketplace.dto";
import { InventoryService, type StockLine } from "./inventory.service";
import { LedgerService } from "./ledger.service";
import { MarketplaceAuditService } from "./marketplace-audit.service";
import { MarketplaceSettingsService } from "./marketplace-settings.service";
import { VendorService } from "./vendor.service";
import { WalletService } from "../../wallet/application/wallet.service";

const CANCELLABLE: FulfillmentStatus[] = ["pending_payment", "confirmed", "processing"];

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly razorpay: Razorpay | null;

  constructor(
    @InjectModel("MpProduct") private readonly products: Model<any>,
    @InjectModel("MpVendor") private readonly vendors: Model<any>,
    @InjectModel("MpMasterOrder") private readonly masterOrders: Model<any>,
    @InjectModel("MpVendorOrder") private readonly vendorOrders: Model<any>,
    @InjectModel("MarketplaceAddress") private readonly addresses: Model<any>,
    private readonly inventory: InventoryService,
    private readonly ledger: LedgerService,
    private readonly settings: MarketplaceSettingsService,
    private readonly vendorService: VendorService,
    private readonly audit: MarketplaceAuditService,
    private readonly transactions: TransactionService,
    private readonly config: ConfigService,
    private readonly wallet: WalletService,
  ) {
    const keyId = this.config.get<string>("razorpayKeyId");
    const keySecret = this.config.get<string>("razorpayKeySecret");
    this.razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;
  }

  private demoPaymentsAllowed(): boolean {
    return !this.config.get<string>("razorpayKeySecret") && this.config.get<string>("nodeEnv") !== "production";
  }

  // ============================================================ pricing
  /** Server-side price of a cart, split per vendor. Never trusts client prices. */
  async quote(items: Array<{ productId: string; quantity: number }>) {
    if (!items?.length) throw new BadRequestException("Your cart is empty");
    const merged = new Map<string, number>();
    for (const i of items) {
      if (!isValidObjectId(i.productId)) throw new BadRequestException("Invalid product in cart");
      if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 50) {
        throw new BadRequestException("Quantity must be between 1 and 50");
      }
      merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
    }
    const ids = [...merged.keys()];
    const rows = await this.products
      .find({ _id: { $in: ids }, status: VISIBLE_STATUS, approvalStatus: "approved", listingStatus: "active", adminDisabled: { $ne: true }, deletedAt: null })
      .lean();
    const byId = new Map(rows.map((r: any) => [String(r._id), r]));
    const vendorIds = [...new Set(rows.map((r: any) => String(r.vendorId)).filter(Boolean))];
    const vendorRows = await this.vendors.find({ _id: { $in: vendorIds }, status: "active" }).lean();
    const vendorById = new Map(vendorRows.map((v: any) => [String(v._id), v]));
    const settings = await this.settings.get();

    const lines: CartLineInput[] = [];
    for (const [productId, quantity] of merged) {
      const p: any = byId.get(productId);
      const v: any = p && vendorById.get(String(p.vendorId));
      if (!p || !v) throw new BadRequestException("One of the items is no longer available");
      const tracked = p.inventory?.trackInventory !== false;
      if (tracked && Number(p.stock ?? 0) < quantity) {
        throw new BadRequestException(`${p.name} has only ${Math.max(0, Number(p.stock ?? 0))} left in stock`);
      }
      const unitPrice = Number(p.salePrice ?? p.price);
      if (!(unitPrice > 0)) throw new BadRequestException(`${p.name} is not purchasable`);
      lines.push({
        productId,
        vendorId: String(v._id),
        vendorStoreName: v.storeName,
        categoryId: p.categoryId ? String(p.categoryId) : null,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        image: p.images?.[0] ?? "",
        unitPrice,
        gstPercent: p.gstPercent,
        quantity,
        commissionPercent: await this.settings.commissionFor(v, p.categoryId),
      });
    }
    const split = splitCart(lines, settings);
    const tracked = new Map(rows.map((r: any) => [String(r._id), r.inventory?.trackInventory !== false]));
    return { ...split, tracked, vendorById, settings };
  }

  /** Public cart preview (no commission internals). */
  async publicQuote(items: Array<{ productId: string; quantity: number }>) {
    const q = await this.quote(items);
    return {
      pricing: { ...q.pricing, commissionAmount: undefined },
      vendorOrders: q.vendorOrders.map((vo) => ({
        vendorId: vo.vendorId,
        storeName: vo.vendorStoreName,
        subtotal: vo.subtotal,
        gstAmount: vo.gstAmount,
        shippingFee: vo.shippingFee,
        total: vo.total,
        items: vo.items.map((i) => omit(i, ["commissionAmount", "commissionPercent"])),
      })),
    };
  }

  // =========================================================== checkout
  async checkout(user: AuthenticatedUser, dto: CheckoutDto): Promise<any> {
    if (dto.idempotencyKey) {
      const existing = await this.masterOrders.findOne({ customerId: user.id, idempotencyKey: dto.idempotencyKey });
      if (existing) return this.withPayment(existing);
    }
    const shippingAddress = await this.resolveAddress(user, dto);
    const q = await this.quote(dto.items);
    for (const vo of q.vendorOrders) {
      if (String(q.vendorById.get(vo.vendorId)?.userId) === String(user.id)) {
        throw new BadRequestException("You cannot buy products from your own store");
      }
    }
    const stockLines: StockLine[] = q.vendorOrders.flatMap((vo) =>
      vo.items.map((i) => ({ productId: i.productId, quantity: i.quantity, name: i.name, inventoryTracked: q.tracked.get(i.productId) })),
    );

    // 1. Reserve stock atomically (all-or-nothing).
    await this.inventory.reserveAll(stockLines);

    let master: any;
    try {
      // 2. Master order + one vendor order per vendor, in one transaction.
      const orderNumber = `TVN-MP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
      const masterId = new Types.ObjectId();
      const expires = new Date(Date.now() + q.settings.reservationMinutes * 60000);
      master = await this.transactions.run(async (session) => {
        const vos = await this.vendorOrders.create(
          q.vendorOrders.map((vo, idx) => ({
            masterOrderId: masterId,
            vendorOrderNumber: `${orderNumber}-V${idx + 1}`,
            vendorId: vo.vendorId,
            customerId: user.id,
            vendorSnapshot: { storeName: vo.vendorStoreName, slug: q.vendorById.get(vo.vendorId)?.slug },
            items: vo.items.map((i) => ({ ...i, inventoryTracked: q.tracked.get(i.productId) })),
            subtotal: vo.subtotal,
            gstAmount: vo.gstAmount,
            shippingFee: vo.shippingFee,
            total: vo.total,
            commissionAmount: vo.commissionAmount,
            vendorEarning: vo.vendorEarning,
            fulfillmentStatus: "pending_payment",
            settlementStatus: "unsettled",
            statusHistory: [{ from: "none", to: "pending_payment", at: new Date(), actorId: user.id, actorRole: "customer" }],
          })),
          { session, ordered: true },
        );
        const [m] = await this.masterOrders.create(
          [
            {
              _id: masterId,
              orderNumber,
              customerId: user.id,
              vendorOrderIds: vos.map((v: any) => v._id),
              shippingAddress,
              pricing: { ...q.pricing, amountPaid: 0, amountRefunded: 0 },
              status: "pending_payment",
              paymentStatus: "pending",
              reservationExpiresAt: expires,
              idempotencyKey: dto.idempotencyKey,
              notes: dto.notes ?? "",
            },
          ],
          { session },
        );
        return m;
      });
    } catch (err) {
      await this.inventory.releaseAll(stockLines);
      throw err;
    }

    // 3. Wallet first: the buyer's Tirvona balance covers what it can.
    const { walletAmount, gatewayAmount } = await this.wallet.planSplit(
      user.id,
      master.pricing.totalAmount,
      dto.useWallet,
    );
    master.pricing.walletAmount = walletAmount;
    master.pricing.gatewayAmount = gatewayAmount;
    if (walletAmount > 0 && gatewayAmount <= 0) {
      master.gateway = { provider: "wallet", orderId: `wallet_mp_${master._id}`, demo: false };
      await master.save();
      try {
        await this.spendWalletShare(master);
      } catch (err) {
        await this.expireOrder(master, "Wallet payment could not be completed");
        throw err;
      }
      await this.markPaid(master, `wallet_${master._id}`, user);
      await this.audit.log(user, "order.created", "MpMasterOrder", master._id, { total: master.pricing.totalAmount, wallet: walletAmount });
      return { ...this.withPayment(await this.masterOrders.findById(master._id)), walletPaid: true };
    }

    // 4. Gateway order through Tirvona's existing Razorpay account.
    try {
      if (walletAmount > 0)
        await this.wallet.placeHold({
          userId: user.id,
          module: "marketplace",
          sourceId: master._id,
          amount: walletAmount,
          reference: master.orderNumber,
          expiresAt: master.reservationExpiresAt,
        });
      if (this.razorpay) {
        const gatewayOrder = await this.razorpay.orders.create({
          amount: toPaise(gatewayAmount),
          currency: "INR",
          receipt: master.orderNumber,
          notes: { module: "marketplace", masterOrderId: String(master._id) },
        });
        master.gateway = { provider: "razorpay", orderId: gatewayOrder.id, demo: false };
      } else if (this.demoPaymentsAllowed()) {
        master.gateway = { provider: "demo", orderId: `mock_mp_${master._id}`, demo: true };
      } else {
        throw new ServiceUnavailableException("Online payments are not configured");
      }
      await master.save();
    } catch (err: any) {
      await this.expireOrder(master, "Payment gateway unavailable at checkout");
      // Wallet refusals (balance changed, checkout already open) speak for themselves.
      if (err instanceof HttpException) throw err;
      this.logger.error(`Razorpay order creation failed: ${err?.message}`);
      throw new ServiceUnavailableException("Payment gateway is unavailable. Please try again shortly.");
    }
    await this.audit.log(user, "order.created", "MpMasterOrder", master._id, { total: master.pricing.totalAmount });
    return this.withPayment(master);
  }

  private withPayment(master: any) {
    const keyId = this.config.get<string>("razorpayKeyId") ?? "";
    const o = typeof master.toObject === "function" ? master.toObject() : master;
    const gatewayAmount = o.pricing.gatewayAmount ?? o.pricing.totalAmount;
    return {
      order: o,
      payment: {
        provider: o.gateway?.provider,
        razorpayOrderId: o.gateway?.orderId,
        amount: toPaise(gatewayAmount),
        currency: "INR",
        keyId,
        demo: Boolean(o.gateway?.demo),
      },
      wallet: {
        applied: Number(o.pricing.walletAmount ?? 0),
        gatewayAmount,
        total: o.pricing.totalAmount,
      },
    };
  }

  private async resolveAddress(user: AuthenticatedUser, dto: CheckoutDto): Promise<any> {
    if (dto.addressId) {
      if (!isValidObjectId(dto.addressId)) throw new NotFoundException("Delivery address not found");
      const saved: any = await this.addresses.findOne({ _id: dto.addressId, customerId: user.id, isDeleted: false }).lean();
      if (!saved) throw new NotFoundException("Delivery address not found");
      const { fullName, phone, line1, line2, landmark, city, state, pincode, country } = saved;
      return { fullName, phone, line1, line2, landmark, city, state, pincode, country: country ?? "India" };
    }
    if (!dto.address) throw new BadRequestException("A delivery address is required");
    return { ...dto.address, country: dto.address.country ?? "India" };
  }

  // ============================================================ payment
  /** Browser checkout callback. Signature + order binding are verified server-side. */
  async confirmPayment(user: AuthenticatedUser, masterOrderId: string, dto: ConfirmPaymentDto): Promise<any> {
    const master = await this.masterOrders.findOne({ _id: this.oid(masterOrderId), customerId: user.id });
    if (!master) throw new NotFoundException("Order not found");
    if (master.paymentStatus === "paid") return this.customerView(master);
    if (!master.gateway?.orderId || dto.razorpay_order_id !== master.gateway.orderId) {
      throw new BadRequestException("Payment does not belong to this order");
    }
    if (master.gateway.demo) {
      if (!this.demoPaymentsAllowed()) throw new BadRequestException("Demo payments are not accepted");
    } else {
      const secret = this.config.get<string>("razorpayKeySecret");
      if (!secret || !dto.razorpay_signature || !verifySignature(secret, dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)) {
        throw new BadRequestException("Payment verification failed");
      }
    }
    await this.markPaid(master, dto.razorpay_payment_id, user);
    return this.customerView(await this.masterOrders.findById(master._id));
  }

  /** Razorpay webhook entry (called by PaymentsWebhookService after it verified the webhook signature). */
  async confirmPaymentFromWebhook(gatewayOrderId: string, paymentId: string, captured?: { amountPaise?: number }): Promise<boolean> {
    const master = await this.masterOrders.findOne({ "gateway.orderId": gatewayOrderId });
    if (!master) return false;
    if (master.paymentStatus === "paid") return true;
    const gatewayAmount = master.pricing.gatewayAmount ?? master.pricing.totalAmount;
    if (captured?.amountPaise !== undefined && Math.round(captured.amountPaise) !== toPaise(gatewayAmount)) {
      master.reconciliationNote = `AMOUNT_MISMATCH captured=${captured.amountPaise}`;
      await master.save();
      this.logger.error(`Marketplace ${master.orderNumber}: amount mismatch (${captured.amountPaise} paise)`);
      return true; // handled: flagged for manual review, never auto-confirmed
    }
    await this.markPaid(master, paymentId, null);
    return true;
  }

  /**
   * Idempotent: the conditional pending->paid flip is the single gate, so a
   * browser callback and a webhook racing each other confirm exactly once.
   */
  private async markPaid(master: any, paymentId: string, actor: AuthenticatedUser | null): Promise<void> {
    const wasExpired = master.status === "expired";
    const flipped = await this.masterOrders.findOneAndUpdate(
      { _id: master._id, paymentStatus: "pending", status: { $in: ["pending_payment", "expired"] } },
      {
        $set: {
          paymentStatus: "paid",
          status: "confirmed",
          "gateway.paymentId": paymentId,
          "pricing.amountPaid": master.pricing.totalAmount,
        },
      },
      { new: true },
    );
    if (!flipped) return; // someone else already confirmed (or it was cancelled)

    // The wallet share is spent once the order is ours to confirm. If it can
    // no longer be taken, the confirmation is undone for manual review.
    try {
      await this.spendWalletShare(flipped);
    } catch (err) {
      await this.masterOrders.updateOne(
        { _id: master._id },
        {
          $set: {
            paymentStatus: "pending",
            status: wasExpired ? "expired" : "pending_payment",
            "pricing.amountPaid": 0,
            reconciliationNote: `WALLET_SHARE_UNAVAILABLE gateway=${paymentId}`,
          },
        },
      );
      this.logger.error(`Marketplace ${master.orderNumber}: wallet share could not be taken after payment ${paymentId}`);
      throw err;
    }

    const vos = await this.vendorOrders.find({ masterOrderId: master._id });
    const lines = vos.flatMap((vo: any) => this.stockLines(vo));

    if (wasExpired) {
      // Stock was released when the hold expired: take it again, or refund.
      try {
        await this.inventory.reserveAll(lines);
      } catch {
        this.logger.warn(`Paid after expiry and stock gone: refunding ${master.orderNumber}`);
        for (const vo of vos) {
          vo.fulfillmentStatus = "cancelled";
          vo.cancelReason = "Paid after the reservation expired and the stock was no longer available";
          await vo.save();
          await this.refundVendorOrder(vo, flipped, vo.cancelReason, null, { restock: false, alreadyPaidLedger: false });
        }
        await this.recomputeMaster(master._id);
        return;
      }
    }

    await this.inventory.commitAll(lines);
    for (const vo of vos) {
      this.pushHistory(vo, "confirmed", actor, "Payment verified");
      vo.fulfillmentStatus = "confirmed";
      vo.confirmedAt = new Date();
      vo.settlementStatus = "pending";
      await vo.save();
      await this.ledger.recordSale(vo);
    }
    await this.audit.log(actor, "order.paid", "MpMasterOrder", master._id, { paymentId, via: actor ? "client" : "webhook" });
  }

  // ======================================================== expiry (cron)
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleOrders(): Promise<number> {
    const stale = await this.masterOrders
      .find({ status: "pending_payment", paymentStatus: "pending", reservationExpiresAt: { $lt: new Date() } })
      .limit(200);
    let n = 0;
    for (const m of stale) if (await this.expireOrder(m, "Payment not completed in time")) n++;
    return n;
  }

  /** Spends the order's wallet share; idempotent per order. */
  private async spendWalletShare(master: any): Promise<void> {
    const walletAmount = Number(master.pricing?.walletAmount ?? 0);
    if (walletAmount <= 0) return;
    await this.wallet.spend({
      userId: String(master.customerId),
      module: "marketplace",
      sourceId: master._id,
      amount: walletAmount,
      reference: master.orderNumber,
      description: `Paid for marketplace order ${master.orderNumber}`,
      actorId: String(master.customerId),
    });
  }

  /** Releases an unpaid order's stock exactly once. */
  private async expireOrder(master: any, reason: string): Promise<boolean> {
    const flipped = await this.masterOrders.findOneAndUpdate(
      { _id: master._id, status: "pending_payment", paymentStatus: "pending" },
      { $set: { status: "expired", cancelReason: reason } },
      { new: true },
    );
    if (!flipped) return false;
    await this.wallet.releaseHold("marketplace", master._id);
    const vos = await this.vendorOrders.find({ masterOrderId: master._id });
    await this.inventory.releaseAll(vos.flatMap((vo: any) => this.stockLines(vo)));
    await this.vendorOrders.updateMany(
      { masterOrderId: master._id, fulfillmentStatus: "pending_payment" },
      { $set: { fulfillmentStatus: "expired" } },
    );
    return true;
  }

  // ============================================================ customer
  async listMine(user: AuthenticatedUser, query: OrderQueryDto): Promise<any> {
    const filter: Record<string, unknown> = { customerId: user.id };
    if (query.status) filter.status = query.status;
    const page = await this.paginate(this.masterOrders, filter, query);
    const ids = page.data.map((m: any) => m._id);
    const vos = await this.vendorOrders.find({ masterOrderId: { $in: ids } }).lean();
    page.data = page.data.map((m: any) => ({
      ...m,
      pricing: { ...m.pricing, commissionAmount: undefined },
      vendorOrders: vos.filter((v: any) => String(v.masterOrderId) === String(m._id)).map(customerSafeVendorOrder),
    }));
    return page;
  }

  async getMine(user: AuthenticatedUser, id: string): Promise<any> {
    const master = await this.masterOrders.findOne({ _id: this.oid(id), customerId: user.id });
    if (!master) throw new NotFoundException("Order not found");
    return this.customerView(master);
  }

  private async customerView(master: any): Promise<any> {
    const vos = await this.vendorOrders.find({ masterOrderId: master._id }).lean();
    const o = typeof master.toObject === "function" ? master.toObject() : master;
    return { ...o, pricing: { ...o.pricing, commissionAmount: undefined }, vendorOrders: vos.map(customerSafeVendorOrder) };
  }

  /** Cancels whatever part of the order has not shipped yet; paid parts are refunded. */
  async cancelMine(user: AuthenticatedUser, id: string, reason?: string): Promise<any> {
    const master = await this.masterOrders.findOne({ _id: this.oid(id), customerId: user.id });
    if (!master) throw new NotFoundException("Order not found");
    const why = reason?.trim() || "Cancelled by customer";
    if (master.paymentStatus === "pending") {
      if (!(await this.expireOrder(master, why))) throw new BadRequestException("This order can no longer be cancelled");
      await this.masterOrders.updateOne({ _id: master._id }, { $set: { status: "cancelled", cancelledAt: new Date() } });
      await this.vendorOrders.updateMany({ masterOrderId: master._id, fulfillmentStatus: "expired" }, { $set: { fulfillmentStatus: "cancelled", cancelReason: why } });
    } else {
      const vos = await this.vendorOrders.find({ masterOrderId: master._id, fulfillmentStatus: { $in: CANCELLABLE } });
      if (!vos.length) throw new BadRequestException("Nothing left to cancel: items have already shipped");
      for (const vo of vos) await this.cancelVendorOrder(vo, master, why, user);
    }
    await this.audit.log(user, "order.cancelled_by_customer", "MpMasterOrder", master._id, { reason: why });
    return this.customerView(await this.masterOrders.findById(master._id));
  }

  async requestReturn(user: AuthenticatedUser, vendorOrderId: string, reason: string): Promise<any> {
    if (!reason?.trim()) throw new BadRequestException("Tell us why you want to return this");
    const vo = await this.vendorOrders.findOne({ _id: this.oid(vendorOrderId), customerId: user.id });
    if (!vo) throw new NotFoundException("Order not found");
    const { returnWindowDays } = await this.settings.get();
    if (vo.fulfillmentStatus !== "delivered") throw new BadRequestException("Only delivered items can be returned");
    const deadline = new Date(new Date(vo.deliveredAt).getTime() + returnWindowDays * 86400000);
    if (!returnWindowDays || new Date() > deadline) throw new BadRequestException("The return window for this order has closed");
    this.transition(vo, "return_requested", user, reason);
    vo.returnReason = reason;
    await vo.save();
    await this.audit.log(user, "order.return_requested", "MpVendorOrder", vo._id, { reason });
    return vo;
  }

  // ============================================================== vendor
  async vendorList(user: AuthenticatedUser, query: OrderQueryDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    const filter: Record<string, unknown> = { vendorId: vendor._id, fulfillmentStatus: { $nin: ["pending_payment", "expired"] } };
    if (query.status) filter.fulfillmentStatus = query.status;
    return this.paginate(this.vendorOrders, filter, query, undefined, "-statusHistory.actorId");
  }

  async vendorGet(user: AuthenticatedUser, id: string): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    const vo = await this.vendorOrders
      .findOne({ _id: this.oid(id), vendorId: vendor._id, fulfillmentStatus: { $nin: ["pending_payment", "expired"] } })
      .populate("masterOrderId", "orderNumber shippingAddress createdAt paymentStatus")
      .lean();
    if (!vo) throw new NotFoundException("Order not found");
    return vo;
  }

  async vendorUpdateFulfillment(user: AuthenticatedUser, id: string, dto: UpdateFulfillmentDto): Promise<any> {
    const vendor = await this.vendorService.requireOwnVendor(user);
    if (vendor.status === "deactivated") throw new ForbiddenException("This store is deactivated");
    if (!VENDOR_FULFILLMENT_ACTIONS.includes(dto.status)) throw new ForbiddenException("Stores cannot set this status");
    const vo = await this.vendorOrders.findOne({ _id: this.oid(id), vendorId: vendor._id });
    if (!vo) throw new NotFoundException("Order not found");
    return this.applyFulfillment(vo, dto, user);
  }

  // =============================================================== admin
  async adminList(query: OrderQueryDto): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.customerId && isValidObjectId(query.customerId)) filter.customerId = new Types.ObjectId(query.customerId);
    if (query.vendorId && isValidObjectId(query.vendorId)) {
      const ids = await this.vendorOrders.distinct("masterOrderId", { vendorId: new Types.ObjectId(query.vendorId) });
      filter._id = { $in: ids };
    }
    return this.paginate(this.masterOrders, filter, query, { path: "customerId", select: "name email phone" });
  }

  async adminGet(id: string): Promise<any> {
    const master = await this.masterOrders.findById(this.oid(id)).populate("customerId", "name email phone").lean();
    if (!master) throw new NotFoundException("Order not found");
    const vendorOrders = await this.vendorOrders.find({ masterOrderId: master._id }).populate("vendorId", "storeName slug status").lean();
    return { ...master, vendorOrders };
  }

  async adminListVendorOrders(query: OrderQueryDto): Promise<any> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.fulfillmentStatus = query.status;
    if (query.vendorId && isValidObjectId(query.vendorId)) filter.vendorId = new Types.ObjectId(query.vendorId);
    return this.paginate(this.vendorOrders, filter, query, { path: "vendorId", select: "storeName slug" });
  }

  async adminUpdateFulfillment(actor: AuthenticatedUser, id: string, dto: UpdateFulfillmentDto): Promise<any> {
    const vo = await this.vendorOrders.findById(this.oid(id));
    if (!vo) throw new NotFoundException("Order not found");
    return this.applyFulfillment(vo, dto, actor);
  }

  /** Admin decision on a return: approve -> returned + refund; reject -> back to delivered. */
  async adminResolveReturn(actor: AuthenticatedUser, id: string, approve: boolean, note?: string): Promise<any> {
    const vo = await this.vendorOrders.findById(this.oid(id));
    if (!vo) throw new NotFoundException("Order not found");
    if (vo.fulfillmentStatus !== "return_requested") throw new BadRequestException("There is no open return on this order");
    const master = await this.masterOrders.findById(vo.masterOrderId);
    if (!approve) {
      this.transition(vo, "delivered", actor, note ?? "Return rejected");
      await vo.save();
      await this.audit.log(actor, "order.return_rejected", "MpVendorOrder", vo._id, { note });
      return vo;
    }
    this.transition(vo, "returned", actor, note ?? "Return approved");
    await vo.save();
    await this.refundVendorOrder(vo, master, note ?? `Return: ${vo.returnReason ?? ""}`, actor, { restock: true, alreadyPaidLedger: true });
    await this.audit.log(actor, "order.return_approved", "MpVendorOrder", vo._id, { note });
    return this.vendorOrders.findById(vo._id);
  }

  /** Retries a refund that failed at the gateway. */
  async adminRetryRefund(actor: AuthenticatedUser, id: string): Promise<any> {
    const vo = await this.vendorOrders.findById(this.oid(id));
    if (!vo) throw new NotFoundException("Order not found");
    if (!["cancelled", "returned"].includes(vo.fulfillmentStatus) || !vo.refundError) {
      throw new BadRequestException("This order has no failed refund to retry");
    }
    const master = await this.masterOrders.findById(vo.masterOrderId);
    await this.refundVendorOrder(vo, master, vo.cancelReason ?? vo.returnReason ?? "Refund retry", actor, { restock: false, alreadyPaidLedger: true });
    return this.vendorOrders.findById(vo._id);
  }

  // ============================================================ internals
  private async applyFulfillment(vo: any, dto: UpdateFulfillmentDto, actor: AuthenticatedUser): Promise<any> {
    if (dto.status === "cancelled") {
      if (!CANCELLABLE.includes(vo.fulfillmentStatus)) throw new BadRequestException("This order can no longer be cancelled");
      const master = await this.masterOrders.findById(vo.masterOrderId);
      await this.cancelVendorOrder(vo, master, dto.note?.trim() || "Cancelled by store", actor);
      return this.vendorOrders.findById(vo._id);
    }
    if (dto.status === "refunded" || dto.status === "returned") {
      throw new BadRequestException("Use the return / refund actions for this");
    }
    this.transition(vo, dto.status, actor, dto.note);
    if (dto.tracking) vo.tracking = { ...(vo.tracking ?? {}), ...dto.tracking };
    if (dto.status === "shipped") vo.shippedAt = new Date();
    if (dto.status === "delivered") {
      const { settlementHoldDays } = await this.settings.get();
      vo.deliveredAt = new Date();
      vo.settlementEligibleAt = new Date(Date.now() + settlementHoldDays * 86400000);
      vo.settlementStatus = settlementHoldDays > 0 ? "pending" : "available";
      await this.ledger.scheduleSettlement(vo._id, vo.settlementEligibleAt);
    }
    await vo.save();
    await this.recomputeMaster(vo.masterOrderId);
    await this.audit.log(actor, "order.fulfillment_changed", "MpVendorOrder", vo._id, { to: dto.status, tracking: dto.tracking });
    return vo;
  }

  private async cancelVendorOrder(vo: any, master: any, reason: string, actor: AuthenticatedUser | null): Promise<void> {
    const wasPaid = vo.fulfillmentStatus !== "pending_payment";
    this.transition(vo, "cancelled", actor, reason);
    vo.cancelledAt = new Date();
    vo.cancelReason = reason;
    await vo.save();
    if (wasPaid) {
      await this.refundVendorOrder(vo, master, reason, actor, { restock: true, alreadyPaidLedger: true });
    } else {
      await this.inventory.releaseAll(this.stockLines(vo));
      await this.recomputeMaster(vo.masterOrderId);
    }
  }

  /**
   * Refunds one vendor order to the buyer's Tirvona wallet, from where it can
   * pay for the next order or be transferred out on request. Only marks it
   * refunded once the wallet was credited; otherwise it stays
   * cancelled/returned with `refundError` set for an admin to retry.
   */
  private async refundVendorOrder(
    vo: any,
    master: any,
    reason: string,
    actor: AuthenticatedUser | null,
    opts: { restock: boolean; alreadyPaidLedger: boolean },
  ): Promise<void> {
    if (vo.refundId) return; // already refunded
    let refundId: string | undefined;
    try {
      const credit = await this.wallet.credit({
        userId: String(vo.customerId ?? master?.customerId),
        amount: vo.total,
        module: "marketplace",
        category: "refund",
        sourceId: vo._id,
        reference: vo.vendorOrderNumber,
        description: `Refund for marketplace order ${vo.vendorOrderNumber}`,
        idempotencyKey: `refund:marketplace:${String(vo._id)}`,
        actorId: actor?.id ?? null,
        actorRole: actor?.role,
      });
      refundId = `wallet_${String(credit?._id ?? vo._id)}`;
    } catch (err: any) {
      vo.refundError = String(err?.error?.description ?? err?.message ?? "Refund failed");
      await vo.save();
      this.logger.error(`Refund failed for ${vo.vendorOrderNumber}: ${vo.refundError}`);
      await this.audit.log(actor, "order.refund_failed", "MpVendorOrder", vo._id, { error: vo.refundError });
      await this.recomputeMaster(vo.masterOrderId);
      return;
    }

    vo.refundId = refundId;
    vo.refundAmount = vo.total;
    vo.refundError = undefined;
    this.transition(vo, "refunded", actor, reason);
    vo.settlementStatus = "reversed";
    await vo.save();

    await this.masterOrders.updateOne({ _id: vo.masterOrderId }, { $inc: { "pricing.amountRefunded": vo.total } });
    if (opts.restock) await this.inventory.restockAll(this.stockLines(vo));
    if (opts.alreadyPaidLedger) await this.ledger.reverseSale(vo, reason);
    await this.recomputeMaster(vo.masterOrderId);
    await this.audit.log(actor, "order.refunded", "MpVendorOrder", vo._id, { amount: vo.total, refundId });
  }

  /** Derives the master order's overall status/payment status from its vendor orders. */
  async recomputeMaster(masterId: unknown): Promise<void> {
    const master = await this.masterOrders.findById(masterId);
    if (!master || master.paymentStatus === "pending") return;
    const vos = await this.vendorOrders.find({ masterOrderId: masterId }).select("fulfillmentStatus total").lean();
    const s = vos.map((v: any) => v.fulfillmentStatus as FulfillmentStatus);
    const dead = (x: FulfillmentStatus) => ["cancelled", "refunded", "expired"].includes(x);
    const done = (x: FulfillmentStatus) => ["delivered", "returned", "refunded", "return_requested"].includes(x);
    if (s.every(dead)) master.status = "cancelled";
    else if (s.every((x) => done(x) || dead(x))) master.status = "completed";
    else if (s.some((x) => ["shipped", "delivered", "return_requested", "returned"].includes(x))) master.status = "partially_fulfilled";
    else master.status = "confirmed";
    const refunded = toPaise(master.pricing.amountRefunded ?? 0);
    const paid = toPaise(master.pricing.amountPaid ?? 0);
    if (refunded > 0) master.paymentStatus = refunded >= paid ? "refunded" : "partially_refunded";
    await master.save();
  }

  private transition(vo: any, to: FulfillmentStatus, actor: AuthenticatedUser | null, note?: string): void {
    assertTransition(FULFILLMENT_TRANSITIONS, vo.fulfillmentStatus as FulfillmentStatus, to, "Order");
    this.pushHistory(vo, to, actor, note);
    vo.fulfillmentStatus = to;
  }

  private pushHistory(vo: any, to: string, actor: AuthenticatedUser | null, note?: string): void {
    vo.statusHistory = [
      ...(vo.statusHistory ?? []),
      { from: vo.fulfillmentStatus, to, at: new Date(), actorId: actor?.id, actorRole: actor?.role ?? "system", note },
    ];
  }

  private stockLines(vo: any): StockLine[] {
    return (vo.items ?? []).map((i: any) => ({ productId: i.productId, quantity: i.quantity, name: i.name, inventoryTracked: i.inventoryTracked }));
  }

  private async paginate(model: Model<any>, filter: Record<string, unknown>, query: { page?: number; limit?: number }, populate?: { path: string; select: string }, select?: string): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    let q = model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    if (select) q = q.select(select);
    if (populate) q = q.populate(populate.path, populate.select);
    const [data, total] = await Promise.all([q.lean(), model.countDocuments(filter)]);
    return { data, total, page, limit };
  }

  private oid(value: string): string {
    if (!isValidObjectId(value)) throw new NotFoundException("Order not found");
    return value;
  }

}

/** Vendor order as the customer may see it: no commission, earnings, settlement or staff ids. */
export function customerSafeVendorOrder(vo: any) {
  const rest = omit(vo, ["commissionAmount", "vendorEarning", "settlementStatus", "settlementEligibleAt", "refundError", "statusHistory", "items"]);
  return {
    ...rest,
    items: (vo.items ?? []).map((i: any) => omit(i, ["commissionAmount", "commissionPercent"])),
    statusHistory: (vo.statusHistory ?? []).map((h: any) => omit(h, ["actorId"])),
  };
}

export function verifySignature(secret: string, orderId: string, paymentId: string, signature: string): boolean {
  const expected = Buffer.from(createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex"));
  const actual = Buffer.from(String(signature));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

