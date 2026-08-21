import { ForbiddenException } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";

describe("PayoutsService manual payout security", () => {
  const transactions = {
    run: jest.fn(async (operation: (session?: unknown) => unknown) => operation(undefined)),
  };
  const crypto = { decrypt: jest.fn().mockReturnValue("5650101003789") };
  const provider = {};
  const ashrams = {};
  const commissions = { updateMany: jest.fn() };
  const bankAccounts = { findById: jest.fn() };
  const payouts = { findOne: jest.fn(), findById: jest.fn() };
  const payoutTransactions = { create: jest.fn() };
  const audits = { create: jest.fn(), findOne: jest.fn() };
  const webhooks = {};
  const service = new PayoutsService(
    transactions as never,
    crypto as never,
    provider as never,
    ashrams as never,
    commissions as never,
    bankAccounts as never,
    payouts as never,
    payoutTransactions as never,
    audits as never,
    webhooks as never,
  );
  const superAdmin = {
    id: "507f1f77bcf86cd799439001",
    role: "super_admin",
    permissions: [],
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it("rejects bank-detail reveal for non-Super-Admin users", async () => {
    await expect(
      service.revealManualBankDetails(
        { id: "owner-1", role: "owner", permissions: [] } as never,
        "507f1f77bcf86cd799439011",
        "manual transfer",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(payouts.findOne).not.toHaveBeenCalled();
  });

  it("decrypts bank details only after recording an audited reveal", async () => {
    payouts.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          payoutReference: "PO-ONE",
          ashramId: "507f1f77bcf86cd799439012",
          bankAccountId: "507f1f77bcf86cd799439013",
          amount: 13.12,
          currency: "INR",
        }),
      }),
    });
    bankAccounts.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "507f1f77bcf86cd799439013",
          active: true,
          accountHolderName: "Owner One",
          accountNumberCiphertext: "ciphertext",
          accountNumberIv: "iv",
          accountNumberTag: "tag",
          ifsc: "CNRB0005650",
        }),
      }),
    });
    audits.create.mockResolvedValue({});

    const result = await service.revealManualBankDetails(
      superAdmin,
      "507f1f77bcf86cd799439011",
      "Approved manual transfer",
    );

    expect(result).toMatchObject({
      accountNumber: "5650101003789",
      ifsc: "CNRB0005650",
      amount: 13.12,
    });
    expect(audits.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PAYOUT_BANK_DETAILS_REVEALED" }),
    );
    expect(JSON.stringify(audits.create.mock.calls)).not.toContain("5650101003789");
  });

  it("rejects manual settlement when the Super Admin skipped the recent reveal", async () => {
    audits.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });

    await expect(
      service.recordManualPayment(
        superAdmin,
        "507f1f77bcf86cd799439011",
        {
          transferReference: "UTR123456789",
          clientRequestId: "46f4ef30-c79e-4e44-b991-1b3cca82bb59",
          confirmed: true,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(payouts.findOne).not.toHaveBeenCalled();
  });

  it("atomically settles a pending request with a unique manual transfer reference", async () => {
    const payout = {
      _id: "507f1f77bcf86cd799439011",
      ashramId: "507f1f77bcf86cd799439012",
      ownerId: "507f1f77bcf86cd799439014",
      status: "pending",
      amount: 13.12,
      providerPayoutId: null,
      settlementMethod: "razorpayx",
      commissionIds: ["commission-1", "commission-2"],
      save: jest.fn().mockResolvedValue(undefined),
    };
    payouts.findOne
      .mockReturnValueOnce({ select: jest.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({
        session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
      });
    payouts.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(payout),
      }),
    });
    audits.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "reveal-audit-1" }),
      }),
    });
    commissions.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
    audits.create.mockResolvedValue([]);
    payoutTransactions.create.mockResolvedValue([]);

    const result = await service.recordManualPayment(
      superAdmin,
      "507f1f77bcf86cd799439011",
      {
        transferReference: "UTR123456789",
        clientRequestId: "46f4ef30-c79e-4e44-b991-1b3cca82bb59",
        confirmed: true,
      },
    );

    expect(result.status).toBe("paid");
    expect(result.settlementMethod).toBe("manual_bank_transfer");
    expect(result.provider).toBe("manual");
    expect(result.providerUtr).toBe("UTR123456789");
    expect(commissions.updateMany).toHaveBeenCalledWith(
      { payoutId: payout._id, settlementStatus: "processing" },
      { $set: { settlementStatus: "settled" } },
      { session: undefined },
    );
    expect(audits.create).toHaveBeenCalledWith(
      [expect.objectContaining({ action: "PAYOUT_MANUALLY_PAID" })],
      { session: undefined },
    );
  });
});
