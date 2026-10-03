/// <reference types="jest" />
import { Types } from "mongoose";
import { UserSchema } from "../../users/infrastructure/persistence/user.schema";
import { createInMemoryModel } from "../../marketplace/testing/in-memory-model";
import { makeUser } from "../../marketplace/testing/harness";
import {
  PilgrimWalletHoldSchema,
  PilgrimWalletSchema,
  PilgrimWalletTransactionSchema,
  PilgrimWalletWithdrawalSchema,
} from "../infrastructure/wallet.schemas";
import { WalletAccountService } from "./wallet-account.service";
import { WalletService } from "./wallet.service";

function build() {
  const wallets = createInMemoryModel("PilgrimWallet", PilgrimWalletSchema, { unique: [["userId"]] });
  const txns = createInMemoryModel("PilgrimWalletTransaction", PilgrimWalletTransactionSchema, {
    unique: [["idempotencyKey"]],
  });
  const holds = createInMemoryModel("PilgrimWalletHold", PilgrimWalletHoldSchema);
  const withdrawals = createInMemoryModel("PilgrimWalletWithdrawal", PilgrimWalletWithdrawalSchema, {
    unique: [["requestNumber"]],
  });
  const users = createInMemoryModel("User", UserSchema);
  const ledger = new WalletService(wallets, txns, holds);
  const transactions: any = { run: (work: (s: any) => Promise<unknown>) => work(undefined) };
  const notifier = { notifyUsers: jest.fn(async () => undefined) };
  const service = new WalletAccountService(
    ledger,
    transactions,
    notifier as any,
    wallets,
    txns,
    withdrawals,
    users,
  );
  const pilgrim = makeUser("customer");
  const admin = makeUser("finance_manager");
  const walletOf = async () => (await service.summary(pilgrim.id)).wallet;
  const fund = (amount: number) =>
    ledger.credit({
      userId: pilgrim.id,
      amount,
      module: "ashram_booking",
      category: "refund",
      description: "Refund",
      idempotencyKey: `refund:${new Types.ObjectId().toHexString()}`,
    });
  return { service, ledger, notifier, users, pilgrim, admin, walletOf, fund };
}

const upi = (amount: number) => ({ amount, method: "upi" as const, upiId: "pilgrim@okaxis" });

describe("WalletAccountService", () => {
  it("moves a transfer request into pending and masks the account number", async () => {
    const { service, pilgrim, walletOf, fund } = build();
    await fund(1000);
    const request = await service.requestWithdrawal(pilgrim, {
      amount: 400,
      method: "bank",
      accountHolderName: "Radha Devi",
      accountNumber: "123456789012",
      ifsc: "sbin0001234",
    });

    expect(request.status).toBe("pending");
    expect(request.ifsc).toBe("SBIN0001234");
    expect(request.accountNumber).toBe("••••••••9012");
    const wallet = await walletOf();
    expect(wallet.balance).toBe(600);
    expect(wallet.pendingWithdrawal).toBe(400);
  });

  it("allows one open request at a time and never more than the balance", async () => {
    const { service, pilgrim, fund } = build();
    await fund(500);
    await expect(service.requestWithdrawal(pilgrim, upi(800))).rejects.toThrow(/up to/);
    await service.requestWithdrawal(pilgrim, upi(200));
    await expect(service.requestWithdrawal(pilgrim, upi(100))).rejects.toThrow(/already have/);
  });

  it("rejects malformed payout details", async () => {
    const { service, pilgrim, fund } = build();
    await fund(500);
    await expect(
      service.requestWithdrawal(pilgrim, { amount: 100, method: "upi", upiId: "not-a-upi" }),
    ).rejects.toThrow(/UPI/);
    await expect(
      service.requestWithdrawal(pilgrim, {
        amount: 100,
        method: "bank",
        accountHolderName: "Radha Devi",
        accountNumber: "123456789012",
        ifsc: "BAD",
      }),
    ).rejects.toThrow(/IFSC/);
  });

  it("returns the money when the pilgrim cancels", async () => {
    const { service, pilgrim, walletOf, fund } = build();
    await fund(500);
    const request = await service.requestWithdrawal(pilgrim, upi(300));
    await service.cancelWithdrawal(pilgrim, String(request._id));

    const wallet = await walletOf();
    expect(wallet.balance).toBe(500);
    expect(wallet.pendingWithdrawal).toBe(0);
    expect(wallet.totalCredited).toBe(500);
    await expect(service.cancelWithdrawal(pilgrim, String(request._id))).rejects.toThrow(/pending/);
  });

  it("returns the money when an admin rejects an approved request", async () => {
    const { service, pilgrim, admin, walletOf, fund, notifier } = build();
    await fund(500);
    const request = await service.requestWithdrawal(pilgrim, upi(300));
    await service.approveWithdrawal(admin, String(request._id));
    await service.rejectWithdrawal(admin, String(request._id), "UPI ID could not be verified");

    const wallet = await walletOf();
    expect(wallet.balance).toBe(500);
    expect(wallet.pendingWithdrawal).toBe(0);
    expect(notifier.notifyUsers).toHaveBeenCalledTimes(2);
    // Money that went back cannot also be paid out.
    await expect(
      service.markWithdrawalPaid(admin, String(request._id), "UTR123456"),
    ).rejects.toThrow(/no longer open/);
  });

  it("settles a paid request into the withdrawn total", async () => {
    const { service, pilgrim, admin, walletOf, fund } = build();
    await fund(500);
    const request = await service.requestWithdrawal(pilgrim, upi(300));
    const paid = await service.markWithdrawalPaid(admin, String(request._id), "UTR123456");

    expect(paid.status).toBe("paid");
    expect(String(paid.reviewedBy)).toBe(admin.id);
    const wallet = await walletOf();
    expect(wallet.balance).toBe(200);
    expect(wallet.pendingWithdrawal).toBe(0);
    expect(wallet.totalWithdrawn).toBe(300);
    await expect(service.rejectWithdrawal(admin, String(request._id), "late")).rejects.toThrow(/no longer open/);
  });

  it("credits a pilgrim once per admin idempotency key and notifies them", async () => {
    const { service, users, pilgrim, admin, walletOf, notifier } = build();
    await users.create({ _id: pilgrim.id, name: "Radha Devi", email: pilgrim.email, phone: "9876543210" });
    const dto = { userId: pilgrim.id, amount: 150, note: "Goodwill", idempotencyKey: "credit-0001" };
    await service.adminCredit(admin, dto);
    await service.adminCredit(admin, dto);

    expect((await walletOf()).balance).toBe(150);
    expect(notifier.notifyUsers).toHaveBeenCalledWith(
      [pilgrim.id],
      expect.objectContaining({ kind: "wallet.credit" }),
    );
  });

  it("reports totals across every wallet", async () => {
    const { service, pilgrim, fund } = build();
    await fund(500);
    await service.requestWithdrawal(pilgrim, upi(120));
    const overview = await service.overview();
    expect(overview).toMatchObject({
      wallets: 1,
      balance: 380,
      pendingWithdrawal: 120,
      refundCredits: { amount: 500, count: 1 },
      withdrawalsPending: { count: 1, amount: 120 },
    });
  });
});
