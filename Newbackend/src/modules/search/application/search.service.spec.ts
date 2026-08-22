import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { SearchService } from "./search.service";

const asUser = (partial: Partial<AuthenticatedUser>): AuthenticatedUser =>
  ({ id: "u1", role: "customer", ...partial }) as AuthenticatedUser;

const findChain = (rows: unknown[]) => {
  const lean = jest.fn().mockResolvedValue(rows);
  const chain: any = {
    select: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    lean,
  };
  return chain;
};

const createService = (rows: {
  ashrams?: unknown[];
  users?: unknown[];
  bookings?: unknown[];
  parking?: unknown[];
}) => {
  const ashramFind = jest.fn((_filter: any) => findChain(rows.ashrams ?? []));
  const userFind = jest.fn((_filter: any) => findChain(rows.users ?? []));
  const bookingFind = jest.fn((_filter: any) => findChain(rows.bookings ?? []));
  const parkingFind = jest.fn((_filter: any) => findChain(rows.parking ?? []));
  const distinct = jest.fn().mockResolvedValue(["ashram-1"]);
  const service = new SearchService(
    { find: ashramFind, distinct } as never,
    { find: userFind } as never,
    { find: bookingFind } as never,
    { find: parkingFind } as never,
  );
  return { service, ashramFind, userFind, bookingFind, parkingFind, distinct };
};

describe("SearchService scoping", () => {
  it("returns nothing for a term shorter than two characters", async () => {
    const { service, ashramFind } = createService({});

    const result = await service.search(
      asUser({ role: "super_admin" }),
      "a",
      5,
    );

    expect(result.results).toEqual([]);
    expect(ashramFind).not.toHaveBeenCalled();
  });

  it("matches regex metacharacters literally", async () => {
    const { service, ashramFind } = createService({});

    await service.search(asUser({ role: "super_admin" }), "a+(b", 5);

    const filter = ashramFind.mock.calls[0][0] as any;
    const pattern = filter.$or[0].name as RegExp;
    expect(pattern.source).toBe("a\\+\\(b");
    expect(pattern.test("xxa+(byy")).toBe(true);
  });

  it("applies no jurisdiction filter for a super admin", async () => {
    const { service, ashramFind } = createService({});

    await service.search(asUser({ role: "super_admin" }), "ganga", 5);

    const filter = ashramFind.mock.calls[0][0] as any;
    expect(filter["address.state"]).toBeUndefined();
    expect(filter["address.district"]).toBeUndefined();
  });

  it("confines a district officer to their own district", async () => {
    const { service, ashramFind } = createService({});

    await service.search(
      asUser({
        role: "district_officer",
        state: "Uttarakhand",
        district: "Haridwar",
      }),
      "ganga",
      5,
    );

    expect(ashramFind.mock.calls[0][0]).toMatchObject({
      "address.state": "Uttarakhand",
      "address.district": "Haridwar",
    });
  });

  it("returns no ashrams for a district officer with no district assigned", async () => {
    const { service, ashramFind } = createService({
      ashrams: [{ _id: "a1", name: "Leaked Ashram" }],
    });

    const result = await service.search(
      asUser({ role: "district_officer", state: "Uttarakhand" }),
      "ganga",
      5,
    );

    expect(ashramFind).not.toHaveBeenCalled();
    expect(result.results).toEqual([]);
  });

  it("confines an owner to ashrams they own", async () => {
    const { service, ashramFind } = createService({});

    await service.search(asUser({ role: "owner", id: "owner-9" }), "ganga", 5);

    expect(ashramFind.mock.calls[0][0]).toMatchObject({ ownerId: "owner-9" });
  });

  it("confines a manager to their scoped ashrams", async () => {
    const { service, ashramFind } = createService({});

    await service.search(
      asUser({ role: "manager", employerAshramId: "ashram-7" }),
      "ganga",
      5,
    );

    expect(ashramFind.mock.calls[0][0]).toMatchObject({
      _id: { $in: ["ashram-7"] },
    });
  });

  it("does not expose accounts to roles without user administration", async () => {
    const { service, userFind } = createService({
      users: [{ _id: "u9", name: "Someone", email: "someone@example.com" }],
    });

    for (const role of ["owner", "manager", "district_officer", "inspector"]) {
      const result = await service.search(
        asUser({ role, state: "Uttarakhand", district: "Haridwar" }),
        "someone",
        5,
      );
      expect(result.results.some((hit) => hit.type === "user")).toBe(false);
    }
    expect(userFind).not.toHaveBeenCalled();
  });

  it("exposes accounts to a government admin", async () => {
    const { service } = createService({
      users: [
        {
          _id: "u9",
          name: "Asha",
          email: "asha@example.com",
          role: "customer",
        },
      ],
    });

    const result = await service.search(
      asUser({ role: "govt_admin", state: "Uttarakhand" }),
      "asha",
      5,
    );

    expect(result.results).toContainEqual({
      type: "user",
      id: "u9",
      title: "Asha",
      subtitle: "asha@example.com",
      badge: "customer",
      url: "/admin/users?q=asha%40example.com",
    });
  });

  it("keeps parking out of non-platform results", async () => {
    const { service, parkingFind } = createService({
      parking: [{ _id: "p1", name: "Har Ki Pauri Lot", slug: "har-ki-pauri" }],
    });

    const result = await service.search(
      asUser({ role: "owner", id: "owner-9" }),
      "pauri",
      5,
    );

    expect(parkingFind).not.toHaveBeenCalled();
    expect(result.results.some((hit) => hit.type === "parking")).toBe(false);
  });

  it("constrains booking lookups to the visible ashrams", async () => {
    const { service, bookingFind, distinct } = createService({});

    await service.search(
      asUser({ role: "owner", id: "owner-9" }),
      "TRV-123",
      5,
    );

    expect(distinct).toHaveBeenCalledWith("_id", { ownerId: "owner-9" });
    expect(bookingFind.mock.calls[0][0]).toMatchObject({
      ashramId: { $in: ["ashram-1"] },
    });
  });

  it("maps hits into the shape the console renders", async () => {
    const { service } = createService({
      ashrams: [
        {
          _id: "a1",
          name: "Sapt Rishi Ashram",
          status: "approved",
          address: { city: "Haridwar", state: "Uttarakhand" },
        },
      ],
    });

    const result = await service.search(
      asUser({ role: "super_admin" }),
      "sapt",
      5,
    );

    expect(result.results[0]).toEqual({
      type: "ashram",
      id: "a1",
      title: "Sapt Rishi Ashram",
      subtitle: "Haridwar, Uttarakhand",
      badge: "approved",
      url: "/ashram/a1",
    });
    expect(result.total).toBe(1);
  });
});
