import {
  AshramSlugService,
  ashramBookingPath,
  ashramPath,
} from "./ashram-slug.service";

const build = (opts: { taken?: string[]; row?: any } = {}) => {
  const updates: any[] = [];
  const remembered: any[] = [];
  const ashrams = {
    exists: jest.fn(async (filter: any) =>
      (opts.taken ?? []).includes(`${filter.citySlug}/${filter.slug}`)
        ? { _id: "x" }
        : null,
    ),
    updateOne: jest.fn(async (filter: any, update: any) => {
      updates.push({ filter, update });
      return {};
    }),
    findById: jest.fn(() => ({
      select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(opts.row) })),
    })),
    findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(opts.row) })),
  };
  const urls = { register: jest.fn(), remember: jest.fn(async (r: any) => remembered.push(r)) };
  return {
    service: new AshramSlugService(ashrams as never, urls as never),
    updates,
    remembered,
    urls,
  };
};

describe("ashram public paths", () => {
  it("builds id-free urls", () => {
    const parts = { citySlug: "haridwar", slug: "saptrishi-ashram" };
    expect(ashramPath(parts)).toBe("/ashrams/haridwar/saptrishi-ashram");
    expect(ashramBookingPath(parts)).toBe(
      "/ashrams/haridwar/saptrishi-ashram/book",
    );
  });
});

describe("slug allocation is scoped to the city", () => {
  it("keeps the clean slug when the city has no clash", async () => {
    const { service } = build({ taken: ["rishikesh/shiv-mandir"] });
    expect(await service.allocate("Shiv Mandir", "haridwar")).toBe("shiv-mandir");
  });

  it("adds a counter only when the same city already uses it", async () => {
    const { service } = build({ taken: ["haridwar/shiv-mandir"] });
    expect(await service.allocate("Shiv Mandir", "haridwar")).toBe(
      "shiv-mandir-2",
    );
  });
});

describe("filling in slugs for older rows", () => {
  it("persists a slug and city for a row that never had one", async () => {
    const { service, updates } = build();
    const parts = await service.ensureSlug({
      _id: "a1",
      name: "Saptrishi Ashram",
      address: { city: "Haridwar" },
    });

    expect(parts).toEqual({ citySlug: "haridwar", slug: "saptrishi-ashram" });
    expect(updates[0].update.$set).toEqual({
      slug: "saptrishi-ashram",
      citySlug: "haridwar",
    });
  });

  it("leaves an already slugged row untouched", async () => {
    const { service, updates } = build();
    const parts = await service.ensureSlug({
      _id: "a1",
      name: "Saptrishi Ashram",
      slug: "saptrishi-ashram",
      citySlug: "haridwar",
    });
    expect(parts).toEqual({ citySlug: "haridwar", slug: "saptrishi-ashram" });
    expect(updates).toHaveLength(0);
  });
});

describe("renaming keeps old urls alive", () => {
  it("records a redirect from the previous path", async () => {
    const { service, remembered } = build();
    await service.syncSlug({
      _id: "a1",
      name: "Saptrishi Maha Ashram",
      slug: "saptrishi-ashram",
      citySlug: "haridwar",
      address: { city: "Haridwar" },
    });

    expect(remembered[0]).toMatchObject({
      fromPath: "/ashrams/haridwar/saptrishi-ashram",
      toPath: "/ashrams/haridwar/saptrishi-maha-ashram",
      entityType: "ashram",
    });
  });

  it("records a redirect when the city is corrected", async () => {
    const { service, remembered } = build();
    await service.syncSlug({
      _id: "a1",
      name: "Saptrishi Ashram",
      slug: "saptrishi-ashram",
      citySlug: "haridwar",
      address: { city: "Rishikesh" },
    });

    expect(remembered[0]).toMatchObject({
      fromPath: "/ashrams/haridwar/saptrishi-ashram",
      toPath: "/ashrams/rishikesh/saptrishi-ashram",
    });
  });

  it("records nothing when neither name nor city moved", async () => {
    const { service, remembered, updates } = build();
    await service.syncSlug({
      _id: "a1",
      name: "Saptrishi Ashram",
      slug: "saptrishi-ashram",
      citySlug: "haridwar",
      address: { city: "Haridwar" },
    });
    expect(remembered).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});

describe("resolving a public path", () => {
  it("finds the ashram by city and slug", async () => {
    const { service } = build({ row: { _id: "a1" } });
    expect(await service.findByPath("Haridwar", "Saptrishi-Ashram")).toEqual({
      _id: "a1",
    });
  });

  it("still accepts a raw id so old links keep working", async () => {
    const { service } = build({ row: { _id: "68a1f0c2d3e4f5a6b7c8d9e0" } });
    const found = await service.findByPath(
      "any",
      "68a1f0c2d3e4f5a6b7c8d9e0",
    );
    expect(found).toBeTruthy();
  });

  it("returns null for an unknown slug so the caller can 404", async () => {
    const { service } = build({ row: null });
    expect(await service.findByPath("haridwar", "nope")).toBeNull();
  });
});
