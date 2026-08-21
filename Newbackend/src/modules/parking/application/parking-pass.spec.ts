import { ParkingBookingService } from "./parking-booking.service";

jest.setTimeout(20_000);

describe("parking pass display is idempotent", () => {
  const BOOKING = {
    _id: "booking-1",
    bookingReference: "TVN-PKG-H7EQE3VJ",
    vehicleNumber: "UP44SS6384",
    paymentStatus: "paid",
    status: "upcoming",
    locationId: "loc-1",
    partnerId: "partner-1",
    customerId: "user-1",
  };

  const build = (storedToken: string | undefined) => {
    const issueQr = jest.fn().mockResolvedValue({
      token: "TVNPK1.minted.fresh.pass",
      displayCode: "NEW1-NEW2",
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 3_600_000),
    });
    const qrCodes = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(
            storedToken
              ? {
                  token: storedToken,
                  displayCode: "1CNC-AKPC",
                  validFrom: new Date(),
                  validUntil: new Date(Date.now() + 3_600_000),
                }
              : null,
          ),
        }),
      }),
    };
    const service = new ParkingBookingService(
      {
        findBookingForCustomer: jest.fn().mockResolvedValue(BOOKING),
      } as never,
      { run: jest.fn((work: any) => work({})) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      qrCodes as never,
      {} as never,
      {} as never,
      {} as never,
    );
    (service as any).issueQr = issueQr;
    return { service, issueQr, qrCodes };
  };

  it("returns the stored pass unchanged, without minting", async () => {
    const { service, issueQr } = build("TVNPK1.stored.original.pass");

    const first = await service.currentPass("booking-1", "user-1", "svg");
    const second = await service.currentPass("booking-1", "user-1", "svg");

    expect(first.token).toBe("TVNPK1.stored.original.pass");
    expect(second.token).toBe(first.token);
    expect(first.displayCode).toBe("1CNC-AKPC");
    expect(second.displayCode).toBe(first.displayCode);
    expect(issueQr).not.toHaveBeenCalled();
  });

  it(
    "renders a real scannable image for the stored token",
    async () => {
      const { service } = build("TVNPK1.stored.original.pass");
      const pass = await service.currentPass("booking-1", "user-1", "png");
      expect(pass.image).toMatch(/^data:image\/png;base64,/);
      expect(pass.bookingReference).toBe("TVN-PKG-H7EQE3VJ");
    },
    30_000,
  );

  it("mints once for a booking that predates the stored token", async () => {
    const { service, issueQr } = build(undefined);
    const pass = await service.currentPass("booking-1", "user-1", "svg");
    expect(issueQr).toHaveBeenCalledTimes(1);
    expect(pass.token).toBe("TVNPK1.minted.fresh.pass");
  });

  it("still refuses a pass for an unpaid or cancelled booking", async () => {
    const { service } = build("TVNPK1.stored.original.pass");
    (service as any).repository.findBookingForCustomer = jest
      .fn()
      .mockResolvedValue({ ...BOOKING, status: "cancelled" });
    await expect(
      service.currentPass("booking-1", "user-1", "svg"),
    ).rejects.toThrow(/no longer has a valid pass/);
  });
});
