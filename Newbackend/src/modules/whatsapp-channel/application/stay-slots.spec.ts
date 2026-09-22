import {
  formatDateTime,
  isoDateToUtcMidnight,
  mergeStaySlots,
  nextMissingStaySlot,
  staySlotsComplete,
} from "./stay-slots";

describe("merging slots — never lose what is already known", () => {
  it("merges a fresh fact onto an empty state", () => {
    expect(mergeStaySlots({}, { location: "Vrindavan" })).toEqual({
      location: "Vrindavan",
    });
  });

  it("keeps every previously known slot when a message adds only one more", () => {
    // This is the direct fix for the reported bug: "4 baje" (message 2)
    // must not erase "kal" (message 1)'s checkInDate.
    const afterMessage1 = mergeStaySlots({}, { checkInDate: "2026-09-17" });
    const afterMessage2 = mergeStaySlots(afterMessage1, { checkInTime: "16:00" });
    const afterMessage3 = mergeStaySlots(afterMessage2, {
      checkOutDate: "2026-09-18",
      checkOutTime: "11:00",
    });
    expect(afterMessage3).toMatchObject({
      checkInDate: "2026-09-17",
      checkInTime: "16:00",
      checkOutDate: "2026-09-18",
      checkOutTime: "11:00",
    });
  });

  it("lets a later message overwrite an earlier value — a correction", () => {
    const withTomorrow = mergeStaySlots({}, { checkInDate: "2026-09-17" });
    const corrected = mergeStaySlots(withTomorrow, { checkInDate: "2026-09-18" });
    expect(corrected.checkInDate).toBe("2026-09-18");
  });

  it("corrects a time the same way", () => {
    const state = mergeStaySlots({ checkOutTime: "11:00" }, { checkOutTime: "12:00" });
    expect(state.checkOutTime).toBe("12:00");
  });

  it("corrects a location the same way", () => {
    const state = mergeStaySlots({ location: "Vrindavan" }, { location: "Mathura" });
    expect(state.location).toBe("Mathura");
  });

  it("corrects a guest count the same way", () => {
    const state = mergeStaySlots({ guests: 2 }, { guests: 3 });
    expect(state.guests).toBe(3);
  });

  it("does not clear dates or guests when only the location changes", () => {
    // Item 14: "location change karke Mathura kar do" must not wipe dates.
    const state = mergeStaySlots(
      {
        location: "Vrindavan",
        checkInDate: "2026-09-17",
        checkInTime: "16:00",
        checkOutDate: "2026-09-18",
        checkOutTime: "11:00",
        guests: 2,
      },
      { location: "Mathura" },
    );
    expect(state).toMatchObject({
      location: "Mathura",
      checkInDate: "2026-09-17",
      checkInTime: "16:00",
      checkOutDate: "2026-09-18",
      checkOutTime: "11:00",
      guests: 2,
    });
  });

  it("clears a previously chosen ashram/room when the location actually changes", () => {
    // A specific property picked for Vrindavan is not a property in Mathura.
    const state = mergeStaySlots(
      { location: "Vrindavan", ashramId: "ashram-1", roomId: "room-1" },
      { location: "Mathura" },
    );
    expect(state.ashramId).toBeUndefined();
    expect(state.roomId).toBeUndefined();
  });

  it("keeps the chosen ashram when the location is re-stated unchanged", () => {
    const state = mergeStaySlots(
      { location: "Vrindavan", ashramId: "ashram-1" },
      { location: "Vrindavan" },
    );
    expect(state.ashramId).toBe("ashram-1");
  });

  it("ignores undefined fields rather than overwriting with them", () => {
    const state = mergeStaySlots({ location: "Vrindavan" }, { guests: 2 });
    expect(state.location).toBe("Vrindavan");
    expect(state.guests).toBe(2);
  });
});

describe("which slot to ask for next", () => {
  it("asks for location first", () => {
    expect(nextMissingStaySlot({})).toBe("location");
  });

  it("asks in the documented order: location, check-in date, checkout date, guests", () => {
    let state = {};
    const order = ["location", "checkInDate", "checkOutDate", "guests"] as const;
    for (const slot of order) {
      expect(nextMissingStaySlot(state)).toBe(slot);
      state = { ...state, [slot]: slot === "guests" ? 2 : "2026-09-17" };
    }
    expect(nextMissingStaySlot(state)).toBeNull();
  });

  it("never blocks on a clock time — the website's own booking has no such field", () => {
    // BookingSchema has no check-in/check-out time; asking for one would
    // invent a requirement the existing booking architecture does not have.
    expect(
      nextMissingStaySlot({
        location: "Vrindavan",
        checkInDate: "2026-09-17",
        checkOutDate: "2026-09-18",
        guests: 2,
      }),
    ).toBeNull();
  });

  it("is complete once the required slots are filled, with or without a time", () => {
    expect(
      staySlotsComplete({
        location: "Vrindavan",
        checkInDate: "2026-09-17",
        checkInTime: "16:00",
        checkOutDate: "2026-09-18",
        checkOutTime: "11:00",
        guests: 2,
      }),
    ).toBe(true);
    expect(
      staySlotsComplete({
        location: "Vrindavan",
        checkInDate: "2026-09-17",
        checkOutDate: "2026-09-18",
        guests: 2,
      }),
    ).toBe(true);
    expect(staySlotsComplete({ location: "Vrindavan" })).toBe(false);
  });
});

describe("date/time formatting", () => {
  it("reads the calendar date back out at UTC midnight", () => {
    expect(isoDateToUtcMidnight("2026-09-17").toISOString()).toBe(
      "2026-09-17T00:00:00.000Z",
    );
  });

  it("formats a date and time together for a guest-facing summary", () => {
    expect(formatDateTime("2026-09-22", "16:00")).toBe("22 Sept, 4 PM");
    expect(formatDateTime("2026-09-23", "11:00")).toBe("23 Sept, 11 AM");
    expect(formatDateTime("2026-09-23", "00:00")).toBe("23 Sept, 12 AM");
    expect(formatDateTime("2026-09-23", "12:00")).toBe("23 Sept, 12 PM");
  });
});
