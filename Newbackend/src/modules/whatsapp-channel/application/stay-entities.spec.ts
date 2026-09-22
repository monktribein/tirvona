import {
  extractBareHour,
  extractStayEntities,
  extractTime,
  formatTimeToken,
  isDiscoveryPhrasing,
  resolveBareHour,
} from "./nlu";

/** A fixed "now": 10:00 IST, 16 Sep 2026 (Wednesday). */
const NOW = new Date("2026-09-16T04:30:00.000Z");

describe("explicit time parsing", () => {
  it("reads a period word before the hour", () => {
    expect(formatTimeToken(extractTime("Kal shaam 4 baje")!)).toBe("16:00");
    expect(formatTimeToken(extractTime("Kal subah 4 baje")!)).toBe("04:00");
    expect(formatTimeToken(extractTime("subah 10 baje")!)).toBe("10:00");
    expect(formatTimeToken(extractTime("dopahar 2 baje")!)).toBe("14:00");
    expect(formatTimeToken(extractTime("raat 9 baje")!)).toBe("21:00");
  });

  it("reads a period word after the hour", () => {
    expect(formatTimeToken(extractTime("4 baje shaam")!)).toBe("16:00");
    expect(formatTimeToken(extractTime("11 subah")!)).toBe("11:00");
  });

  it("reads an explicit am/pm marker", () => {
    expect(formatTimeToken(extractTime("4 PM")!)).toBe("16:00");
    expect(formatTimeToken(extractTime("4pm")!)).toBe("16:00");
    expect(formatTimeToken(extractTime("11 AM")!)).toBe("11:00");
    expect(formatTimeToken(extractTime("4:30 PM")!)).toBe("16:30");
  });

  it("reads an unambiguous 24-hour hour with no period at all", () => {
    expect(formatTimeToken(extractTime("16:00")!)).toBe("16:00");
    expect(formatTimeToken(extractTime("16 baje")!)).toBe("16:00");
  });

  it("reads noon and midnight", () => {
    expect(formatTimeToken(extractTime("noon")!)).toBe("12:00");
    expect(formatTimeToken(extractTime("midnight")!)).toBe("00:00");
  });

  it("returns nothing for a bare hour with no period cue at all", () => {
    // Explicit parsing must never guess; the bare form is a separate,
    // lower-confidence extractor precisely so this stays honest.
    expect(extractTime("4 baje")).toBeNull();
    expect(extractTime("11 bje")).toBeNull();
    expect(extractTime("just checking in")).toBeNull();
  });
});

describe("bare-hour extraction and resolution", () => {
  it("reads a bare hour attached to baje/bje/bajhe", () => {
    expect(extractBareHour("4 baje")).toBe(4);
    expect(extractBareHour("11 bje")).toBe(11);
    expect(extractBareHour("12 bajhe")).toBe(12);
  });

  it("returns nothing when there is no baje-like word at all", () => {
    expect(extractBareHour("4")).toBeNull();
    expect(extractBareHour("2 guests")).toBeNull();
  });

  it("resolves a bare check-in hour to the afternoon/evening", () => {
    expect(formatTimeToken(resolveBareHour(4, "checkIn"))).toBe("16:00");
    expect(formatTimeToken(resolveBareHour(12, "checkIn"))).toBe("12:00");
  });

  it("resolves a bare check-out hour to the morning", () => {
    expect(formatTimeToken(resolveBareHour(11, "checkOut"))).toBe("11:00");
    expect(formatTimeToken(resolveBareHour(12, "checkOut"))).toBe("12:00");
  });
});

