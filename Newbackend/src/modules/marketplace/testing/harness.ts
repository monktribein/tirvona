/// <reference types="jest" />
/**
 * Test harness: the real marketplace services wired to in-memory models,
 * a fake Razorpay gateway and a fake payout provider. Test-only.
 */
import { createHmac, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AuditLogSchema } from "../../audit/audit.module";
import { MarketplaceAddressSchema } from "../../commerce/infrastructure/persistence/marketplace-order.schemas";
import { BankAccountCrypto } from "../../payouts/infrastructure/bank-account.crypto";
import type { PayoutProvider } from "../../payouts/domain/payout.types";
import { CategoryService } from "../application/category.service";
import { InventoryService } from "../application/inventory.service";
import { LedgerService } from "../application/ledger.service";
import { MarketplaceAuditService } from "../application/marketplace-audit.service";
import { MarketplaceSettingsService } from "../application/marketplace-settings.service";
import { OrderService } from "../application/order.service";
import { PayoutService } from "../application/payout.service";
import { ProductService } from "../application/product.service";
import { ReviewService } from "../application/review.service";
import { VendorService } from "../application/vendor.service";
import {
  CategorySchema,
  LedgerEntrySchema,
  MarketplaceSettingsSchema,
  MasterOrderSchema,
  PayoutSchema,
  ProductSchema,
  ReviewSchema,
  VendorBankAccountSchema,
  VendorDocumentSchema,
  VendorOrderSchema,
  VendorProfileSchema,
} from "../infrastructure/marketplace.schemas";
import { createInMemoryModel } from "./in-memory-model";

export const SECRET = "test_razorpay_secret";

export function makeUser(role = "customer", id = new Types.ObjectId().toHexString()): AuthenticatedUser {
  return {
    _id: id,
    id,
    name: `${role} user`,
    email: `${id}@example.com`,
    phone: "9876543210",
    role,
    status: "active",
    permissions: [],
    scopedAshramIds: [],
    scopedTempleIds: [],
  };
}

