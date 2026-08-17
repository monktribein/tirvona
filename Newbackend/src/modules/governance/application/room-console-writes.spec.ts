import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { GovernanceService } from "./governance.service";

/**
 * The Super Admin room console writes to three different places behind one
 * endpoint, and two of them are not collections at all.
 *
 * `rooms?subKey=pricing` is an assembled view: a room's own `basePrice` and
 * each entry of its `pricingRules` array are listed as rows carrying a
 * composite id (`base:<roomId>`, `embedded:<roomId>:<ruleId>`) rather than an
 * ObjectId. Left to the generic path those rows are read as brand-new records
 * and inserted as junk, which is why the page shipped read-only. These pin the
 * routing that makes it editable.
 */
describe("super admin room console writes", () => {
  const ROOM_ID = new Types.ObjectId().toHexString();
  const superAdmin = { id: "u1", role: "super_admin" } as never;

  const buildService = (room: Record<string, unknown> | null) => {
    const repository = {
      one: jest.fn().mockResolvedValue(room),
      update: jest.fn(async (_model, _filter, update) => ({
        _id: ROOM_ID,
        ...(update.$set as Record<string, unknown>),
      })),
      create: jest.fn(async (_model, payload) => ({ _id: "new", ...payload })),
      list: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      remove: jest.fn().mockResolvedValue(null),
      removeMany: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue(0),
    };
    return { service: new GovernanceService(repository as never), repository };
  };

  describe("pricing rows", () => {
    it("writes a base row back to the room's own basePrice", async () => {
      const { service, repository } = buildService({
        _id: ROOM_ID,
        basePrice: 800,
        pricingRules: [],
      });

      await service.adminSave(superAdmin, "rooms", "pricing", {
        _id: `base:${ROOM_ID}`,
        overridePrice: 1450,
      });

      expect(repository.update).toHaveBeenCalledWith(
        "Admin_rooms",
        { _id: ROOM_ID },
        { $set: { basePrice: 1450 } },
      );
    });

    it("edits a seasonal rule in place without disturbing its siblings", async () => {
      const { service, repository } = buildService({
        _id: ROOM_ID,
        basePrice: 800,
        pricingRules: [
          { _id: "r1", name: "Kumbh Mela", multiplier: 2 },
          { _id: "r2", name: "Diwali", multiplier: 3 },
        ],
      });

      await service.adminSave(superAdmin, "rooms", "pricing", {
        _id: `embedded:${ROOM_ID}:r2`,
        name: "Diwali Peak",
        multiplier: 1.5,
        overridePrice: 2400,
      });

      const rules = (repository.update.mock.calls[0][2] as any).$set
        .pricingRules;
      expect(rules).toHaveLength(2);
      expect(rules[0]).toMatchObject({ name: "Kumbh Mela", multiplier: 2 });
      expect(rules[1]).toMatchObject({
        name: "Diwali Peak",
        multiplier: 1.5,
        overridePrice: 2400,
      });
    });

    it("appends a new seasonal rule when only a source room is given", async () => {
      const { service, repository } = buildService({
        _id: ROOM_ID,
        basePrice: 800,
        pricingRules: [{ _id: "r1", name: "Kumbh Mela" }],
      });

      await service.adminSave(superAdmin, "rooms", "pricing", {
        sourceRoomId: ROOM_ID,
        name: "Holi",
        multiplier: 2,
      });

      const rules = (repository.update.mock.calls[0][2] as any).$set
        .pricingRules;
      expect(rules).toHaveLength(2);
      expect(rules[1]).toMatchObject({ name: "Holi", multiplier: 2 });
    });

    it("refuses a seasonal window that ends before it starts", async () => {
      const { service } = buildService({
        _id: ROOM_ID,
        basePrice: 800,
        pricingRules: [],
      });

      await expect(
        service.adminSave(superAdmin, "rooms", "pricing", {
          sourceRoomId: ROOM_ID,
          validFrom: "2026-10-10",
          validUntil: "2026-10-01",
          overridePrice: 900,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("removes a seasonal rule from the room that holds it", async () => {
      const { service, repository } = buildService({
        _id: ROOM_ID,
        pricingRules: [{ _id: "r1" }, { _id: "r2" }],
      });

      await service.adminDelete(
        superAdmin,
        "rooms",
        `embedded:${ROOM_ID}:r1`,
        "pricing",
      );

      const rules = (repository.update.mock.calls[0][2] as any).$set
        .pricingRules;
      expect(rules).toEqual([{ _id: "r2" }]);
    });

    it("refuses to delete a base price, which is the room's own rate", async () => {
      const { service } = buildService({ _id: ROOM_ID });

      await expect(
        service.adminDelete(superAdmin, "rooms", `base:${ROOM_ID}`, "pricing"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("reports a missing seasonal rule rather than silently doing nothing", async () => {
      const { service } = buildService({
        _id: ROOM_ID,
        pricingRules: [{ _id: "r1" }],
      });

      await expect(
        service.adminSave(superAdmin, "rooms", "pricing", {
          _id: `embedded:${ROOM_ID}:gone`,
          overridePrice: 100,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("daily availability rows", () => {
    const ROW_ID = new Types.ObjectId().toHexString();

    it("never lets the console write booked or held units", async () => {
      const { service, repository } = buildService(null);
      repository.one.mockResolvedValue({
        _id: ROW_ID,
        totalInventory: 10,
        bookedCount: 4,
        heldCount: 1,
      });

      await service.adminSave(superAdmin, "rooms", "availability", {
        _id: ROW_ID,
        bookedCount: 0,
        heldCount: 0,
        maintenanceCount: 2,
      });

      const written = (repository.update.mock.calls[0][2] as any).$set;
      expect(written).not.toHaveProperty("bookedCount");
      expect(written).not.toHaveProperty("heldCount");
      expect(written.maintenanceCount).toBe(2);
    });

    it("refuses to block units that are already sold or held", async () => {
      const { service, repository } = buildService(null);
      repository.one.mockResolvedValue({
        _id: ROW_ID,
        totalInventory: 10,
        bookedCount: 7,
        heldCount: 2,
      });

      await expect(
        service.adminSave(superAdmin, "rooms", "availability", {
          _id: ROW_ID,
          maintenanceCount: 5,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
