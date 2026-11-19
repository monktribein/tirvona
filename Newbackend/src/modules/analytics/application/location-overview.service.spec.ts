import { LocationOverviewService } from "./location-overview.service";

const rows = (data: unknown[]) => ({
  find: () => ({ select: () => ({ lean: async () => data }) }),
});

const build = (data: Record<string, unknown[]>, failing: string[] = []) => {
  const connection = {
    model: (name: string) => {
      if (failing.includes(name)) throw new Error("boom");
      return rows(data[name] ?? []);
    },
  };
  return new LocationOverviewService(connection as never, rows(data.Lead ?? []) as never);
};

describe("LocationOverviewService", () => {
  it("counts by district and folds Vrindavan and other Mathura towns into Mathura", async () => {
    const service = build({
      Ashram: [
        { address: { city: "Haridwar", district: "Haridwar" } },
        { address: { city: "haridwar " } },
        { address: { city: "Vrindavan", district: "Mathura" } },
        { address: { city: "Goverdhan" } },
      ],
      Temple: [{ address: { city: "Haridwar" } }],
      ProviderProfile: [{ homeCity: "Mathura" }, { homeCity: "Matura" }],
      Lead: [{ location: { city: "Haridwar" } }, { location: { city: "Barsana", district: "Mathura" } }],
      FoodOutlet: [
        { vendorId: "v1", address: "Har Ki Pauri, Haridwar" },
        { vendorId: "v1", address: "Station Road, Haridwar" },
        { vendorId: "v2", address: "Raman Reti, Vrindaban" },
      ],
    });

    const { locations, unplaced } = await service.overview();
    expect(locations.map((l) => l.label).sort()).toEqual(["Haridwar", "Mathura"]);
    expect(locations.find((l) => l.label === "Haridwar")).toMatchObject({
      stays: 2, temples: 1, pandits: 0, restaurants: 1, leads: 1, total: 5,
    });
    expect(locations.find((l) => l.label === "Mathura")).toMatchObject({
      stays: 2, temples: 0, pandits: 2, restaurants: 1, leads: 1, total: 6,
    });
    expect(unplaced).toEqual({ stays: 0, temples: 0, pandits: 0, restaurants: 0, leads: 0 });
  });

  it("does not make a card for a city that is not a district, it reports it instead", async () => {
    const { locations, unplaced } = await build({
      Ashram: [{ address: { city: "Ujjain" } }, { address: { city: "8239063225" } }, { address: {} }],
      FoodOutlet: [{ vendorId: "v9", address: "Somewhere unknown" }],
    }).overview();
    expect(locations).toEqual([]);
    expect(unplaced.stays).toBe(3);
    expect(unplaced.restaurants).toBe(1);
  });

  it("keeps the other districts when one collection cannot be read", async () => {
    const { locations } = await build({ Ashram: [{ address: { city: "Haridwar" } }] }, ["Temple"]).overview();
    expect(locations[0]).toMatchObject({ label: "Haridwar", stays: 1, temples: 0 });
  });
});
