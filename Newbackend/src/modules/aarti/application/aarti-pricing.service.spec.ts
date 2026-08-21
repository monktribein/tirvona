import { AartiPricingService } from "./aarti-pricing.service";
import { AARTI_DEFAULTS } from "../domain/aarti.constants";

const lean = <T>(value: T) => ({ lean: () => Promise.resolve(value) });

const model = (rows: any[] = []) => ({
  find: jest.fn(() => lean(rows)),
  findOne: jest.fn(() => lean(rows[0] ?? null)),
});

const build = (options: {
  settings?: any[];
  rules?: any[];
  holidays?: any[];
  availability?: any[];
} = {}) =>
  new AartiPricingService(
    model(options.rules ?? []) as any,
    model(options.holidays ?? []) as any,
    model(options.settings ?? []) as any,
    model(options.availability ?? []) as any,
  );

// A Saturday, far enough out to clear the booking-close window.
const inTwoWeeks = (): string =>
  new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

const session = (overrides: any = {}) => ({
  _id: "sess1",
  ashramId: "ash1",
  startTime: "18:30",
  durationMinutes: 45,
  daysOfWeek: [],
  commissionPercent: null,
  ...overrides,
});

const passType = (overrides: any = {}) => ({
  _id: "pt1",
  name: "General Ghat",
  basePrice: 101,
  totalCapacity: 200,
  maxPerBooking: 10,
  ...overrides,
});

describe("resolveSettings", () => {
  it("falls back to the platform defaults when nothing is configured", async () => {
    const service = build();
    await expect(service.resolveSettings()).resolves.toMatchObject(
      AARTI_DEFAULTS,
    );
  });

  it("lets a session-scoped row win over the platform row", async () => {
    const service = build({
      settings: [
        { scope: "platform", commissionPercent: 10 },
        { scope: "session", commissionPercent: 4 },
      ],
    });
    const result = await service.resolveSettings("sess1", "ash1");
    expect(result.commissionPercent).toBe(4);
  });

  it("ignores null overrides rather than blanking a default", async () => {
    const service = build({
      settings: [{ scope: "session", commissionPercent: null }],
    });
    const result = await service.resolveSettings("sess1", "ash1");
    expect(result.commissionPercent).toBe(AARTI_DEFAULTS.commissionPercent);
  });
});