describe("combined stay-entity extraction — the reported bug", () => {
  it("extracts check-in and check-out date+time from one Hinglish sentence", () => {
    // This is TEST 4 from the bug report: both sides must come out of one
    // message, with no repeated question afterwards.
    const result = extractStayEntities(
      "Kal 4 baje checkin aur agle din 11 baje checkout",
      { now: NOW },
    );
    expect(result.checkInDate).toBe("2026-09-17");
    expect(result.checkInTime).toBe("16:00");
    expect(result.checkOutDate).toBe("2026-09-18");
    expect(result.checkOutTime).toBe("11:00");
  });

  it("extracts the same facts when checkout is named before agle-din", () => {
    const result = extractStayEntities(
      "Kal book krna hai 4 baje aur checkout agle din 11 bje",
      { now: NOW },
    );
    expect(result.checkInDate).toBe("2026-09-17");
    expect(result.checkInTime).toBe("16:00");
    expect(result.checkOutDate).toBe("2026-09-18");
    expect(result.checkOutTime).toBe("11:00");
  });

  it("extracts the same facts in English", () => {
    const result = extractStayEntities(
      "Tomorrow at 4 PM and checkout next day at 11 AM",
      { now: NOW },
    );
    expect(result.checkInDate).toBe("2026-09-17");
    expect(result.checkInTime).toBe("16:00");
    expect(result.checkOutDate).toBe("2026-09-18");
    expect(result.checkOutTime).toBe("11:00");
  });

  it("extracts the same facts in Devanagari", () => {
    const result = extractStayEntities(
      "कल शाम 4 बजे चेक-इन करना है और अगले दिन सुबह 11 बजे चेक-आउट",
      { now: NOW },
    );
    expect(result.checkInDate).toBe("2026-09-17");
    expect(result.checkInTime).toBe("16:00");
    expect(result.checkOutDate).toBe("2026-09-18");
    expect(result.checkOutTime).toBe("11:00");
  });

  it("does not lose the check-in facts already known when only checkout is corrected", () => {
    // "Checkout 12 baje kar do" mentions nothing about check-in at all; the
    // extraction from this one message must not manufacture a check-in date.
    const result = extractStayEntities("Checkout 12 baje kar do", { now: NOW });
    expect(result.checkInDate).toBeUndefined();
    expect(result.checkInTime).toBeUndefined();
    expect(result.checkOutTime).toBe("12:00");
  });

  it("resolves 'agle din' on a checkout-only message against the known check-in date", () => {
    const result = extractStayEntities("checkout agle din 11 baje kar do", {
      now: NOW,
      knownCheckInDate: "2026-09-20",
    });
    expect(result.checkOutDate).toBe("2026-09-21");
    expect(result.checkOutTime).toBe("11:00");
  });

  it("attributes a single unmarked date to check-in when nothing is focused yet", () => {
    const result = extractStayEntities("Kal", { now: NOW });
    expect(result.checkInDate).toBe("2026-09-17");
    expect(result.checkOutDate).toBeUndefined();
  });

  it("attributes a single unmarked date to checkout when the conversation is waiting on it", () => {
    // This is the exact reported failure: the bot asked "when do you check
    // out?" and the guest answered "tomorrow" — that must land on checkout,
    // not be re-read as a new check-in date.
    const result = extractStayEntities("Tomorrow", {
      now: NOW,
      focusSlot: "checkOutDate",
    });
    expect(result.checkOutDate).toBe("2026-09-17");
    expect(result.checkInDate).toBeUndefined();
  });

  it("attributes a single unmarked date+time to checkout when focused there", () => {
    const result = extractStayEntities("Tomorrow at 11 AM", {
      now: NOW,
      focusSlot: "checkOutTime",
    });
    expect(result.checkOutDate).toBe("2026-09-17");
    expect(result.checkOutTime).toBe("11:00");
    expect(result.checkInDate).toBeUndefined();
  });

  it("infers a checkout date the day after check-in when only a checkout time is given", () => {
    // "Today at 4pm and check out at 11 AM" gives no checkout date at all;
    // the shortest stay that sentence can mean is the following day.
    const result = extractStayEntities(
      "Today at 4pm and check out at 11 AM",
      { now: NOW },
    );
    expect(result.checkInDate).toBe("2026-09-16");
    expect(result.checkOutDate).toBe("2026-09-17");
    expect(result.checkOutTime).toBe("11:00");
  });

  it("still supports a stay-length phrase for the checkout date", () => {
    const result = extractStayEntities(
      "kal se 2 din ke liye Vrindavan me room chahiye 2 log",
      { now: NOW },
    );
    expect(result.checkInDate).toBe("2026-09-17");
    expect(result.checkOutDate).toBe("2026-09-19");
    expect(result.guests).toBe(2);
    expect(result.location).toBe("Vrindavan");
  });

  it("extracts guests from a bare number only when guests is the focused slot", () => {
    expect(extractStayEntities("2", { focusSlot: "guests" }).guests).toBe(2);
    expect(extractStayEntities("2", { focusSlot: "checkInDate" }).guests).toBeUndefined();
  });

  it("extracts a location alongside dates and guests from one sentence", () => {
    const result = extractStayEntities(
      "Vrindavan mein kal 4 baje se parson 11 baje tak room chahiye",
      { now: NOW },
    );
    expect(result.location).toBe("Vrindavan");
    expect(result.checkInDate).toBe("2026-09-17");
  });

  it("does not read booking vocabulary as a place name", () => {
    // The exact combined message from TEST 4 must not also produce a bogus
    // location out of "baje checkin agle checkout".
    const result = extractStayEntities(
      "Kal 4 baje checkin aur agle din 11 baje checkout",
      { now: NOW },
    );
    expect(result.location).toBeUndefined();
  });

  it("does not read a general listing request as a place name", () => {
    const result = extractStayEntities("Mujhe asharam ka list do", { now: NOW });
    expect(result.location).toBeUndefined();
  });
});

describe("discovery phrasing", () => {
  it("recognises a browse/listing request", () => {
    for (const value of [
      "Mujhe asharam ka list do",
      "ashram ka list dikhao",
      "sabhi ashram batao",
    ])
      expect(isDiscoveryPhrasing(value)).toBe(true);
  });

  it("does not treat an ordinary booking sentence as a listing request", () => {
    expect(isDiscoveryPhrasing("Kal 4 baje room chahiye")).toBe(false);
  });
});
