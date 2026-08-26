import { LegacyUrlService } from "./legacy-url.service";

const lean = (row: unknown) => ({
  select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(row) })),
});

const build = (rows: {
  booking?: any;
  ashram?: any;
  aarti?: any;
  parking?: any;
  product?: any;
  volunteer?: any;
  offer?: any;
  parkingBooking?: any;
  aartiBooking?: any;
  eventPass?: any;
  banner?: any;
}) => {
  const registered: any[] = [];
  const urls = { register: jest.fn((r: any) => registered.push(r)) };
  const service = new LegacyUrlService(
    urls as never,
    { findById: jest.fn(() => lean(rows.booking)) } as never,
    { findById: jest.fn(() => lean(rows.ashram)) } as never,
    { findById: jest.fn(() => lean(rows.aarti)) } as never,
    { findById: jest.fn(() => lean(rows.parking)) } as never,
    { findOne: jest.fn(() => lean(rows.product)) } as never,
    { findById: jest.fn(() => lean(rows.volunteer)) } as never,
    { findById: jest.fn(() => lean(rows.offer)) } as never,
    { findById: jest.fn(() => lean(rows.parkingBooking)) } as never,
    { findById: jest.fn(() => lean(rows.aartiBooking)) } as never,
    { findById: jest.fn(() => lean(rows.eventPass)) } as never,
    { findById: jest.fn(() => lean(rows.banner)) } as never,
  );
  service.onModuleInit();
  return { registered };
};

const ID = "68a1f0c2d3e4f5a6b7c8d9e0";
const ASHRAM = {
  _id: "a1",
  slug: "sapt-rishi-ashram",
  citySlug: "haridwar",
  address: { city: "Haridwar" },
};

/** Runs the registered resolver whose pattern matches the path. */
const run = async (registered: any[], path: string) => {
  for (const resolver of registered) {
    const match = path.match(resolver.pattern);
    if (match) return resolver.resolve(match);
  }
  return undefined;
};

describe("legacy url resolvers", () => {
  it("maps a booking id to its human reference", async () => {
    const { registered } = build({
      booking: { bookingId: "TRV-MT1Q1B9W-B56C6" },
    });
    expect(await run(registered, `/booking/${ID}`)).toBe(
      "/booking/TRV-MT1Q1B9W-B56C6",
    );
  });

  it("maps an aarti session id to its ashram's city and slug", async () => {
    const { registered } = build({ aarti: { ashramId: "a1" }, ashram: ASHRAM });
    expect(await run(registered, `/aarti/${ID}`)).toBe(
      "/aarti/haridwar/sapt-rishi-ashram",
    );
  });

  it("maps a pooja id the same way", async () => {
    const { registered } = build({ aarti: { ashramId: "a1" }, ashram: ASHRAM });
    expect(await run(registered, `/pooja/${ID}`)).toBe(
      "/pooja/haridwar/sapt-rishi-ashram",
    );
  });

  it("maps parking to the owning ashram when there is one", async () => {
    const { registered } = build({
      parking: { slug: "prem-parking", ashramId: "a1" },
      ashram: ASHRAM,
    });
    expect(await run(registered, `/parking/${ID}`)).toBe(
      "/parking/haridwar/sapt-rishi-ashram",
    );
  });

  it("falls back to the parking location's own slug when it has no ashram", async () => {
    const { registered } = build({
      parking: { slug: "kashi-corridor-parking", ashramId: null },
    });
    expect(await run(registered, `/parking/${ID}`)).toBe(
      "/parking/kashi-corridor-parking",
    );
  });

  it("moves a marketplace product to the plural slug url", async () => {
    const { registered } = build({ product: { slug: "ganga-arti-prasad" } });
    expect(await run(registered, `/marketplace/product/${ID}`)).toBe(
      "/marketplace/products/ganga-arti-prasad",
    );
    expect(await run(registered, "/marketplace/product/ganga-arti-prasad")).toBe(
      "/marketplace/products/ganga-arti-prasad",
    );
  });

  it("returns null when the entity is gone so the caller can 404", async () => {
    const { registered } = build({});
    expect(await run(registered, `/booking/${ID}`)).toBeNull();
    expect(await run(registered, `/aarti/${ID}`)).toBeNull();
    expect(await run(registered, `/marketplace/product/${ID}`)).toBeNull();
  });

  it("maps an offer id to its promo code", async () => {
    const { registered } = build({ offer: { promoCode: "MONSOON25" } });
    expect(await run(registered, `/offers/${ID}`)).toBe("/offers/monsoon25");
  });

  it("maps a volunteer job id to its slug, with or without /job", async () => {
    const { registered } = build({ volunteer: { slug: "kitchen-seva" } });
    expect(await run(registered, `/volunteer/${ID}`)).toBe(
      "/volunteer/kitchen-seva",
    );
    expect(await run(registered, `/volunteer/job/${ID}`)).toBe(
      "/volunteer/kitchen-seva",
    );
  });

  it("maps parking and aarti booking ids to their references", async () => {
    const { registered } = build({
      parkingBooking: { bookingReference: "PRK-9931" },
      aartiBooking: { bookingReference: "ART-4410" },
    });
    expect(await run(registered, `/parking/booking/${ID}`)).toBe(
      "/parking/booking/PRK-9931",
    );
    expect(await run(registered, `/aarti/booking/${ID}`)).toBe(
      "/aarti/booking/ART-4410",
    );
  });

  it("maps a profile booking id to its reference", async () => {
    const { registered } = build({ booking: { bookingId: "TRV-ABC" } });
    expect(await run(registered, `/profile/bookings/${ID}`)).toBe(
      "/profile/bookings/TRV-ABC",
    );
  });

  it("maps an event pass id to its display code", async () => {
    const { registered } = build({ eventPass: { displayCode: "EVT-77213" } });
    expect(await run(registered, `/events/pass/${ID}`)).toBe(
      "/events/pass/EVT-77213",
    );
  });

  it("maps a featured banner id to its slug", async () => {
    const { registered } = build({ banner: { slug: "kumbh-mela-2027" } });
    expect(await run(registered, `/featured-banner/${ID}`)).toBe(
      "/featured-banner/kumbh-mela-2027",
    );
  });

  it("ignores paths that are already in slug form", async () => {
    const { registered } = build({ product: { slug: "x" } });
    expect(
      await run(registered, "/ashrams/haridwar/sapt-rishi-ashram"),
    ).toBeUndefined();
    expect(await run(registered, "/booking/TRV-MT1Q1B9W-B56C6")).toBeUndefined();
  });
});
