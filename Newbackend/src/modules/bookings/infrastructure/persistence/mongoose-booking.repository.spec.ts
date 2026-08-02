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
});
