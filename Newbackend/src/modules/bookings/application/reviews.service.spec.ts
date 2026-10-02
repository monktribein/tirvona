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

describe("ReviewsService reviewer display name", () => {
  const admin = { id: user.id, role: "super_admin" } as AuthenticatedUser;

  it("stores a display name when a super admin posts", async () => {
    const { service, created } = build({});
    await service.create(admin, dto({ displayName: "  Ramesh Sharma " }));
    expect(created[0].displayName).toBe("Ramesh Sharma");
  });

  it("ignores a display name from anyone else", async () => {
    const { service, created } = build({});
    await service.create(user, dto({ displayName: "Someone Famous" }));
    expect(created[0]).not.toHaveProperty("displayName");
  });

  it("lets a super admin rename only their own review, and clear it", async () => {
    const { service, reviews } = build({});
    const review: any = { customerId: admin.id, displayName: "Old", save: jest.fn() };
    (reviews as any).findById = jest.fn().mockResolvedValue(review);
    await service.setDisplayName(admin, "r1", " Sita Devi ");
    expect(review.displayName).toBe("Sita Devi");
    await service.setDisplayName(admin, "r1", "  ");
    expect(review.displayName).toBeUndefined();

    review.customerId = "someone-else";
    await expect(service.setDisplayName(admin, "r1", "X")).rejects.toThrow(/reviews you posted/);
    await expect(service.setDisplayName(user, "r1", "X")).rejects.toThrow(/super admin/);
  });
});

describe("ReviewsService admin console", () => {
  const admin = { id: user.id, role: "super_admin" } as AuthenticatedUser;
  const chain = (rows: unknown) => {
    const c: any = {};
    for (const m of ["populate", "sort", "skip", "limit", "select"]) c[m] = jest.fn(() => c);
    c.lean = jest.fn().mockResolvedValue(rows);
    return c;
  };

  it("filters by status and searches comments, names and ashram names", async () => {
    const { service, reviews, ashrams } = build({});
    (reviews as any).find = jest.fn(() => chain([{ _id: "r1" }]));
    (reviews as any).countDocuments = jest.fn().mockResolvedValue(1);
    (ashrams as any).find = jest.fn(() => chain([{ _id: "a1" }]));
    const res = await service.adminList({ status: "hidden", search: "Gayatri", page: "2", limit: "10" });
    const filter = (reviews as any).find.mock.calls[0][0];
    expect(filter.status).toBe("hidden");
    expect(filter.$or).toHaveLength(3);
    expect(filter.$or[2]).toEqual({ ashramId: { $in: ["a1"] } });
    expect(res).toMatchObject({ total: 1, page: 2, limit: 10 });
  });

  it("hides a review and recalculates the ashram rating", async () => {
    const { service, reviews, ashrams } = build({});
    const review: any = { ashramId: ASHRAM_ID, status: "approved", save: jest.fn() };
    (reviews as any).findById = jest.fn().mockResolvedValue(review);
    await service.setStatus(admin, "r1", "hidden");
    expect(review.status).toBe("hidden");
    expect(ashrams.updateOne).toHaveBeenCalled();
    await expect(service.setStatus(user, "r1", "hidden")).rejects.toThrow(/super admin/);
  });
});
