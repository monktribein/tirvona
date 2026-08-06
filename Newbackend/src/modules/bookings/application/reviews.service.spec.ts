import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { ReviewsService } from "./reviews.service";

const user = { id: "507f1f77bcf86cd799439011", role: "customer" } as AuthenticatedUser;
const ASHRAM_ID = "507f1f77bcf86cd799439022";

const build = (overrides: {
  ashram?: unknown;
  booking?: unknown;
  hasCompletedStay?: boolean;
  alreadyReviewed?: boolean;
}) => {
  const created: any[] = [];
  const reviews = {
    exists: jest.fn().mockResolvedValue(
      overrides.alreadyReviewed ? { _id: "existing" } : null,
    ),
    create: jest.fn(async (doc: any) => {
      created.push(doc);
      return doc;
    }),
    aggregate: jest.fn().mockResolvedValue([{ average: 4.5, count: 2 }]),
    findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
  };
  const bookings = {
    findOne: jest.fn(() => ({
      select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
    })),
    exists: jest.fn().mockResolvedValue(
      overrides.hasCompletedStay ? { _id: "stay" } : null,
    ),
  };
  // `create()` calls bookings.findOne(...) directly (no chain) when a
  // bookingId is supplied, so that overload is installed separately.
  if (overrides.booking !== undefined)
    bookings.findOne = jest.fn().mockResolvedValue(overrides.booking) as never;

  const ashrams = {
    findOne: jest
      .fn()
      .mockResolvedValue(
        overrides.ashram === undefined ? { _id: ASHRAM_ID } : overrides.ashram,
      ),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const service = new ReviewsService(
    reviews as never,
    bookings as never,
    ashrams as never,
  );
  return { service, reviews, bookings, ashrams, created };
};

const dto = (extra: Record<string, unknown> = {}) =>
  ({
    ashramId: ASHRAM_ID,
    rating: { overall: 5 },
    comment: "Peaceful and clean.",
    ...extra,
  }) as never;

describe("ReviewsService.create", () => {
  it("accepts a review from a visitor who never booked", async () => {
    const { service, created } = build({ hasCompletedStay: false });

    await service.create(user, dto());

    expect(created[0]).toMatchObject({ bookingId: null, verifiedStay: false });
  });

  /**
   * The badge is derived from the reviewer's own booking history, never from
   * anything they send — otherwise "verified" would mean nothing.
   */
  it("ignores a client-supplied verifiedStay flag", async () => {
    const { service, created } = build({ hasCompletedStay: false });

    await service.create(user, dto({ verifiedStay: true }));

    expect(created[0].verifiedStay).toBe(false);
  });

  it("marks a reviewer with a completed stay as verified even without a bookingId", async () => {
    const { service, created } = build({ hasCompletedStay: true });

    await service.create(user, dto());

    expect(created[0].verifiedStay).toBe(true);
  });

  it("verifies a review that quotes a completed booking", async () => {
    const { service, created } = build({
      booking: { _id: "book-1", status: "checked_out" },
    });

    await service.create(user, dto({ bookingId: "507f1f77bcf86cd799439033" }));

    expect(created[0]).toMatchObject({
      bookingId: "book-1",
      verifiedStay: true,
    });
  });

  it("refuses to review a stay that has not finished", async () => {
    const { service } = build({
      booking: { _id: "book-1", status: "confirmed" },
    });

    await expect(
      service.create(user, dto({ bookingId: "507f1f77bcf86cd799439033" })),
    ).rejects.toThrow("after checkout");
  });

  it("refuses a booking that belongs to someone else", async () => {
    const { service } = build({ booking: null });

    await expect(
      service.create(user, dto({ bookingId: "507f1f77bcf86cd799439033" })),
    ).rejects.toThrow("Booking not found");
  });

  it("allows only one review per person per ashram", async () => {
    const { service } = build({ alreadyReviewed: true });

    await expect(service.create(user, dto())).rejects.toThrow(
      "already reviewed",
    );
  });

  it("turns a duplicate-key race into a conflict rather than a crash", async () => {
    const { service, reviews } = build({});
    reviews.create = jest.fn().mockRejectedValue({ code: 11000 });

    await expect(service.create(user, dto())).rejects.toThrow(
      "already reviewed",
    );
  });

  it("refuses a review for an ashram that does not exist", async () => {
    const { service } = build({ ashram: null });

    await expect(service.create(user, dto())).rejects.toThrow(
      "Ashram not found",
    );
  });

  it("recomputes the ashram average after posting", async () => {
    const { service, ashrams } = build({});

    await service.create(user, dto());

    expect(ashrams.updateOne).toHaveBeenCalledWith(
      { _id: ASHRAM_ID },
      { $set: { rating: { average: 4.5, count: 2 } } },
    );
  });
});