describe("quote", () => {
  it("prices passes at the base price when no rule applies", async () => {
    const service = build();
    const result = await service.quote(session(), passType(), {
      sessionDate: inTwoWeeks(),
      passCount: 2,
    });
    expect(result.ok).toBe(true);
    expect(result.quote.unitPrice).toBe(101);
    expect(result.quote.subtotal).toBe(202);
    expect(result.quote.totalAmount).toBe(202);
  });

  it("adds a sankalp donation on top of the pass subtotal", async () => {
    const service = build();
    const result = await service.quote(session(), passType(), {
      sessionDate: inTwoWeeks(),
      passCount: 1,
      donationAmount: 500,
    });
    expect(result.quote.donationAmount).toBe(500);
    expect(result.quote.totalAmount).toBe(601);
  });

  it("refuses a date the aarti is not held on", async () => {
    const service = build();
    const date = inTwoWeeks();
    const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const result = await service.quote(
      session({ daysOfWeek: [(weekday + 1) % 7] }),
      passType(),
      { sessionDate: date, passCount: 1 },
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("NOT_SCHEDULED");
  });

  it("refuses a booking after the cut-off window", async () => {
    const service = build();
    const result = await service.quote(session(), passType(), {
      sessionDate: new Date(Date.now() - 86_400_000)
        .toISOString()
        .slice(0, 10),
      passCount: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BOOKING_CLOSED");
  });

  it("refuses a date beyond the booking horizon", async () => {
    const service = build();
    const result = await service.quote(session(), passType(), {
      sessionDate: new Date(Date.now() + 200 * 86_400_000)
        .toISOString()
        .slice(0, 10),
      passCount: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOO_FAR_AHEAD");
  });

  it("caps passes per booking at the stricter of pass and settings limits", async () => {
    const service = build();
    const result = await service.quote(
      session(),
      passType({ maxPerBooking: 4 }),
      { sessionDate: inTwoWeeks(), passCount: 5 },
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOO_MANY_PASSES");
  });

  it("closes booking on a festival closure day", async () => {
    const service = build({
      holidays: [{ name: "Temple closed", isClosed: true, peakMultiplier: 1 }],
    });
    const result = await service.quote(session(), passType(), {
      sessionDate: inTwoWeeks(),
      passCount: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("CLOSED_PERIOD");
  });

  it("applies a festival peak multiplier to the unit price", async () => {
    const service = build({
      holidays: [{ name: "Kumbh", type: "festival", peakMultiplier: 2 }],
    });
    const result = await service.quote(session(), passType(), {
      sessionDate: inTwoWeeks(),
      passCount: 2,
    });
    expect(result.quote.unitPrice).toBe(202);
    expect(result.quote.subtotal).toBe(404);
    expect(result.quote.isPeak).toBe(true);
  });

  it("takes the highest overlapping festival multiplier, never their product", async () => {
    const service = build({
      holidays: [
        { name: "Kumbh", peakMultiplier: 2 },
        { name: "Purnima", peakMultiplier: 3 },
      ],
    });
    const result = await service.quote(session(), passType(), {
      sessionDate: inTwoWeeks(),
      passCount: 1,
    });
    expect(result.quote.peakMultiplier).toBe(3);
    expect(result.quote.unitPrice).toBe(303);
  });

  it("lets a day-level custom price override the pass base price", async () => {
    const service = build({ availability: [{ customPrice: 51, totalCapacity: 200, bookedCount: 10, blockedCount: 0 }] });
    const result = await service.quote(session(), passType(), {
      sessionDate: inTwoWeeks(),
      passCount: 1,
    });
    expect(result.quote.unitPrice).toBe(51);
    expect(result.quote.seatsRemaining).toBe(190);
  });

  it("adds tax when a rule declares one", async () => {
    const service = build({ rules: [{ multiplier: 1, taxPercent: 10 }] });
    const result = await service.quote(session(), passType({ basePrice: 100 }), {
      sessionDate: inTwoWeeks(),
      passCount: 2,
    });
    expect(result.quote.taxAmount).toBe(20);
    expect(result.quote.totalAmount).toBe(220);
  });
});

describe("refundQuote", () => {
  const booking = (overrides: any = {}) => ({
    sessionId: "sess1",
    ashramId: "ash1",
    startsAt: new Date(Date.now() + 72 * 3_600_000),
    pricing: { amountPaid: 1000, donationAmount: 0 },
    ...overrides,
  });

  it("refunds in full outside the free-cancellation window", async () => {
    const service = build();
    const result = await service.refundQuote(booking(), session());
    expect(result.allowed).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.refundAmount).toBe(1000);
  });

  it("refunds partially inside the window", async () => {
    const service = build();
    const result = await service.refundQuote(
      booking({ startsAt: new Date(Date.now() + 2 * 3_600_000) }),
      session(),
    );
    expect(result.percent).toBe(50);
    expect(result.refundAmount).toBe(500);
  });

  it("retains the sankalp donation and refunds only the pass fee", async () => {
    const service = build();
    const result = await service.refundQuote(
      booking({ pricing: { amountPaid: 1500, donationAmount: 500 } }),
      session(),
    );
    expect(result.refundAmount).toBe(1000);
    expect(result.donationRetained).toBe(500);
  });

  it("blocks cancellation when the ashram disallows it", async () => {
    const service = build({
      settings: [{ scope: "session", allowCancellation: false }],
    });
    const result = await service.refundQuote(booking(), session());
    expect(result.allowed).toBe(false);
    expect(result.refundAmount).toBe(0);
  });
});

describe("commission", () => {
  it("uses the platform default when the session sets none", async () => {
    const service = build();
    const result = await service.commission(session(), 1000);
    expect(result.percent).toBe(AARTI_DEFAULTS.commissionPercent);
    expect(result.amount).toBe(100);
    expect(result.ashramEarning).toBe(900);
  });

  it("lets a per-session rate override the default", async () => {
    const service = build();
    const result = await service.commission(
      session({ commissionPercent: 5 }),
      1000,
    );
    expect(result.amount).toBe(50);
    expect(result.ashramEarning).toBe(950);
  });

  it("never returns a negative ashram earning", async () => {
    const service = build();
    const result = await service.commission(
      session({ commissionPercent: 150 }),
      100,
    );
    expect(result.ashramEarning).toBe(0);
  });
});
