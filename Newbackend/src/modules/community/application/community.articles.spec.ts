import { CommunityService } from "./community.service";

type Store = Record<string, any[]>;

/** An in-memory stand-in for the community repository. */
const repo = (store: Store) => {
  const created: Record<string, any[]> = {};
  const updated: any[] = [];
  return {
    created,
    updated,
    one: jest.fn(async (name: string, filter: Record<string, any>) =>
      (store[name] ?? []).find((row) =>
        Object.entries(filter).every(([k, v]) =>
          typeof v === "object" && v !== null ? true : String(row[k]) === String(v),
        ),
      ) ?? null,
    ),
    create: jest.fn(async (name: string, doc: any) => {
      (created[name] ??= []).push(doc);
      return { _id: `${name}-new`, ...doc };
    }),
    update: jest.fn(async (_name: string, _filter: unknown, change: any) => {
      updated.push(change);
      return change.$set;
    }),
  };
};

const customer = { id: "visitor-1", role: "customer" } as never;
const fields = {
  title: "Evening aarti at the ghats",
  category: "Experience",
  shortDescription: "What the evening aarti felt like",
  content: "A long story…",
  featuredImage: "https://img/cover.jpg",
};

describe("Visitor articles open to everyone", () => {
  it("lets anyone submit without a stay; it goes to super admin review", async () => {
    const r = repo({});
    const service = new CommunityService(r as never);
    const res = await service.createArticle(customer, { ...fields } as never);
    const article = r.created.articles[0];
    expect(res.message).toBe("Article submitted for approval.");
    expect(article).toMatchObject({ status: "pending", isVerifiedStay: false });
    expect(article).not.toHaveProperty("ownerId");
    expect(article).not.toHaveProperty("bookingId");
    // No ashram owner to notify.
    expect(r.created.notifications).toBeUndefined();
  });

  it("routes an article about an ashram to that ashram's owner", async () => {
    const r = repo({
      ashrams: [{ _id: "ashram-1", name: "Gita Bhawan", ownerId: "owner-1" }],
    });
    const service = new CommunityService(r as never);
    await service.createArticle(customer, { ...fields, ashramId: "ashram-1" } as never);
    expect(r.created.articles[0]).toMatchObject({
      ashramId: "ashram-1",
      ownerId: "owner-1",
      isVerifiedStay: false,
    });
    expect(r.created.notifications[0]).toMatchObject({ recipientId: "owner-1" });
  });

  it("still marks a linked completed stay as a verified stay", async () => {
    const ashram = { _id: "ashram-1", name: "Gita Bhawan", ownerId: "owner-1" };
    const r = repo({
      bookings: [
        {
          _id: "booking-1",
          customerId: "visitor-1",
          status: "completed",
          ashramId: ashram,
          checkInDate: new Date("2026-09-01"),
        },
      ],
    });
    const service = new CommunityService(r as never);
    await service.createArticle(customer, { ...fields, bookingId: "booking-1" } as never);
    expect(r.created.articles[0]).toMatchObject({
      bookingId: "booking-1",
      ownerId: "owner-1",
      isVerifiedStay: true,
    });
  });

  it("does not let the author move the article to another ashram when editing", async () => {
    const r = repo({
      articles: [{ _id: "art-1", visitorId: "visitor-1", status: "draft" }],
    });
    const service = new CommunityService(r as never);
    await service.updateArticle(customer, "art-1", {
      title: "New title",
      ashramId: "someone-elses-ashram",
      bookingId: "booking-x",
    } as never);
    expect(r.updated[0].$set).toEqual({ title: "New title" });
  });

  it("stops an owner from approving their own article", async () => {
    const r = repo({
      articles: [
        { _id: "art-1", visitorId: "owner-1", ownerId: "owner-1", status: "pending" },
      ],
    });
    const service = new CommunityService(r as never);
    await expect(
      service.reviewArticle({ id: "owner-1", role: "owner" } as never, "art-1", "approve"),
    ).rejects.toThrow(/your own article/);
  });

  it("leaves an article with no ashram to super admins", async () => {
    const r = repo({
      articles: [{ _id: "art-1", visitorId: "visitor-1", status: "pending" }],
    });
    const service = new CommunityService(r as never);
    await expect(
      service.reviewArticle({ id: "owner-1", role: "owner" } as never, "art-1", "approve"),
    ).rejects.toThrow(/do not own/);
    await expect(
      service.reviewArticle({ id: "admin-1", role: "super_admin" } as never, "art-1", "approve"),
    ).resolves.toMatchObject({ message: "Article approved and published." });
  });
});
