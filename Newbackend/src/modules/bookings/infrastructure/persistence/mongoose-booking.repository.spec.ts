import { ConflictException } from "@nestjs/common";
import { MongooseBookingRepository } from "./mongoose-booking.repository";

describe("MongooseBookingRepository", () => {
  const session = {} as any;
  it("atomically reserves every requested inventory unit", async () => {
    const inventory = {
      updateOne: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: "row" }),
    } as any;
    const repository = new MongooseBookingRepository(inventory);
    await repository.holdInventory({
      ashramId: "a",
      roomId: "r",
      dates: [new Date("2026-08-01"), new Date("2026-08-02")],
      count: 2,
      capacity: 4,
      session,
    });
    expect(inventory.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(
      inventory.findOneAndUpdate.mock.calls[0][0].$expr.$lte[0].$add,
    ).toEqual(["$heldCount", "$bookedCount", "$maintenanceCount", 2]);
  });
  it("fails the transaction when a date has no remaining capacity", async () => {
    const inventory = {
      updateOne: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue(null),
    } as any;
    await expect(
      new MongooseBookingRepository(inventory).holdInventory({
        ashramId: "a",
        roomId: "r",
        dates: [new Date("2026-08-01")],
        count: 1,
        capacity: 1,
        session,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each([
    ["zero", 0],
    ["unknown", undefined],
  ])("never invents units for a room whose count is %s", async (_label, capacity) => {
    const inventory = {
      updateOne: jest.fn().mockResolvedValue({}),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: "row" }),
    } as any;
    await new MongooseBookingRepository(inventory).holdInventory({
      ashramId: "a",
      roomId: "r",
      dates: [new Date("2026-08-01")],
      count: 1,
      capacity: capacity as any,
      session,
    });
    // A brand-new daily row is seeded with the room's real count (0), not the
    // old fallback of 10, so the conditional hold below it cannot succeed.
    expect(inventory.updateOne.mock.calls[0][1].$setOnInsert.totalInventory).toBe(0);
    expect(inventory.updateOne.mock.calls[1][1]).toEqual({
      $max: { totalInventory: 0 },
    });
  });
  it("converts held inventory rather than incrementing it a second time", async () => {
    const inventory = {
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    } as any;
    await new MongooseBookingRepository(inventory).confirmInventory({
      roomId: "r",
      dates: [new Date("2026-08-01")],
      count: 2,
      session,
    });
    expect(inventory.updateOne.mock.calls[0][1]).toEqual({
      $inc: { heldCount: -2, bookedCount: 2 },
    });
  });

  describe("Short Stay guests", () => {
    const chain = (value: unknown) => {
      const q: any = {};
      q.select = jest.fn(() => q);
      q.session = jest.fn(() => q);
      q.lean = jest.fn().mockResolvedValue(value);
      return q;
    };
    const dayStay = (start: string, end: string) => ({
      roomsBookedCount: 1,
      dayStayDetails: { slotStartTime: new Date(start), slotEndTime: new Date(end), housekeepingEndsAt: new Date(end) },
    });
    const setup = (dayStays: any[]) => {
      const inventory = {
        updateOne: jest.fn().mockResolvedValue({}),
        findOneAndUpdate: jest.fn().mockResolvedValue({ _id: "row" }),
      } as any;
      const bookings = { find: jest.fn(() => chain(dayStays)) } as any;
      const ashrams = {
        findById: jest.fn(() => chain({ policies: { checkInTime: "12:00", checkOutTime: "11:00" } })),
      } as any;
      return { inventory, bookings, repository: new MongooseBookingRepository(inventory, bookings, ashrams) };
    };
    const hold = (repository: MongooseBookingRepository) =>
      repository.holdInventory({
        ashramId: "a",
        roomId: "r",
        dates: [new Date("2030-10-01")],
        count: 1,
        capacity: 2,
        session,
      });

    it("counts a Short Stay that overlaps the night against the overnight hold", async () => {
      const { inventory, repository } = setup([dayStay("2030-10-01T14:00:00+05:30", "2030-10-01T19:00:00+05:30")]);
      await hold(repository);
      expect(inventory.findOneAndUpdate.mock.calls[0][0].$expr.$lte[0].$add).toEqual([
        "$heldCount",
        "$bookedCount",
        "$maintenanceCount",
        2,
      ]);
    });

    it("counts back-to-back Short Stays on one unit once, not twice", async () => {
      const { inventory, repository } = setup([
        dayStay("2030-10-01T12:00:00+05:30", "2030-10-01T16:00:00+05:30"),
        dayStay("2030-10-01T16:00:00+05:30", "2030-10-01T20:00:00+05:30"),
      ]);
      await hold(repository);
      expect(inventory.findOneAndUpdate.mock.calls[0][0].$expr.$lte[0].$add[3]).toBe(2);
    });

    it("ignores a morning Short Stay that ends before the overnight check-in", async () => {
      const { inventory, repository } = setup([dayStay("2030-10-01T06:00:00+05:30", "2030-10-01T11:00:00+05:30")]);
      await hold(repository);
      expect(inventory.findOneAndUpdate.mock.calls[0][0].$expr.$lte[0].$add[3]).toBe(1);
    });

    it("explains the refusal when Short Stays took the last room", async () => {
      const { inventory, repository } = setup([dayStay("2030-10-01T14:00:00+05:30", "2030-10-01T19:00:00+05:30")]);
      inventory.findOneAndUpdate.mockResolvedValue(null);
      await expect(hold(repository)).rejects.toThrow(/Short Stay/);
    });
  });
});
