import { ParkingBookingService } from "./parking-booking.service";

/**
 * Viewing a parking pass must not change it.
 *
 * `GET /parking/bookings/:id/qr` used to call `reissueQr`, which revokes the
 * outstanding pass and mints a replacement. The QR therefore changed on every
 * page refresh, and the code a visitor was holding at the gate had already been
 * revoked by the time a guard scanned it — the scan failed with a 400. The
 * token cannot simply be recomputed either: `sealParkingQr` encrypts under a
 * random IV, so it is stored and re-read.
 */
// Rendering a pass as PNG costs ~8s inside jest and ~110ms outside it: the
// encode is pure-JS pixel work, and jest's module sandbox is roughly 70x slower
// at it. Only the one test that asserts a real raster pays that, and it gets its
// own allowance; everything else renders SVG, which measures ~30ms because it
// skips the raster entirely. Two PNG renders in one test is what made this file
// flake against a 20s budget.
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
    // issueQr is private and mints a NEW pass; stub it so the test can prove
    // the read path does not reach it when a stored pass already exists.
    (service as any).issueQr = issueQr;
    return { service, issueQr, qrCodes };
  };

  it("returns the stored pass unchanged, without minting", async () => {
    const { service, issueQr } = build("TVNPK1.stored.original.pass");

    // SVG on purpose: this asserts the token is reused, and the raster format
    // is irrelevant to that. See the note at the top of the file.
    const first = await service.currentPass("booking-1", "user-1", "svg");
    const second = await service.currentPass("booking-1", "user-1", "svg");

    expect(first.token).toBe("TVNPK1.stored.original.pass");
    expect(second.token).toBe(first.token);
    expect(first.displayCode).toBe("1CNC-AKPC");
    expect(second.displayCode).toBe(first.displayCode);
    // The crux: no reissue, so nothing the visitor holds is revoked.
    expect(issueQr).not.toHaveBeenCalled();
  });

  // The one PNG render, covering the format production actually requests. It is
  // the slow test in this file by design, so it carries its own allowance.
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
    // Legacy rows hold only a hash and cannot be re-rendered, so exactly one
    // pass is issued and stored; later views then reuse it.
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
