/// <reference types="jest" />
import { Types } from "mongoose";
import { createInMemoryModel } from "../../marketplace/testing/in-memory-model";
import {
  PilgrimWalletHoldSchema,
  PilgrimWalletSchema,
  PilgrimWalletTransactionSchema,
} from "../infrastructure/wallet.schemas";
import { WalletService } from "./wallet.service";

const oid = () => new Types.ObjectId().toHexString();

function build() {
  const wallets = createInMemoryModel("PilgrimWallet", PilgrimWalletSchema, { unique: [["userId"]] });
  const txns = createInMemoryModel("PilgrimWalletTransaction", PilgrimWalletTransactionSchema, {
    unique: [["idempotencyKey"]],
  });
  const holds = createInMemoryModel("PilgrimWalletHold", PilgrimWalletHoldSchema);
  const service = new WalletService(wallets, txns, holds);
  const walletOf = async (userId: string) => wallets.findOne({ userId }).lean();
  return { service, wallets, txns, holds, walletOf };
}

const refund = (userId: string, amount: number, key = `refund:${oid()}`) => ({
  userId,
  amount,
  module: "ashram_booking" as const,
  category: "refund" as const,
  description: "Refund",
  idempotencyKey: key,
});

describe("WalletService", () => {
  it("credits once per idempotency key and records the running balance", async () => {
    const { service, txns, walletOf } = build();
    const userId = oid();
    const first = await service.credit(refund(userId, 250.555, "refund:A"));
    const replay = await service.credit(refund(userId, 250.555, "refund:A"));

    expect(String(replay._id)).toBe(String(first._id));
    expect(await txns.countDocuments({ userId })).toBe(1);
    const wallet = await walletOf(userId);
    expect(wallet.balance).toBe(250.56);
    expect(wallet.totalCredited).toBe(250.56);
    expect(first.balanceAfter).toBe(250.56);
  });

  it("refuses a debit larger than the balance and leaves the balance alone", async () => {
    const { service, walletOf } = build();
    const userId = oid();
    await service.credit(refund(userId, 100));
    await expect(
      service.debit({ ...refund(userId, 150), category: "payment", idempotencyKey: "pay:x" }),
    ).rejects.toThrow(/not enough/);
    expect((await walletOf(userId)).balance).toBe(100);
  });

  it("does not count a withdrawal reversal as new money credited", async () => {
    const { service, walletOf } = build();
    const userId = oid();
    await service.credit({ ...refund(userId, 40), module: "withdrawal", category: "withdrawal_reversal" });
    const wallet = await walletOf(userId);
    expect(wallet.balance).toBe(40);
    expect(wallet.totalCredited).toBe(0);
  });

  describe("checkout holds", () => {
    it("parks the wallet share, then captures it exactly once on confirmation", async () => {
      const { service, txns, walletOf } = build();
      const userId = oid();
      const bookingId = oid();
      await service.credit(refund(userId, 500));

      await service.placeHold({ userId, module: "parking", sourceId: bookingId, amount: 300 });
      let wallet = await walletOf(userId);
      expect(wallet.balance).toBe(200);
      expect(wallet.heldAmount).toBe(300);

      const spend = { userId, module: "parking" as const, sourceId: bookingId, amount: 300, description: "Parking" };
      const first = await service.spend(spend);
      const replay = await service.spend(spend);

      expect(String(replay._id)).toBe(String(first._id));
      expect(await txns.countDocuments({ userId, category: "payment" })).toBe(1);
      wallet = await walletOf(userId);
      expect(wallet.balance).toBe(200);
      expect(wallet.heldAmount).toBe(0);
      expect(wallet.totalSpent).toBe(300);
    });

    it("counts money already held for the same checkout when re-planning the split", async () => {
      const { service } = build();
      const userId = oid();
      const bookingId = oid();
      await service.credit(refund(userId, 300));
      await service.placeHold({ userId, module: "aarti", sourceId: bookingId, amount: 300 });

      const split = await service.planSplit(userId, 450, true, { module: "aarti", sourceId: bookingId });
      expect(split).toEqual({ walletAmount: 300, gatewayAmount: 150 });
      expect(await service.planSplit(userId, 450, false)).toEqual({ walletAmount: 0, gatewayAmount: 450 });
    });

    it("keeps a re-opened hold of the same amount and replaces one of a different amount", async () => {
      const { service, holds, walletOf } = build();
      const userId = oid();
      const bookingId = oid();
      await service.credit(refund(userId, 500));
      await service.placeHold({ userId, module: "day_stay", sourceId: bookingId, amount: 200 });
      await service.placeHold({ userId, module: "day_stay", sourceId: bookingId, amount: 200 });
      expect(await holds.countDocuments({ status: "held" })).toBe(1);

      await service.placeHold({ userId, module: "day_stay", sourceId: bookingId, amount: 350 });
      expect(await holds.countDocuments({ status: "held" })).toBe(1);
      expect(await holds.countDocuments({ status: "released" })).toBe(1);
      const wallet = await walletOf(userId);
      expect(wallet.balance).toBe(150);
      expect(wallet.heldAmount).toBe(350);
    });

    it("takes the share from the balance when the hold no longer matches", async () => {
      const { service, walletOf } = build();
      const userId = oid();
      const bookingId = oid();
      await service.credit(refund(userId, 500));
      await service.placeHold({ userId, module: "marketplace", sourceId: bookingId, amount: 100 });

      await service.spend({ userId, module: "marketplace", sourceId: bookingId, amount: 120, description: "Order" });
      const wallet = await walletOf(userId);
      expect(wallet.balance).toBe(380);
      expect(wallet.heldAmount).toBe(0);
      expect(wallet.totalSpent).toBe(120);
    });

    it("returns held money when a checkout is abandoned or its hold expires", async () => {
      const { service, holds, walletOf } = build();
      const userId = oid();
      const abandoned = oid();
      const lapsed = oid();
      await service.credit(refund(userId, 500));
      await service.placeHold({ userId, module: "parking", sourceId: abandoned, amount: 100 });
      await service.placeHold({ userId, module: "aarti", sourceId: lapsed, amount: 150 });

      expect(await service.releaseHold("parking", abandoned)).toBe(100);
      expect(await service.releaseHold("parking", abandoned)).toBe(0);

      await holds.updateOne({ sourceId: lapsed }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await service.releaseExpiredHolds()).toBe(1);

      const wallet = await walletOf(userId);
      expect(wallet.balance).toBe(500);
      expect(wallet.heldAmount).toBe(0);
    });

    it("never lets a hold lapse before the checkout's own reservation", async () => {
      const { service, holds } = build();
      const userId = oid();
      await service.credit(refund(userId, 500));
      const reservationEnds = new Date(Date.now() + 90 * 60_000);
      await service.placeHold({
        userId,
        module: "aarti",
        sourceId: oid(),
        amount: 100,
        expiresAt: reservationEnds,
      });
      const hold = await holds.findOne({ status: "held" }).lean();
      expect(new Date(hold.expiresAt).getTime()).toBeGreaterThan(reservationEnds.getTime());
    });

    it("refuses a hold larger than the balance", async () => {
      const { service, walletOf } = build();
      const userId = oid();
      await service.credit(refund(userId, 50));
      await expect(
        service.placeHold({ userId, module: "parking", sourceId: oid(), amount: 80 }),
      ).rejects.toThrow(/balance changed/);
      expect((await walletOf(userId)).balance).toBe(50);
    });
  });
});
