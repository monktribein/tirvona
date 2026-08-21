import { BadRequestException } from "@nestjs/common";
import { BookingsService } from "./bookings.service";

const query = <T>(value: T) => ({
  session: jest.fn().mockResolvedValue(value),
});

const populatedQuery = (value: unknown) => ({
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

const createService = () => {
  const service = Object.create(BookingsService.prototype) as BookingsService;
  const row: any = {
    _id: "booking-1",
    ashramId: "ashram-1",
    roomId: "room-1",
    status: "expired",
    paymentStatus: "pending",
    gatewayStatus: "not_initiated",
    occupiedDates: [new Date("2026-08-20")],
    roomsBookedCount: 1,
    specialRequests: "",
    save: jest.fn().mockResolvedValue(undefined),
  };
  Object.assign(service as any, {
    transactions: {
      run: jest.fn(async (work: (session: object) => Promise<unknown>) =>
        work({}),
      ),
    },
    bookings: {
      findOne: jest.fn().mockReturnValue(query(row)),
      findById: jest.fn().mockReturnValue(populatedQuery(row)),
      exists: jest.fn(),
    },
    payments: { exists: jest.fn().mockReturnValue(query(null)) },
    inventoryHolds: { findOne: jest.fn().mockReturnValue(query(null)) },
    assignments: { findOneAndUpdate: jest.fn() },
    audits: { create: jest.fn().mockResolvedValue(undefined) },
    repository: { releaseInventory: jest.fn() },
  });
  return { service, row };
};

describe("BookingsService Super Admin maintenance", () => {
  const admin = { id: "admin-1", role: "super_admin" } as never;

  it("updates only the allowed editable booking details and writes an audit", async () => {
    const { service, row } = createService();

    await service.adminUpdate("booking-1", admin, {
      specialRequests: "Wheelchair assistance",
    });

    expect(row.specialRequests).toBe("Wheelchair assistance");
    expect(row.save).toHaveBeenCalled();
    expect((service as any).audits.create).toHaveBeenCalledWith(
      [expect.objectContaining({ action: "SUPER_ADMIN_BOOKING_UPDATED" })],
      expect.any(Object),
    );
  });

  it("archives an unpaid expired booking without deleting its audit history", async () => {
    const { service, row } = createService();

    await expect(service.adminArchive("booking-1", admin)).resolves.toEqual({
      id: "booking-1",
      archived: true,
    });
    expect(row).toMatchObject({ deletedBy: "admin-1" });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect((service as any).audits.create).toHaveBeenCalledWith(
      [expect.objectContaining({ action: "SUPER_ADMIN_BOOKING_ARCHIVED" })],
      expect.any(Object),
    );
  });

  it("protects a paid booking from archive", async () => {
    const { service, row } = createService();
    row.paymentStatus = "fully_paid";

    await expect(service.adminArchive("booking-1", admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(row.save).not.toHaveBeenCalled();
  });
});
