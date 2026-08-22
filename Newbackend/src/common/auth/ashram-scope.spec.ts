import { ForbiddenException } from "@nestjs/common";
import {
  ashramScopeFilter,
  assertAshramInScope,
  narrowRequestedAshrams,
  resolveAshramScope,
  scopeContains,
} from "./ashram-scope";

const ashramsModel = (owned: string[] = []) =>
  ({
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(owned.map((id) => ({ _id: id }))),
      }),
    }),
  }) as never;

const user = (over: Record<string, unknown> = {}) =>
  ({
    id: "user-1",
    role: "customer",
    name: "Test",
    permissions: [],
    scopedAshramIds: [],
    ...over,
  }) as never;

describe("resolveAshramScope", () => {
  it("leaves super admin unrestricted", async () => {
    const scope = await resolveAshramScope(
      user({ role: "super_admin" }),
      ashramsModel(),
    );
    expect(scope).toBeNull();
  });

  it("leaves ashram admin unrestricted", async () => {
    const scope = await resolveAshramScope(
      user({ role: "ashram_admin" }),
      ashramsModel(),
    );
    expect(scope).toBeNull();
  });

  it("scopes an assigned owner to the ashram they were assigned", async () => {
    const scope = await resolveAshramScope(
      user({ role: "ashram_owner", employerAshramId: "ashram-a" }),
      ashramsModel([]),
    );
    expect(scope).toEqual(["ashram-a"]);
  });

  it("unions assigned ashrams with ashrams the owner holds the record for", async () => {
    const scope = await resolveAshramScope(
      user({
        role: "ashram_owner",
        employerAshramId: "ashram-a",
        scopedAshramIds: ["ashram-b"],
      }),
      ashramsModel(["ashram-c"]),
    );
    expect([...(scope as string[])].sort()).toEqual([
      "ashram-a",
      "ashram-b",
      "ashram-c",
    ]);
  });

  it("denies by default when nothing is assigned", async () => {
    const scope = await resolveAshramScope(
      user({ role: "manager" }),
      ashramsModel(),
    );
    expect(scope).toEqual([]);
  });
});

describe("scope enforcement", () => {
  it("blocks an ashram outside the scope", () => {
    expect(scopeContains(["ashram-a"], "ashram-b")).toBe(false);
    expect(() => assertAshramInScope(["ashram-a"], "ashram-b")).toThrow(
      ForbiddenException,
    );
  });

  it("accepts a populated ashram document as well as a raw id", () => {
    expect(scopeContains(["ashram-a"], { _id: "ashram-a" })).toBe(true);
  });

  it("never lets an empty scope match anything", () => {
    expect(scopeContains([], "ashram-a")).toBe(false);
    expect(scopeContains([], null)).toBe(false);
    expect(scopeContains([], undefined)).toBe(false);
  });

  it("builds a filter that restricts a query to the scope", () => {
    expect(ashramScopeFilter(["ashram-a"])).toEqual({
      ashramId: { $in: ["ashram-a"] },
    });
    expect(ashramScopeFilter(null)).toEqual({});
    expect(ashramScopeFilter([], "ashram")).toEqual({ ashram: { $in: [] } });
  });
});

describe("narrowRequestedAshrams", () => {
  it("rejects a request for an ashram outside the scope", () => {
    expect(() => narrowRequestedAshrams(["ashram-a"], ["ashram-b"])).toThrow(
      ForbiddenException,
    );
  });

  it("keeps only the requested ashrams that are in scope", () => {
    expect(
      narrowRequestedAshrams(["ashram-a", "ashram-b"], ["ashram-b"]),
    ).toEqual(["ashram-b"]);
  });

  it("falls back to the full scope when nothing specific is requested", () => {
    expect(narrowRequestedAshrams(["ashram-a"], undefined)).toEqual([
      "ashram-a",
    ]);
  });

  it("lets an unrestricted caller ask for a specific ashram", () => {
    expect(narrowRequestedAshrams(null, ["ashram-z"])).toEqual(["ashram-z"]);
    expect(narrowRequestedAshrams(null, undefined)).toBeNull();
  });
});