export function buildMarketplace(opts: { razorpay?: boolean; nodeEnv?: string } = {}) {
  const models = {
    vendors: createInMemoryModel("MpVendor", VendorProfileSchema, { unique: [["userId"], ["slug"]] }),
    documents: createInMemoryModel("MpVendorDocument", VendorDocumentSchema),
    bankAccounts: createInMemoryModel("MpVendorBankAccount", VendorBankAccountSchema),
    categories: createInMemoryModel("MpCategory", CategorySchema),
    products: createInMemoryModel("MpProduct", ProductSchema),
    masterOrders: createInMemoryModel("MpMasterOrder", MasterOrderSchema, { unique: [["orderNumber"], ["customerId", "idempotencyKey"]] }),
    vendorOrders: createInMemoryModel("MpVendorOrder", VendorOrderSchema, { unique: [["vendorOrderNumber"]] }),
    ledger: createInMemoryModel("MpLedgerEntry", LedgerEntrySchema, { unique: [["idempotencyKey"]] }),
    payouts: createInMemoryModel("MpPayout", PayoutSchema, { unique: [["payoutNumber"]] }),
    settings: createInMemoryModel("MpSettings", MarketplaceSettingsSchema, { unique: [["key"]] }),
    reviews: createInMemoryModel("MpReview", ReviewSchema, { unique: [["customerId", "productId", "vendorOrderId"]] }),
    audit: createInMemoryModel("AuditLog", AuditLogSchema),
    addresses: createInMemoryModel("MarketplaceAddress", MarketplaceAddressSchema),
  };

  const useRazorpay = opts.razorpay ?? true;
  const configValues: Record<string, string | undefined> = {
    razorpayKeyId: useRazorpay ? "rzp_test_key" : undefined,
    razorpayKeySecret: useRazorpay ? SECRET : undefined,
    nodeEnv: opts.nodeEnv ?? "test",
    "payout.encryptionKey": randomBytes(32).toString("base64"),
  };
  const config: any = { get: (k: string) => configValues[k] };
  const transactions: any = { run: (work: (s: any) => Promise<unknown>) => work(undefined) };

  const gateway = {
    orders: { create: jest.fn(async (o: any) => ({ id: `order_${Math.random().toString(36).slice(2)}`, amount: o.amount, currency: "INR" })) },
    payments: { refund: jest.fn(async () => ({ id: `rfnd_${Math.random().toString(36).slice(2)}` })) },
  };
  const payoutProvider = {
    isConfigured: jest.fn(() => false),
    createContact: jest.fn(async () => "cont_1"),
    createFundAccount: jest.fn(async () => "fa_1"),
    createPayout: jest.fn(async () => ({ id: "pout_1", status: "processing" })),
    fetchPayout: jest.fn(async () => ({ id: "pout_1", status: "processed", utr: "UTR123456" })),
    verifyWebhook: jest.fn(() => true),
  } satisfies Record<keyof PayoutProvider, unknown>;

  const audit = new MarketplaceAuditService(models.audit);
  const settings = new MarketplaceSettingsService(models.settings, models.categories, audit);
  const crypto = new BankAccountCrypto(config);
  const vendorService = new VendorService(models.vendors, models.documents, models.bankAccounts, models.products, crypto, audit);
  const categoryService = new CategoryService(models.categories, audit);
  const inventory = new InventoryService(models.products);
  const productService = new ProductService(models.products, models.vendors, models.categories, vendorService, categoryService, inventory, audit);
  const ledger = new LedgerService(models.ledger, audit);
  // Buyers start with an empty wallet, so checkouts go fully to the gateway;
  // refunds land in the wallet and are observed through `credit`.
  const wallet = {
    planSplit: jest.fn(async (_userId: unknown, total: number) => ({ walletAmount: 0, gatewayAmount: total })),
    placeHold: jest.fn(async () => null),
    releaseHold: jest.fn(async () => 0),
    spend: jest.fn(async () => null),
    credit: jest.fn(async () => ({ _id: `wtx_${Math.random().toString(36).slice(2)}` })),
  };
  const orderService = new OrderService(
    models.products, models.vendors, models.masterOrders, models.vendorOrders, models.addresses,
    inventory, ledger, settings, vendorService, audit, transactions, config, wallet as any,
  );
  (orderService as any).razorpay = useRazorpay ? gateway : null;
  const payoutService = new PayoutService(models.payouts, models.vendors, models.bankAccounts, payoutProvider as unknown as PayoutProvider, crypto, ledger, settings, vendorService, audit);
  const reviewService = new ReviewService(models.reviews, models.vendorOrders, models.products, audit);

  const admin = makeUser("super_admin");

  /** Walks a user all the way to an ACTIVE store (profile, KYC, bank, approval). */
  async function activeVendor(storeName = "Shri Store", user = makeUser("customer")) {
    await vendorService.createProfile(user, {
      storeName,
      contactPhone: "9876543210",
      address: { line1: "Temple Road", city: "Vrindavan", state: "Uttar Pradesh", pincode: "281121" },
    });
    await vendorService.addDocument(user, { type: "identity", fileUrl: "https://files.example.com/id.pdf" });
    await vendorService.addDocument(user, { type: "address_proof", fileUrl: "https://files.example.com/addr.pdf" });
    await vendorService.submitForVerification(user);
    const v = await vendorService.requireOwnVendor(user);
    await vendorService.adminSetStatus(admin, String(v._id), "approve"); // approval makes the store active
    await vendorService.addBankAccount(user, { accountHolderName: storeName, accountNumber: "123456789012", ifsc: "SBIN0001234" });
    return { user, vendor: await vendorService.requireOwnVendor(user) };
  }

  async function category(name = "Prasad", commissionPercent?: number) {
    return categoryService.create(admin, { name, ...(commissionPercent !== undefined ? { commissionPercent } : {}) });
  }

  /** Creates, submits and approves a product for an active vendor. */
  async function publishedProduct(vendorUser: AuthenticatedUser, categoryId: string, over: Record<string, unknown> = {}) {
    const p = await productService.vendorCreate(vendorUser, {
      name: `Product ${Math.random().toString(36).slice(2, 7)}`,
      categoryId,
      description: "Blessed prasad",
      price: 500,
      images: ["https://img.example.com/p.jpg"],
      stock: 10,
      ...over,
    } as any);
    await productService.vendorSubmit(vendorUser, String(p._id));
    await productService.adminReview(admin, String(p._id), "approve");
    return models.products.findById(p._id).lean();
  }

  const address = { fullName: "Asha Devi", phone: "9876543210", line1: "12 Ashram Marg", city: "Mathura", state: "Uttar Pradesh", pincode: "281001" };

  async function paidOrder(customer: AuthenticatedUser, items: Array<{ productId: string; quantity: number }>) {
    const { order, payment } = await orderService.checkout(customer, { items, address } as any);
    const paymentId = `pay_${Math.random().toString(36).slice(2)}`;
    await orderService.confirmPayment(customer, String(order._id), {
      razorpay_order_id: payment.razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(payment.razorpayOrderId, paymentId),
    });
    return { order, payment, paymentId };
  }

  return {
    models, config, gateway, wallet, payoutProvider, admin,
    audit, settings, vendorService, categoryService, inventory, productService, ledger, orderService, payoutService, reviewService,
    activeVendor, category, publishedProduct, paidOrder, address,
  };
}

export function sign(orderId: string, paymentId: string): string {
  return createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
}
