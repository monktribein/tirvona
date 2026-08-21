import type { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { REFUND_TRANSITIONS } from "../infrastructure/persistence/refund.schemas";
import { RefundsService } from "./refunds.service";

const asUser = (partial: Partial<AuthenticatedUser>): AuthenticatedUser =>
  ({ id: "507f1f77bcf86cd799439011", role: "customer", ...partial }) as AuthenticatedUser;

const config = (values: Record<string, unknown> = {}) =>
  ({ get: jest.fn((key: string) => values[key]) }) as unknown as ConfigService;

const chain = (rows: unknown[] = []) => {
  const c: any = {
    sort: jest.fn(() => c),
    skip: jest.fn(() => c),
    limit: jest.fn(() => c),
    populate: jest.fn(() => c),
    lean: jest.fn().mockResolvedValue(rows),
    distinct: jest.fn().mockResolvedValue(["ashram-1"]),
  };
  return c;
};

const build = () => {
  const find = jest.fn((_f: any) => chain());
  const requests = { find, countDocuments: jest.fn().mockResolvedValue(0) };
  const ashrams = { find: jest.fn(() => chain()) };
  ashrams.find = jest.fn(() => ({ distinct: jest.fn().mockResolvedValue(["ashram-1"]) })) as never;
  const service = new RefundsService(
    requests as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    ashrams as never,
    {} as never,
    config(),
  );
  return { service, find };
};

describe("RefundsService visibility", () => {
  it("confines a pilgrim to their own refunds", async () => {
    const { service, find } = build();

    await service.list(asUser({ id: "cust-9" }), {});

    expect(find.mock.calls[0][0]).toMatchObject({ customerId: "cust-9" });
  });

  it("gives platform, finance and support roles the whole queue", async () => {
    for (const role of [
      "super_admin",
      "national_admin",
      "finance_manager",
      "support",
    ]) {
      const { service, find } = build();
      await service.list(asUser({ role }), {});
      expect(find.mock.calls[0][0].customerId).toBeUndefined();
      expect(find.mock.calls[0][0].ashramId).toBeUndefined();
    }
  });

  it("confines an ashram owner to refunds against their own ashrams", async () => {
    const { service, find } = build();

    await service.list(asUser({ id: "owner-3", role: "owner" }), {});

    expect(find.mock.calls[0][0]).toMatchObject({
      ashramId: { $in: ["ashram-1"] },
    });
    expect(find.mock.calls[0][0].customerId).toBeUndefined();
  });

  it("always excludes soft-deleted rows", async () => {
    const { service, find } = build();
    await service.list(asUser({ role: "super_admin" }), {});
    expect(find.mock.calls[0][0]).toMatchObject({ isDeleted: false });
  });
});

describe("RefundsService authority", () => {
  const canApprove = (role: string) =>
    (build().service as any).canApprove(asUser({ role }));
  const canReview = (role: string) =>
    (build().service as any).canReview(asUser({ role }));

  it("lets only platform and finance roles approve a payout", () => {
    expect(canApprove("super_admin")).toBe(true);
    expect(canApprove("national_admin")).toBe(true);
    expect(canApprove("finance_manager")).toBe(true);
    expect(canApprove("support")).toBe(false);
    expect(canApprove("owner")).toBe(false);
    expect(canApprove("customer")).toBe(false);
  });

  it("lets support review without granting approval", () => {
    expect(canReview("support")).toBe(true);
    expect(canApprove("support")).toBe(false);
  });

  it("grants an ashram owner neither review nor approval", () => {
    expect(canReview("owner")).toBe(false);
    expect(canApprove("owner")).toBe(false);
  });
});

describe("Refund state machine", () => {
  const assert = (from: string, to: string) =>
    (build().service as any).assertTransition(from, to);

  it("permits the normal path through to settlement", () => {
    expect(() => assert("pending", "under_review")).not.toThrow();
    expect(() => assert("under_review", "approved")).not.toThrow();
    expect(() => assert("approved", "processing")).not.toThrow();
    expect(() => assert("processing", "refunded")).not.toThrow();
  });

  it("refuses to jump straight from pending to refunded", () => {
    expect(() => assert("pending", "refunded")).toThrow();
    expect(() => assert("pending", "processing")).toThrow();
  });

  it("keeps a failed gateway attempt retryable", () => {
    expect(() => assert("failed", "processing")).not.toThrow();
  });

  it("treats settled outcomes as final", () => {
    for (const terminal of ["refunded", "rejected", "cancelled"]) {
      expect(REFUND_TRANSITIONS[terminal as never]).toEqual([]);
      expect(() => assert(terminal, "processing")).toThrow();
    }
  });

  it("cannot reopen a refund that already paid out", () => {
    expect(() => assert("refunded", "approved")).toThrow();
    expect(() => assert("refunded", "pending")).toThrow();
  });
});
