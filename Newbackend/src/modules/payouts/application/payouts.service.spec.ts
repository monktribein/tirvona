import { ForbiddenException } from "@nestjs/common";
import { PayoutsService } from "./payouts.service";

describe("PayoutsService ashram isolation", () => {
  const transactions = { run: jest.fn() };
  const crypto = {};
  const provider = {};
  const ashrams = { find: jest.fn(), findOne: jest.fn() };
  const commissions = {};
  const bankAccounts = { findOne: jest.fn(), find: jest.fn() };
  const payouts = { find: jest.fn(), countDocuments: jest.fn() };
  const payoutTransactions = {};
  const audits = {};
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

  beforeEach(() => jest.clearAllMocks());

  it("returns only owned and explicitly assigned ashrams for an Ashram Admin", async () => {
    const distinct = jest.fn().mockResolvedValue(["owned-1"]);
    const lean = jest.fn().mockResolvedValue([{ _id: "owned-1" }, { _id: "assigned-2" }]);
    const sort = jest.fn().mockReturnValue({ lean });
    const select = jest.fn().mockReturnValue({ sort });
    ashrams.find
      .mockReturnValueOnce({ distinct })
      .mockReturnValueOnce({ select });

    await expect(
      service.availableAshrams({
        id: "admin-1",
        role: "ashram_admin",
        permissions: ["ashrams.manage_all"],
        scopedAshramIds: ["assigned-2"],
      } as never),
    ).resolves.toHaveLength(2);
    expect(ashrams.find).toHaveBeenLastCalledWith({
      deletedAt: null,
      _id: { $in: ["assigned-2", "owned-1"] },
    });
  });

  it("rejects access to another ashram even when the role has platform manage-all permission", async () => {
    ashrams.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: "other-ashram", ownerId: "owner-2" }),
    });
    ashrams.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(["owned-1"]) });

    await expect(
      service.getBankAccount(
        {
          id: "admin-1",
          role: "ashram_admin",
          permissions: ["ashrams.manage_all"],
          scopedAshramIds: [],
        } as never,
        "other-ashram",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(bankAccounts.findOne).not.toHaveBeenCalled();
  });

  it("reuses the active bank account for another authorized ashram with the same owner", async () => {
    ashrams.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: "ashram-2", ownerId: "owner-1" }),
    });
    const account = {
      accountHolderName: "Owner One",
      accountNumberLast4: "3789",
      ifscPrefix: "CNRB",
      updatedAt: new Date(),
    };
    const lean = jest.fn().mockResolvedValue(account);
    const select = jest.fn().mockReturnValue({ lean });
    bankAccounts.findOne.mockReturnValue({ select });

    const result = await service.getBankAccount(
      { id: "super-1", role: "super_admin", permissions: [] } as never,
      "ashram-2",
    );

    expect(bankAccounts.findOne).toHaveBeenCalledWith({ ownerId: "owner-1", active: true });
    expect(result).toMatchObject({
      accountHolderName: "Owner One",
      maskedAccountNumber: "••••3789",
      maskedIfsc: "CNRB0••••••",
    });
  });

  it("rejects payout requests and bank mutations from Super Admin at the service boundary", async () => {
    const superAdmin = { id: "super-1", role: "super_admin", permissions: [] } as never;

    await expect(
      service.createRequest(superAdmin, {
        ashramId: "507f1f77bcf86cd799439011",
        amount: 13.12,
        clientRequestId: "46f4ef30-c79e-4e44-b991-1b3cca82bb59",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.saveBankAccount(superAdmin, "507f1f77bcf86cd799439011", {} as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ashrams.findOne).not.toHaveBeenCalled();
  });

  it("allows only Super Admin to process or reconcile payouts", async () => {
    await expect(
      service.process(
        {
          id: "finance-1",
          role: "finance_manager",
          permissions: ["payouts.process"],
        } as never,
        "507f1f77bcf86cd799439011",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns only masked beneficiary details in the Super Admin payout list", async () => {
    const rawAccount = "5650101003789";
    const rawEmail = "owner@example.com";
    const rawPhone = "919936968762";
    const query: any = {};
    query.select = jest.fn().mockReturnValue(query);
    query.populate = jest.fn().mockReturnValue(query);
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockResolvedValue([
      {
        _id: "payout-1",
        bankAccountId: {
          _id: "bank-1",
          accountHolderName: "Owner One",
          accountNumberLast4: rawAccount.slice(-4),
          ifscPrefix: "CNRB",
          beneficiaryEmail: rawEmail,
          beneficiaryPhone: rawPhone,
        },
      },
    ]);
    payouts.find.mockReturnValue(query);
    payouts.countDocuments.mockResolvedValue(1);

    const result = await service.list(
      { id: "super-1", role: "super_admin", permissions: [] } as never,
      { page: 1, limit: 20 } as never,
    );

    expect(result.rows[0]).toMatchObject({
      bankAccountId: "bank-1",
      beneficiary: {
        accountHolderName: "Owner One",
        maskedAccountNumber: expect.stringContaining("3789"),
        maskedIfsc: expect.stringContaining("CNRB0"),
      },
    });
    expect(JSON.stringify(result.rows[0])).not.toContain(rawAccount);
    expect(JSON.stringify(result.rows[0])).not.toContain(rawEmail);
    expect(JSON.stringify(result.rows[0])).not.toContain(rawPhone);
  });
});
