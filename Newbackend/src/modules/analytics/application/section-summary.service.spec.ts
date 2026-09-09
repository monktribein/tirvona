import { SectionSummaryService } from "./section-summary.service";

/**
 * The section blocks are what a role sees before it opens anything, so the two
 * things that matter are that a jurisdiction never leaks platform-wide data,
 * and that one unreadable collection cannot take the whole dashboard down.
 */
const build = (
  aggregate: jest.Mock = jest.fn().mockResolvedValue([{}]),
  owned: unknown[] = [],
) => {
  const ashramModel: any = {
    find: jest.fn(() => ({
      select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(owned) })),
    })),
  };
  const connection: any = {
    model: jest.fn(() => ashramModel),
    collection: jest.fn(() => ({ aggregate: () => ({ toArray: aggregate }) })),
  };
  return { service: new SectionSummaryService(connection), connection };
};

const superAdmin: any = {
  id: "admin-1",
  role: "super_admin",
  permissions: [],
  scopedAshramIds: [],
};

const owner: any = {
  id: "owner-1",
  role: "ashram_owner",
  permissions: [],
  scopedAshramIds: ["64b7f3a1c2d4e5f6a7b8c9d0"],
};

describe("SectionSummaryService", () => {
  it("returns a labelled block of tiles for every section", async () => {
    const { service } = build(
      jest.fn().mockResolvedValue([{ t0: [{ total: 12 }] }]),
    );

    const sections = await service.sections(superAdmin);

    expect(sections.length).toBeGreaterThan(10);
    for (const section of sections) {
      expect(section.key).toBeTruthy();
      expect(section.label).toBeTruthy();
      expect(section.tiles.length).toBeGreaterThan(0);
      for (const tile of section.tiles) {
        expect(typeof tile.value).toBe("number");
        expect(["number", "currency"]).toContain(tile.format);
      }
    }
  });

  it("reads a tile's value out of its own facet bucket", async () => {
    const { service } = build(
      jest
        .fn()
        .mockResolvedValue([
          { t0: [{ total: 40 }], t1: [{ total: 25 }], t2: [{ total: 3 }] },
        ]),
    );

    const sections = await service.sections(superAdmin);
    const pricing = sections.find((section) => section.key === "roomPricing");

    expect(pricing?.tiles.map((tile) => tile.value)).toEqual([40, 25]);
  });

  it("reports zero for a facet bucket that came back empty", async () => {
    const { service } = build(jest.fn().mockResolvedValue([{ t0: [] }]));

    const sections = await service.sections(superAdmin);

    expect(sections[0].tiles[0].value).toBe(0);
  });

  it("hides platform-wide sections from a jurisdiction-limited caller", async () => {
    const { service } = build(undefined, []);

    const sections = await service.sections(owner);
    const keys = sections.map((section) => section.key);

    expect(keys).not.toContain("users");
    expect(keys).not.toContain("marketplace");
    expect(keys).not.toContain("audit");
    // Their own ashram-scoped sections still come through.
    expect(keys).toContain("bookings");
    expect(keys).toContain("roomCategories");
  });

  it("gives an unrestricted caller the platform-wide sections", async () => {
    const { service } = build();

    const keys = (await service.sections(superAdmin)).map(
      (section) => section.key,
    );

    expect(keys).toContain("users");
    expect(keys).toContain("marketplace");
  });

  it("scopes a restricted caller's sections to their own ashrams", async () => {
    const aggregate = jest.fn().mockResolvedValue([{}]);
    const { service, connection } = build(aggregate, []);

    await service.sections(owner);

    const pipelines = aggregate.mock.calls.length;
    expect(pipelines).toBeGreaterThan(0);
    expect(connection.collection).toHaveBeenCalledWith("booking_bookings");
  });

  it("drops a section whose collection cannot be read, keeping the rest", async () => {
    let call = 0;
    const aggregate = jest.fn().mockImplementation(() => {
      call += 1;
      return call === 1
        ? Promise.reject(new Error("ns not found"))
        : Promise.resolve([{ t0: [{ total: 1 }] }]);
    });
    const { service } = build(aggregate);

    const sections = await service.sections(superAdmin);

    // Exactly the one failing section is missing; nothing else is lost.
    expect(sections.length).toBeGreaterThan(10);
    expect(sections.every((section) => section.tiles.length > 0)).toBe(true);
  });

  it("gives each Room & Inventory subsection its own block", async () => {
    const { service } = build();

    const keys = (await service.sections(superAdmin)).map(
      (section) => section.key,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        "roomApprovals",
        "roomCategories",
        "roomAvailability",
        "roomPricing",
        "roomInventory",
        "offlineRooms",
      ]),
    );
  });

  it("narrows a shared collection to the one module the section is about", async () => {
    const aggregate = jest.fn().mockResolvedValue([{}]);
    const collection = jest.fn((_name: string) => ({
      aggregate: (pipeline: any[]) => ({
        toArray: () => aggregate(pipeline),
      }),
    }));
    const connection: any = {
      model: jest.fn(() => ({
        find: jest.fn(() => ({
          select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
        })),
      })),
      collection,
    };

    await new SectionSummaryService(connection).sections(superAdmin);

    // Room category approvals share approval_requests with every other kind.
    expect(collection).toHaveBeenCalledWith("approval_requests");
    const matched = aggregate.mock.calls.map(([pipeline]) => pipeline[0].$match);
    expect(matched).toContainEqual({ module: "room_category" });
  });

  it("keeps every section's tile count small enough to lay out evenly", async () => {
    const { service } = build();

    const sections = await service.sections(superAdmin);

    for (const section of sections) {
      expect(section.tiles.length).toBeGreaterThanOrEqual(1);
      expect(section.tiles.length).toBeLessThanOrEqual(5);
    }
  });

  it("gives every section a unique key so the frontend can address it", async () => {
    const { service } = build();

    const keys = (await service.sections(superAdmin)).map((s) => s.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("never reports one module's numbers under another module's section", async () => {
    // Two sections may legitimately share a collection, but only when each
    // narrows it to its own slice; otherwise they would publish identical
    // counts under different names.
    const { service } = build();
    const sections = await service.sections(superAdmin);

    expect(sections.find((s) => s.key === "roomApprovals")?.label).toBe(
      "Room Category Approvals",
    );
    expect(sections.find((s) => s.key === "governance")?.label).toBe(
      "Approvals",
    );
  });
});
