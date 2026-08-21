import {
  addDays,
  circuitSlug,
  groupStopsByDay,
  totalDistance,
} from "./pilgrimage.utils";

describe("groupStopsByDay", () => {
  const stops = [
    { name: "Har Ki Pauri", dayNumber: 1, order: 1 },
    { name: "Mansa Devi", dayNumber: 1, order: 0 },
    { name: "Rishikesh", dayNumber: 3, order: 0 },
  ];

  it("orders stops within a day by their explicit order", () => {
    const days = groupStopsByDay(stops, 3);
    expect(days[0].stops.map((stop) => stop.name)).toEqual([
      "Mansa Devi",
      "Har Ki Pauri",
    ]);
  });

  it("keeps empty days so the itinerary spans the full duration", () => {
    const days = groupStopsByDay(stops, 3);
    expect(days).toHaveLength(3);
    expect(days[1].stops).toHaveLength(0);
    expect(days[1].dayNumber).toBe(2);
  });

  it("never returns zero days, even for a malformed duration", () => {
    expect(groupStopsByDay([], 0)).toHaveLength(1);
    expect(groupStopsByDay([], -5)).toHaveLength(1);
  });

  it("drops stops assigned beyond the duration rather than mis-placing them", () => {
    const days = groupStopsByDay(stops, 2);
    expect(days).toHaveLength(2);
    expect(days.flatMap((day) => day.stops)).toHaveLength(2);
  });

  it("treats a stop with no day as day one", () => {
    const days = groupStopsByDay<{
      name: string;
      dayNumber?: number;
      order?: number;
    }>([{ name: "Unassigned" }], 2);
    expect(days[0].stops).toHaveLength(1);
  });
});

describe("totalDistance", () => {
  it("sums the leg distances and rounds", () => {
    expect(
      totalDistance([
        { distanceFromPreviousKm: 12.4 },
        { distanceFromPreviousKm: 30.2 },
        { distanceFromPreviousKm: 7.9 },
      ]),
    ).toBe(51);
  });

  it("treats a missing leg distance as zero", () => {
    expect(totalDistance([{}, { distanceFromPreviousKm: 10 }])).toBe(10);
    expect(totalDistance([])).toBe(0);
  });
});

describe("addDays", () => {
  it("advances a date by whole days", () => {
    expect(addDays("2026-03-14T00:00:00.000Z", 3).toISOString()).toBe(
      "2026-03-17T00:00:00.000Z",
    );
  });

  it("handles a zero offset and a month boundary", () => {
    expect(addDays("2026-03-14T00:00:00.000Z", 0).toISOString()).toBe(
      "2026-03-14T00:00:00.000Z",
    );
    expect(addDays("2026-03-30T00:00:00.000Z", 3).toISOString()).toBe(
      "2026-04-02T00:00:00.000Z",
    );
  });
});

describe("circuitSlug", () => {
  it("builds a readable, unique slug from name and start city", () => {
    expect(circuitSlug("Char Dham Yatra", "Haridwar")).toMatch(
      /^char-dham-yatra-haridwar-[0-9a-z]{4}$/,
    );
  });

  it("never produces an empty slug", () => {
    expect(circuitSlug("!!!", "")).toMatch(/^circuit-[0-9a-z]{4}$/);
  });
});
