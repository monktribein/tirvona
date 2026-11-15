import { AartiMaintenanceService } from "./aarti-maintenance.service";

const lean = <T>(value: T) => ({
  select: () => ({ limit: () => ({ lean: async () => value }) }),
});

const build = (stale: any[], claimed: any) => {
  const bookings: any = {
    find: jest.fn(() => lean(stale)),
    findOneAndUpdate: jest.fn().mockResolvedValue(claimed),
  };
  const repository: any = { releaseSeats: jest.fn() };
  const wallet: any = { releaseHold: jest.fn() };
  const transactions: any = { run: jest.fn(async (work: any) => work({})) };
  const service = new AartiMaintenanceService(repository, transactions, bookings, wallet);
  return { service, bookings, repository, wallet };
};

describe("AartiMaintenanceService.expireHolds", () => {
  afterEach(() => {
    delete process.env.AARTI_MAINTENANCE_ENABLED;
  });

  it("expires an unpaid booking whose hold ran out and gives its passes back", async () => {
    const claimed = {
      _id: "booking-1",
      passTypeId: "pass-1",
      sessionDate: new Date("2030-10-01"),
      passCount: 3,
      history: [{ status: "pending" }] as any[],
      save: jest.fn(),
    };
    const { service, bookings, repository, wallet } = build([{ _id: "booking-1" }], claimed);
    await expect(service.expireHolds()).resolves.toBe(1);
    expect(bookings.find).toHaveBeenCalledWith({
      status: "pending",
      reservationExpiresAt: { $ne: null, $lt: expect.any(Date) },
    });
    // Claimed with a conditional update so two instances cannot both release it.
    expect(bookings.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "booking-1", status: "pending" }),
      expect.objectContaining({
        $set: { status: "expired", reservationExpiresAt: null },
      }),
      expect.anything(),
    );
    // History is appended through save(), not a $push the Postgres driver
    // cannot serialise.
    expect(bookings.findOneAndUpdate.mock.calls[0][1]).not.toHaveProperty("$push");
    expect(claimed.history.map((h) => h.status)).toEqual(["pending", "expired"]);
    expect(claimed.save).toHaveBeenCalled();
    expect(repository.releaseSeats).toHaveBeenCalledWith(
      expect.objectContaining({ passTypeId: "pass-1", seats: 3 }),
    );
    expect(wallet.releaseHold).toHaveBeenCalledWith("aarti", "booking-1", expect.anything());
  });

  it("releases nothing when another instance (or a payment) got there first", async () => {
    const { service, repository, wallet } = build([{ _id: "booking-1" }], null);
    await expect(service.expireHolds()).resolves.toBe(0);
    expect(repository.releaseSeats).not.toHaveBeenCalled();
    expect(wallet.releaseHold).not.toHaveBeenCalled();
  });

  it("keeps going when one booking fails", async () => {
    const claimed = { _id: "b", passTypeId: "p", sessionDate: new Date(), passCount: 1, history: [], save: jest.fn() };
    const { service, bookings } = build([{ _id: "a" }, { _id: "b" }], claimed);
    bookings.findOneAndUpdate
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(claimed);
    (service as any).logger = { error: jest.fn(), log: jest.fn() };
    await expect(service.expireHolds()).resolves.toBe(1);
  });

  it("can be switched off per instance", async () => {
    process.env.AARTI_MAINTENANCE_ENABLED = "false";
    const { service, bookings } = build([{ _id: "booking-1" }], {});
    await expect(service.expireHolds()).resolves.toBe(0);
    expect(bookings.find).not.toHaveBeenCalled();
  });
});
