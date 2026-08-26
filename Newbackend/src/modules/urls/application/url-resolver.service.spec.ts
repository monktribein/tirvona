import { UrlResolverService, isObjectIdLike } from "./url-resolver.service";

const build = (stored: Record<string, string> = {}) => {
  const writes: any[] = [];
  const model = {
    findOne: jest.fn((filter: any) => ({
      lean: jest.fn().mockResolvedValue(
        stored[filter.fromPath]
          ? { fromPath: filter.fromPath, toPath: stored[filter.fromPath] }
          : null,
      ),
    })),
    updateOne: jest.fn(async (filter: any, update: any) => {
      writes.push({ kind: "one", filter, update });
      return {};
    }),
    updateMany: jest.fn(async (filter: any, update: any) => {
      writes.push({ kind: "many", filter, update });
      return {};
    }),
  };
  return { service: new UrlResolverService(model as never), writes, model };
};

describe("legacy url resolution", () => {
  it("resolves a stored redirect to its current path", async () => {
    const { service } = build({
      "/ashram/68a1f0c2d3e4f5a6b7c8d9e0": "/ashrams/haridwar/saptrishi-ashram",
    });
    expect(await service.resolve("/ashram/68a1f0c2d3e4f5a6b7c8d9e0")).toBe(
      "/ashrams/haridwar/saptrishi-ashram",
    );
  });

  it("ignores casing, query strings, hashes and trailing slashes", async () => {
    const { service } = build({
      "/ashram/abc": "/ashrams/haridwar/saptrishi-ashram",
    });
    for (const variant of [
      "/Ashram/ABC",
      "/ashram/abc/",
      "/ashram/abc?utm_source=x",
      "/ashram/abc#top",
    ])
      expect(await service.resolve(variant)).toBe(
        "/ashrams/haridwar/saptrishi-ashram",
      );
  });

  it("returns null for an unknown path so the caller can answer 404", async () => {
    const { service } = build();
    expect(await service.resolve("/ashram/does-not-exist")).toBeNull();
  });

  it("never resolves the site root", async () => {
    const { service } = build();
    expect(await service.resolve("/")).toBeNull();
  });

  it("falls back to a registered module resolver and remembers the result", async () => {
    const { service, writes } = build();
    service.register({
      pattern: /^\/ashram\/([0-9a-f]{24})$/,
      resolve: async (match) =>
        `/ashrams/haridwar/ashram-${match[1].slice(0, 4)}`,
    });

    const target = await service.resolve(
      "/ashram/68a1f0c2d3e4f5a6b7c8d9e0",
    );
    expect(target).toBe("/ashrams/haridwar/ashram-68a1");
    // the mapping is cached so the next hit is a single lookup
    expect(writes.some((w) => w.kind === "one")).toBe(true);
  });

  it("does not redirect a path to itself", async () => {
    const { service } = build();
    service.register({
      pattern: /^\/same$/,
      resolve: async () => "/same",
    });
    expect(await service.resolve("/same")).toBeNull();
  });

  it("repoints stale redirects so a renamed entity cannot loop", async () => {
    const { service, writes } = build();
    await service.remember({
      fromPath: "/ashrams/haridwar/old-name",
      toPath: "/ashrams/haridwar/new-name",
      entityType: "ashram",
    });
    const repoint = writes.find((w) => w.kind === "many");
    expect(repoint.filter.toPath).toBe("/ashrams/haridwar/old-name");
    expect(repoint.update.$set.toPath).toBe("/ashrams/haridwar/new-name");
  });

  it("skips recording a redirect that points at itself", async () => {
    const { service, writes } = build();
    await service.remember({
      fromPath: "/ashrams/haridwar/same",
      toPath: "/ashrams/haridwar/same",
      entityType: "ashram",
    });
    expect(writes).toHaveLength(0);
  });
});

describe("isObjectIdLike", () => {
  it("recognises a mongo id and rejects a slug", () => {
    expect(isObjectIdLike("68a1f0c2d3e4f5a6b7c8d9e0")).toBe(true);
    expect(isObjectIdLike("saptrishi-ashram")).toBe(false);
  });
});
