import { ConflictException, NotFoundException } from "@nestjs/common";
import { BookingIdentityService } from "./booking-identity.service";
import { MAX_PROPERTY_SEQUENCE } from "../domain/identity-code";

const counterModel = (seed: Record<string, number> = {}) => {
  const state = new Map<string, number>(Object.entries(seed));
  return {
    state,
    findOneAndUpdate: jest.fn(async ({ _id }: { _id: string }) => {
      const next = (state.get(_id) ?? 0) + 1;
      state.set(_id, next);
      return { sequence: next };
    }),
  };
};

const propertyModel = () => {
  const rows: any[] = [];
  return {
    rows,
    findOne: jest.fn(({ ashramId }: { ashramId: string }) => ({
      lean: async () => rows.find((r) => String(r.ashramId) === String(ashramId)) ?? null,
    })),
    create: jest.fn(async (doc: any) => {
      if (rows.some((r) => String(r.ashramId) === String(doc.ashramId))) {
        const error: any = new Error("E11000 duplicate key");
        error.code = 11000;
        throw error;
      }
      const row = { ...doc, issuedAt: new Date() };
      rows.push(row);
      return { toObject: () => row };
    }),
  };
};

const ashramModel = (ashram: any) => ({
  findById: jest.fn(() => ({
    select: () => ({ lean: async () => ashram }),
  })),
});

const build = (ashram: any, seed?: Record<string, number>) => {
  const properties = propertyModel();
  const counters = counterModel(seed);
  const ashrams = ashramModel(ashram);
  const service = new BookingIdentityService(
    properties as any,
    counters as any,
    ashrams as any,
  );
  return { service, properties, counters, ashrams };
};

const BRAJ_ASHRAM = {
  ashramType: "Ashram",
  address: { city: "Vrindavan", district: "Mathura" },
};

describe("BookingIdentityService — property registration", () => {
  it("registers a property on first use and derives its code from the address", async () => {
    const { service } = build(BRAJ_ASHRAM);

    const identity = await service.ensurePropertyIdentity("ashram-1");

    expect(identity).toMatchObject({
      clusterCode: "BC",
      propertyTypeCode: "AG",
      propertySequence: 1,
      propertyCode: "BCAG-00001",
    });
  });

  it("is idempotent — a second call reissues nothing", async () => {
    const { service, counters, properties } = build(BRAJ_ASHRAM);

    const first = await service.ensurePropertyIdentity("ashram-1");
    const second = await service.ensurePropertyIdentity("ashram-1");

    expect(second.propertyCode).toBe(first.propertyCode);
    expect(properties.rows).toHaveLength(1);
    expect(counters.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("numbers properties sequentially within a cluster/type register", async () => {
    const { service } = build(BRAJ_ASHRAM);

    const codes = [];
    for (const id of ["a", "b", "c"])
      codes.push((await service.ensurePropertyIdentity(id)).propertyCode);

    expect(codes).toEqual(["BCAG-00001", "BCAG-00002", "BCAG-00003"]);
  });

  it("keeps each cluster/type register on its own sequence", async () => {
    const braj = build(BRAJ_ASHRAM);
    const haridwar = build({
      ashramType: "Dharamshala",
      address: { city: "Haridwar", district: "Haridwar" },
    });

    expect((await braj.service.ensurePropertyIdentity("a")).propertyCode).toBe(
      "BCAG-00001",
    );
    expect(
      (await haridwar.service.ensurePropertyIdentity("b")).propertyCode,
    ).toBe("HCDG-00001");
  });

  it("survives a concurrent first registration without duplicating", async () => {
    const { service, properties } = build(BRAJ_ASHRAM);

    const [first, second] = await Promise.all([
      service.ensurePropertyIdentity("ashram-1"),
      service.ensurePropertyIdentity("ashram-1"),
    ]);

    expect(properties.rows).toHaveLength(1);
    expect(first.propertyCode).toBe(second.propertyCode);
  });

  it("refuses to register a property that does not exist", async () => {
    const { service } = build(null);

    await expect(service.ensurePropertyIdentity("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("refuses to overflow the five-digit register", async () => {
    const { service } = build(BRAJ_ASHRAM, {
      "property:BC:AG": MAX_PROPERTY_SEQUENCE,
    });

    await expect(service.ensurePropertyIdentity("ashram-1")).rejects.toThrow(
      ConflictException,
    );
  });
});

describe("BookingIdentityService — booking codes", () => {
  it("issues the first visitor code as A1001", async () => {
    const { service } = build(BRAJ_ASHRAM);

    expect(await service.issueForBooking("ashram-1")).toBe(
      "BCAG-00001-A1001",
    );
  });

  it("increments the visitor half and holds the property half fixed", async () => {
    const { service } = build(BRAJ_ASHRAM);

    expect(await service.issueForBooking("ashram-1")).toBe("BCAG-00001-A1001");
    expect(await service.issueForBooking("ashram-1")).toBe("BCAG-00001-A1002");
    expect(await service.issueForBooking("ashram-1")).toBe("BCAG-00001-A1003");
  });

  it("counts visitors per property, not platform-wide", async () => {
    const { service } = build(BRAJ_ASHRAM);

    await service.issueForBooking("ashram-1");
    await service.issueForBooking("ashram-1");

    expect(await service.issueForBooking("ashram-2")).toBe("BCAG-00002-A1001");
  });

  it("issues no code twice under concurrency", async () => {
    const { service } = build(BRAJ_ASHRAM);

    const codes = await Promise.all(
      Array.from({ length: 200 }, () => service.issueForBooking("ashram-1")),
    );

    expect(new Set(codes).size).toBe(200);
  });

  it("rolls the visitor letter over at the block boundary", async () => {
    const { service, counters } = build(BRAJ_ASHRAM);
    await service.ensurePropertyIdentity("ashram-1");
    counters.state.set("visitor:BCAG-00001", 8998);

    expect(await service.issueForBooking("ashram-1")).toBe("BCAG-00001-A9999");
    expect(await service.issueForBooking("ashram-1")).toBe("BCAG-00001-B1001");
  });

  it("refuses once a property has exhausted A1001–Z9999", async () => {
    const { service, counters } = build(BRAJ_ASHRAM);
    await service.ensurePropertyIdentity("ashram-1");
    counters.state.set("visitor:BCAG-00001", 233_974);

    await expect(service.issueForBooking("ashram-1")).rejects.toThrow(
      ConflictException,
    );
  });
});
