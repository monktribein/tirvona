import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { SmartContactProfilesService } from "./smart-contact-profiles.service";
import type { SmartContactAuditService } from "./smart-contact-audit.service";

describe("SmartContactProfilesService.deleteMany", () => {
  const idA = new Types.ObjectId();
  const idB = new Types.ObjectId();
  const actor = { id: "admin-1", name: "Super Admin" };

  const build = (docs: Record<string, unknown>[], qrCount = 0) => {
    const profiles = {
      find: jest.fn(() => ({
        select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(docs) })),
      })),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: docs.length }),
    };
    const qrCodes = {
      countDocuments: jest.fn().mockResolvedValue(qrCount),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: qrCount }),
    };
    const events = { deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }) };
    const audit = { recordMany: jest.fn().mockResolvedValue(undefined) };
    const service = new SmartContactProfilesService(
      profiles as never,
      qrCodes as never,
      events as never,
      audit as unknown as SmartContactAuditService,
    );
    return { service, profiles, qrCodes, events, audit };
  };

  it("removes the profiles with their QR assets and analytics events", async () => {
    const { service, profiles, qrCodes, events } = build([
      { _id: idA, slug: "rocky", displayName: "Rocky" },
      { _id: idB, slug: "working", displayName: "Working" },
    ]);

    const result = await service.deleteMany(
      [idA.toHexString(), idB.toHexString()],
      actor,
    );

    expect(result.deleted).toBe(2);
    expect(result.slugs).toEqual(["rocky", "working"]);
    expect(qrCodes.deleteMany).toHaveBeenCalledWith({
      profileId: { $in: [idA, idB] },
    });
    expect(events.deleteMany).toHaveBeenCalledWith({
      profileId: { $in: [idA, idB] },
    });
    expect(profiles.deleteMany).toHaveBeenCalledWith({
      _id: { $in: [idA, idB] },
    });
  });

  it("keeps the audit trail and appends a line naming each freed slug", async () => {
    const { service, audit } = build([
      { _id: idA, slug: "rocky", displayName: "Rocky" },
    ]);

    await service.deleteMany([idA.toHexString()], actor);

    expect(audit.recordMany).toHaveBeenCalledWith([
      expect.objectContaining({
        profileId: idA,
        action: "PROFILE_DELETED",
        oldValue: "rocky",
        actor,
      }),
    ]);
  });

  it("reports how many printed QR codes the deletion invalidates", async () => {
    const { service } = build([{ _id: idA, slug: "rocky" }], 3);

    const result = await service.deleteMany([idA.toHexString()], actor);

    expect(result.printedQrCodes).toBe(3);
  });

  it("deduplicates and drops malformed ids before touching the database", async () => {
    const { service, profiles } = build([{ _id: idA, slug: "rocky" }]);

    const result = await service.deleteMany(
      [idA.toHexString(), idA.toHexString(), "not-an-object-id"],
      actor,
    );

    expect(result.requested).toBe(1);
    expect(profiles.deleteMany).toHaveBeenCalledWith({ _id: { $in: [idA] } });
  });

  it("refuses a selection with no usable id rather than deleting nothing quietly", async () => {
    const { service, profiles } = build([]);

    await expect(service.deleteMany(["nope"], actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(profiles.deleteMany).not.toHaveBeenCalled();
  });

  it("reports ids that resolve to no profile", async () => {
    const { service, profiles } = build([]);

    await expect(
      service.deleteMany([idA.toHexString()], actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(profiles.deleteMany).not.toHaveBeenCalled();
  });
});
