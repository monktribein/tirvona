/// <reference types="jest" />
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import bcrypt from "bcryptjs";
import { Schema, Types } from "mongoose";
import { AuditLogSchema } from "../../audit/audit.module";
import { createInMemoryModel } from "../../marketplace/testing/in-memory-model";
import { PilgrimWalletSchema } from "../../wallet/infrastructure/wallet.schemas";
import { UserSchema } from "../../users/infrastructure/persistence/user.schema";
import { AccountDeletionService } from "./account-deletion.service";
import { OpenCommitmentsService } from "./open-commitments.service";

const loose = (status: string) =>
  new Schema({ customerId: Schema.Types.ObjectId, userId: Schema.Types.ObjectId, [status]: String }, { strict: false });

function build() {
  const users = createInMemoryModel("User", UserSchema);
  const audits = createInMemoryModel("AuditLog", AuditLogSchema);
  const wallets = createInMemoryModel("PilgrimWallet", PilgrimWalletSchema);
  const models: Record<string, any> = {
    PilgrimWallet: wallets,
    Booking: createInMemoryModel("Booking", loose("status")),
    ParkingBooking: createInMemoryModel("ParkingBooking", loose("status")),
    AartiBooking: createInMemoryModel("AartiBooking", loose("status")),
    MarketplaceOrderRecord: createInMemoryModel("MarketplaceOrderRecord", loose("orderStatus")),
    MpMasterOrder: createInMemoryModel("MpMasterOrder", loose("status")),
    RefundRequest: createInMemoryModel("RefundRequest", loose("status")),
    PilgrimWalletWithdrawal: createInMemoryModel("PilgrimWalletWithdrawal", loose("status")),
  };
  const moduleRef: any = {
    get: (token: unknown) => {
      const name = Object.keys(models).find((n) => getModelToken(n) === token);
      if (!name) throw new Error("no such model");
      return models[name];
    },
  };
  const config: any = { get: () => "client-id" };
  const service = new AccountDeletionService(
    users as any,
    audits as any,
    new OpenCommitmentsService(moduleRef),
    config,
  );
  const signUp = async (extra: Record<string, unknown> = {}) => {
    const id = new Types.ObjectId();
    const row = await users.create({
      _id: id,
      name: "Asha Rao",
      email: "asha@example.com",
      phone: "9876543210",
      passwordHash: await bcrypt.hash("Secret#123", 4),
      role: "customer",
      fcmTokens: ["token-aaaaaaaaaa"],
      dob: new Date("1990-01-01"),
      ...extra,
    });
    return { id: String(row._id), actor: { id: String(row._id), role: "customer" } as any };
  };
  return { service, users, audits, models, signUp };
}

describe("AccountDeletionService", () => {
  it("erases personal details but keeps the row, and signs the account out", async () => {
    const { service, users, audits, signUp } = build();
    const { id, actor } = await signUp();
    await service.delete(actor, { password: "Secret#123", confirmText: "DELETE", reason: " moving " });
    const row: any = (users as any).store.get(id);
    expect(row.isDeleted).toBe(true);
    expect(row.status).toBe("deleted");
    expect(row.name).toBe("Deleted user");
    expect(row.email).toBe(`deleted.${id}@deleted.tirvona.invalid`);
    expect(row.phone).toBe(`deleted-${id}`);
    expect(row.passwordHash).toBeUndefined();
    expect(row.dob).toBeUndefined();
    expect(row.fcmTokens).toEqual([]);
    expect(row.tokenVersion).toBe(1);
    const audit: any = [...(audits as any).store.values()][0];
    expect(audit.action).toBe("ACCOUNT_SELF_DELETED");
    expect(JSON.stringify(audit)).not.toContain("asha@example.com");
  });

  it("frees the email and phone for a fresh sign-up", async () => {
    const { service, signUp } = build();
    const { actor } = await signUp();
    await service.delete(actor, { password: "Secret#123", confirmText: "DELETE" });
    await expect(signUp()).resolves.toBeDefined();
  });

  it("rejects a wrong password without touching the account", async () => {
    const { service, users, signUp } = build();
    const { id, actor } = await signUp();
    await expect(service.delete(actor, { password: "nope", confirmText: "DELETE" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(((users as any).store.get(id) as any).isDeleted).toBeFalsy();
  });

  it("refuses non-customer roles and sends them to support", async () => {
    const { service, signUp } = build();
    const { actor } = await signUp({ role: "ashram_owner" });
    await expect(service.delete(actor, { password: "Secret#123", confirmText: "DELETE" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("blocks while a booking, refund or wallet balance is open", async () => {
    const { service, models, signUp } = build();
    const { id, actor } = await signUp();
    await models.Booking.create({ customerId: id, status: "confirmed" });
    await models.RefundRequest.create({ customerId: id, status: "processing" });
    await models.PilgrimWallet.create({ userId: id, balance: 250 });
    const check = await service.eligibility(actor);
    expect(check.eligible).toBe(false);
    expect(check.blockers.map((b) => b.code)).toEqual(["OPEN_STAY_BOOKINGS", "OPEN_REFUNDS", "WALLET_NOT_EMPTY"]);
    await expect(service.delete(actor, { password: "Secret#123", confirmText: "DELETE" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("allows deletion once everything is finished", async () => {
    const { service, models, signUp } = build();
    const { id, actor } = await signUp();
    await models.Booking.create({ customerId: id, status: "completed" });
    await models.ParkingBooking.create({ customerId: id, status: "cancelled" });
    await models.PilgrimWallet.create({ userId: id, balance: 0 });
    expect((await service.eligibility(actor)).eligible).toBe(true);
  });

  it("fails closed when a commitment model is not registered", async () => {
    const { models, signUp } = build();
    const { actor } = await signUp();
    delete models.AartiBooking;
    const broken = new AccountDeletionService(
      { findById: () => ({ select: async () => ({ _id: actor.id, role: "customer", passwordHash: "x" }) }) } as any,
      {} as any,
      new OpenCommitmentsService({
        get: (token: unknown) => {
          const name = Object.keys(models).find((n) => getModelToken(n) === token);
          if (!name) throw new Error("missing");
          return models[name];
        },
      } as any),
      { get: () => "id" } as any,
    );
    await expect(broken.eligibility(actor)).rejects.toThrow(/temporarily unavailable/);
  });
});
