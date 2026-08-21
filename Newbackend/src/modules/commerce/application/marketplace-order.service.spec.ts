import type { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { MarketplaceOrderService } from "./marketplace-order.service";

const asUser = (partial: Partial<AuthenticatedUser>): AuthenticatedUser =>
  ({ id: "cust-1", role: "customer", ...partial }) as AuthenticatedUser;

const config = (values: Record<string, unknown> = {}) =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

const productFind = (rows: unknown[]) =>
  jest.fn(() => ({ lean: jest.fn().mockResolvedValue(rows) }));

const PRASAD = {
  _id: "prod-1",
  name: "Ganga arti prasad",
  slug: "ganga-arti-prasad",
  price: 899,
  status: "active",
  stock: 10,
  images: ["a.jpg"],
};

describe("MarketplaceOrderService pricing", () => {
  const build = (rows: unknown[]) =>
    new MarketplaceOrderService(
      { find: productFind(rows) } as never,
      {} as never,
      {} as never,
      {} as never,
      config(),
    );

  it("prices from the catalogue, ignoring anything the client sends", async () => {
    const service = build([PRASAD]);

    const quote = await service.quote([
      { productId: "prod-1", quantity: 2, unitPrice: 1, lineTotal: 2 } as never,
    ]);

    expect(quote.items[0].unitPrice).toBe(899);
    expect(quote.items[0].lineTotal).toBe(1798);
    expect(quote.pricing.itemsTotal).toBe(1798);
  });

  it("prefers a sale price when the product carries one", async () => {
    const service = build([{ ...PRASAD, salePrice: 699 }]);

    const quote = await service.quote([{ productId: "prod-1", quantity: 1 }]);

    expect(quote.items[0].unitPrice).toBe(699);
  });

  it("charges GST and waives shipping above the free threshold", async () => {
    const service = build([PRASAD]);

    const quote = await service.quote([{ productId: "prod-1", quantity: 2 }]);

    expect(quote.pricing).toMatchObject({
      itemsTotal: 1798,
      shippingFee: 0,
      gstPercent: 5,
      gstAmount: 89.9,
      totalAmount: 1887.9,
    });
  });

  it("charges shipping on a small order", async () => {
    const service = build([{ ...PRASAD, price: 199 }]);

    const quote = await service.quote([{ productId: "prod-1", quantity: 1 }]);

    expect(quote.pricing).toMatchObject({
      itemsTotal: 199,
      shippingFee: 60,
      gstAmount: 9.95,
      totalAmount: 268.95,
    });
  });

  it("refuses an item that is no longer active", async () => {
    const service = build([]);

    await expect(
      service.quote([{ productId: "prod-1", quantity: 1 }]),
    ).rejects.toThrow("no longer available");
  });

  it("refuses a quantity larger than the remaining stock", async () => {
    const service = build([{ ...PRASAD, stock: 1 }]);

    await expect(
      service.quote([{ productId: "prod-1", quantity: 5 }]),
    ).rejects.toThrow("only 1 left");
  });

  it("refuses a product with no usable price", async () => {
    const service = build([{ ...PRASAD, price: 0, salePrice: 0 }]);

    await expect(
      service.quote([{ productId: "prod-1", quantity: 1 }]),
    ).rejects.toThrow("not purchasable");
  });
});

describe("MarketplaceOrderService order scoping", () => {
  const buildWithOrders = () => {
    const chain = {
      sort: jest.fn(() => chain),
      skip: jest.fn(() => chain),
      limit: jest.fn(() => chain),
      populate: jest.fn(() => chain),
      lean: jest.fn().mockResolvedValue([]),
    } as any;
    const find = jest.fn((_filter: any) => chain);
    const findOne = jest.fn((_filter: any) => ({
      populate: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
    }));
    const orders = {
      find,
      findOne,
      countDocuments: jest.fn().mockResolvedValue(0),
    };
    const service = new MarketplaceOrderService(
      {} as never,
      orders as never,
      {} as never,
      {} as never,
      config(),
    );
    return { service, find, findOne };
  };

  it("confines a pilgrim's order list to their own rows", async () => {
    const { service, find } = buildWithOrders();

    await service.list(asUser({ id: "cust-9" }), { page: 1, limit: 20 });

    expect(find.mock.calls[0][0]).toMatchObject({ customerId: "cust-9" });
  });

  it("confines a single-order lookup to the owner", async () => {
    const { service, findOne } = buildWithOrders();

    await expect(
      service.get(asUser({ id: "cust-9" }), "order-belonging-to-someone-else"),
    ).rejects.toThrow("Order not found");
    expect(findOne.mock.calls[0][0]).toMatchObject({ customerId: "cust-9" });
  });

  it("lets marketplace oversight roles see every order", async () => {
    for (const role of ["super_admin", "national_admin", "marketplace_manager"]) {
      const { service, find } = buildWithOrders();
      await service.list(asUser({ role }), { page: 1, limit: 20 });
      expect(find.mock.calls[0][0].customerId).toBeUndefined();
    }
  });

  it("does not treat an ashram owner as marketplace oversight", async () => {
    const { service, find } = buildWithOrders();

    await service.list(asUser({ id: "owner-3", role: "owner" }), {
      page: 1,
      limit: 20,
    });

    expect(find.mock.calls[0][0]).toMatchObject({ customerId: "owner-3" });
  });
});

describe("MarketplaceOrderService payment verification", () => {
  const build = (env: Record<string, unknown>) =>
    new MarketplaceOrderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config(env),
    ) as unknown as {
      signatureValid: (dto: Record<string, string>) => boolean;
    };

  const dto = {
    razorpay_order_id: "order_1",
    razorpay_payment_id: "pay_1",
    razorpay_signature: "deadbeef",
  };

  it("refuses unverified confirmations in production", () => {
    expect(build({ nodeEnv: "production" }).signatureValid(dto)).toBe(false);
  });

  it("allows the demo gateway outside production", () => {
    expect(build({ nodeEnv: "development" }).signatureValid(dto)).toBe(true);
  });

  it("rejects a forged signature when a secret is configured", () => {
    expect(
      build({ nodeEnv: "production", razorpayKeySecret: "s3cr3t-key" })
        .signatureValid(dto),
    ).toBe(false);
  });

  it("accepts a correctly signed confirmation", () => {
    const secret = "s3cr3t-key";
    const signature = createHmac("sha256", secret)
      .update("order_1|pay_1")
      .digest("hex");

    expect(
      build({ nodeEnv: "production", razorpayKeySecret: secret }).signatureValid(
        { ...dto, razorpay_signature: signature },
      ),
    ).toBe(true);
  });
});
