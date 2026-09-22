import {
  DEFAULT_CANCELLATION_POLICY,
  computeCancellationRefund,
} from "./booking-refund";

const NOW = new Date("2030-01-10T00:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const paid = (checkInInHours: number, amountPaid = 2000) => ({
  checkInDate: hoursFromNow(checkInInHours),
  paymentStatus: "fully_paid",
  pricing: { amountPaid },
});

describe("computeCancellationRefund", () => {
  const policy = {
    cancellationFreeHours: 48,
    refundBeforeWindowPercent: 90,
    refundInsideWindowPercent: 25,
  };

  it("refunds the before-window percentage when cancelled early enough", () => {
    const d = computeCancellationRefund({
      policy,
      booking: paid(72),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(d.refundPercent).toBe(90);
    expect(d.refundAmount).toBe(1800);
    expect(d.hoursBefore).toBeCloseTo(72);
  });

  it("refunds the inside-window percentage when cancelled late", () => {
    const d = computeCancellationRefund({
      policy,
      booking: paid(10),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(d.refundPercent).toBe(25);
    expect(d.refundAmount).toBe(500);
  });

  it("treats exactly the free window as early", () => {
    const d = computeCancellationRefund({
      policy,
      booking: paid(48),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(d.refundPercent).toBe(90);
  });

  it("refunds in full when a host or admin cancels, however late", () => {
    const d = computeCancellationRefund({
      policy,
      booking: paid(1),
      hostOrAdminCancel: true,
      now: NOW,
    });
    expect(d.refundPercent).toBe(100);
    expect(d.refundAmount).toBe(2000);
  });

  it("refunds nothing when the booking is not fully paid", () => {
    for (const paymentStatus of ["pending", "partially_paid", "failed"]) {
      const d = computeCancellationRefund({
        policy,
        booking: { ...paid(72), paymentStatus },
        hostOrAdminCancel: false,
        now: NOW,
      });
      expect(d.refundAmount).toBe(0);
    }
  });

  it("falls back to the platform defaults when no policy exists", () => {
    const early = computeCancellationRefund({
      policy: null,
      booking: paid(30),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(early.refundPercent).toBe(100);
    expect(early.policySnapshot).toEqual(DEFAULT_CANCELLATION_POLICY);

    const late = computeCancellationRefund({
      policy: null,
      booking: paid(5),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(late.refundPercent).toBe(0);
    expect(late.refundAmount).toBe(0);
  });

  it("keeps the stored policy as the snapshot", () => {
    const d = computeCancellationRefund({
      policy,
      booking: paid(72),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(d.policySnapshot).toBe(policy);
  });

  it("rounds to paise the way the cancellation always has", () => {
    const d = computeCancellationRefund({
      policy: { ...policy, refundBeforeWindowPercent: 33 },
      booking: paid(72, 1000.5),
      hostOrAdminCancel: false,
      now: NOW,
    });
    expect(d.refundAmount).toBe(Math.round(1000.5 * 33) / 100);
  });
});
