import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { OffersService } from "./offers.service";
import type { UpdateOfferDto } from "../presentation/dtos/booking.dto";

const asUser = (partial: Partial<AuthenticatedUser> = {}): AuthenticatedUser =>
  ({
    id: "507f1f77bcf86cd799439011",
    role: "super_admin",
    ...partial,
  }) as AuthenticatedUser;

const OFFER_ID = "507f1f77bcf86cd799439022";

const lean = (row: unknown) => ({
  populate: jest.fn(function (this: unknown) {
    return this;
  }),
  lean: jest.fn().mockResolvedValue(row),
});

/**
 * A row exactly as the schemaless administration console leaves it: no
 * `ownerId`, no `description`. The typed schema marks both required, which is
 * what made every write against these rows fail.
 */
const legacyRow = (extra: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(OFFER_ID),
  offerTitle: "Mahakumbh",
  promoCode: "KUMBH2026",
  maximumRedemptions: 500,
  remainingRedemptions: 500,
  ...extra,
});

/** The `{ $set: … }` argument a targeted update is expected to issue. */
type SetUpdate = { $set: Record<string, any> };

const build = (row: unknown = legacyRow()) => {
  const findChain: any = {
    sort: jest.fn(() => findChain),
    lean: jest.fn().mockResolvedValue([]),
  };
  const offers = {
    find: jest.fn(() => findChain),
    findOne: jest.fn((_filter: Record<string, any>) => lean(row)),
    findOneAndUpdate: jest.fn(
      (_filter: Record<string, any>, _update: SetUpdate, _options?: unknown) =>
        lean({ ...(row as object), status: "disabled" }),
    ),
    updateOne: jest.fn(
      async (_filter: Record<string, any>, _update: SetUpdate) => ({
        modifiedCount: 1,
      }),
    ),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    create: jest.fn(async (doc: Record<string, any>) => doc),
  };
  const redemptions = { countDocuments: jest.fn().mockResolvedValue(0) };
  const ashrams = { find: jest.fn(() => lean([])), findById: jest.fn(() => lean(null)) };
  const service = new OffersService(
    offers as never,
    redemptions as never,
    ashrams as never,
  );

  /** The `$set` payload of the nth call, unwrapped for assertions. */
  const setOf = (
    calls: [Record<string, any>, SetUpdate, ...unknown[]][],
    call = 0,
  ): Record<string, any> => calls[call]![1].$set;

  return { service, offers, redemptions, setOf };
};

describe("OffersService administration actions", () => {
  it("rejects a malformed id instead of letting a CastError become a 500", async () => {
    const { service } = build();
    await expect(service.remove(asUser(), "not-an-id")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("reports a missing offer as 404, not a server fault", async () => {
    const { service, offers } = build();
    offers.findOne.mockReturnValueOnce(lean(null) as never);
    await expect(service.remove(asUser(), OFFER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  /**
   * The original defect. `remove()` hydrated the document and called `.save()`,
   * which re-validated every required field and threw on console-authored rows.
   */
  it("deletes a never-redeemed legacy row without re-validating it", async () => {
    const { service, offers } = build();
    const result = await service.remove(asUser(), OFFER_ID);

    expect(result).toEqual({ archived: false, redemptions: 0 });
    expect(offers.deleteOne).toHaveBeenCalledWith({
      _id: expect.any(Types.ObjectId),
    });
  });

  it("archives a redeemed offer and releases its promo code", async () => {
    const { service, offers, setOf } = build(legacyRow({ redemptionsCount: 3 }));
    const result = await service.remove(asUser(), OFFER_ID);

    expect(result).toEqual({ archived: true, redemptions: 3 });
    expect(offers.deleteOne).not.toHaveBeenCalled();
    const update = setOf(offers.updateOne.mock.calls as never);
    expect(update.deletedAt).toBeInstanceOf(Date);
    expect(update.status).toBe("disabled");
    // The unique index would otherwise block re-creating the same campaign.
    expect(update.promoCode).toMatch(/^KUMBH2026-DELETED-\d+$/);
  });

  it("counts redemption rows when the denormalised tally is absent", async () => {
    const { service, offers, redemptions } = build();
    redemptions.countDocuments.mockResolvedValueOnce(2);
    const result = await service.remove(asUser(), OFFER_ID);

    expect(result.archived).toBe(true);
    expect(offers.deleteOne).not.toHaveBeenCalled();
  });

  it("applies a status-only edit as a targeted update", async () => {
    const { service, offers, setOf } = build();
    await service.setStatus(asUser(), OFFER_ID, "disabled");

    expect((offers.findOneAndUpdate.mock.calls as never as any[])[0][0]).toEqual({
      _id: expect.any(Types.ObjectId),
    });
    const update = setOf(offers.findOneAndUpdate.mock.calls as never);
    expect(update.status).toBe("disabled");
    // Nothing else may be touched — a toggle must not blank the record out.
    expect(Object.keys(update).sort()).toEqual(["status", "updatedBy"]);
  });

  it("does not refund redemptions already spent when the cap is raised", async () => {
    const { service, offers, setOf } = build(
      legacyRow({ maximumRedemptions: 100, remainingRedemptions: 40 }),
    );
    await service.update(asUser(), OFFER_ID, {
      maximumRedemptions: 200,
    } as UpdateOfferDto);

    expect(setOf(offers.findOneAndUpdate.mock.calls as never).remainingRedemptions).toBe(140);
  });

  it("gives a duplicated legacy row an owner so it satisfies the schema", async () => {
    const { service, offers } = build();
    await service.duplicate(asUser(), OFFER_ID);

    const created = (offers.create.mock.calls as never as any[])[0][0];
    expect(created.ownerId).toBe(asUser().id);
    expect(created.status).toBe("draft");
    expect(created.deletedAt).toBeNull();
    expect(created.redemptionsCount).toBe(0);
    expect(created.promoCode).toMatch(/^KUMBH2026-COPY-\d+$/);
  });

  it("hides deleted rows from the administration listing", async () => {
    const { service, offers } = build();
    await service.mine(asUser());
    expect(offers.find).toHaveBeenCalledWith({ deletedAt: null });
  });
});
