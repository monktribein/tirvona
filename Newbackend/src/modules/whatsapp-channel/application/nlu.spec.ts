import {
  extractBareNumber,
  extractDate,
  extractGuests,
  extractNights,
  extractPlace,
  extractReference,
  understand,
} from "./nlu";

/** A fixed "now" so relative dates are assertable. 10:00 IST, 16 Sep 2026. */
const NOW = new Date("2026-09-16T04:30:00.000Z");
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();

describe("intent classification", () => {
  it("recognises greetings across languages", () => {
    for (const value of ["hi", "Hello", "namaste", "नमस्ते", "start"])
      expect(understand(value, NOW).intent).toBe("greeting");
  });

  it("recognises a stay request across languages", () => {
    for (const value of [
      "I want to book a room",
      "room book krna hai",
      "मुझे कमरा बुक करना है",
      "ashram me thaharna hai",
    ])
      expect(understand(value, NOW).intent).toBe("search_stay");
  });

  it("reads a cancellation as a cancellation, not a stay search", () => {
    // "cancel my room booking" contains "room" and "booking"; classifying it
    // as a search would start a booking flow for someone trying to stop one.
    expect(understand("cancel my room booking", NOW).intent).toBe("cancel");
    expect(understand("meri booking cancel kar do", NOW).intent).toBe("cancel");
    expect(understand("बुकिंग रद्द करनी है", NOW).intent).toBe("cancel");
  });

  it("recognises a request to see bookings", () => {
    for (const value of ["my bookings", "meri booking", "booking status"])
      expect(understand(value, NOW).intent).toBe("my_bookings");
  });

  it("recognises each other service", () => {
    expect(understand("parking book karni hai", NOW).intent).toBe("parking");
    expect(understand("aarti ka pass chahiye", NOW).intent).toBe("aarti");
    expect(understand("event me register karna hai", NOW).intent).toBe("event");
    expect(understand("prashad chahiye", NOW).intent).toBe("prashad");
  });

  it("flags a claim of payment so it is never trusted", () => {
    for (const value of ["payment ho gaya", "I have paid", "pay kar diya"])
      expect(understand(value, NOW).intent).toBe("payment_claim");
  });

  it("recognises yes and no in all three styles", () => {
    for (const value of ["yes", "haan", "ok", "हाँ", "bilkul"])
      expect(understand(value, NOW).intent).toBe("affirm");
    for (const value of ["no", "nahi", "नहीं"])
      expect(understand(value, NOW).intent).toBe("deny");
  });

  it("says unknown rather than guessing", () => {
    expect(understand("asdfgh qwerty", NOW).intent).toBe("unknown");
    expect(understand("", NOW).intent).toBe("unknown");
  });
});

describe("date extraction", () => {
  it("reads relative days in all three styles", () => {
    expect(extractDate("kal", NOW)?.getTime()).toBe(day("2026-09-17"));
    expect(extractDate("tomorrow", NOW)?.getTime()).toBe(day("2026-09-17"));
    expect(extractDate("कल", NOW)?.getTime()).toBe(day("2026-09-17"));
    expect(extractDate("aaj", NOW)?.getTime()).toBe(day("2026-09-16"));
    expect(extractDate("parso", NOW)?.getTime()).toBe(day("2026-09-18"));
  });

  it("prefers 'day after tomorrow' over 'tomorrow' inside it", () => {
    expect(extractDate("day after tomorrow", NOW)?.getTime()).toBe(
      day("2026-09-18"),
    );
  });

  it("reads explicit dates", () => {
    expect(extractDate("2026-12-01", NOW)?.getTime()).toBe(day("2026-12-01"));
    expect(extractDate("1/12/2026", NOW)?.getTime()).toBe(day("2026-12-01"));
    expect(extractDate("17 Sep", NOW)?.getTime()).toBe(day("2026-09-17"));
    expect(extractDate("Dec 25", NOW)?.getTime()).toBe(day("2026-12-25"));
  });

  it("reads a bare day/month that has passed as next year, not the past", () => {
    // A guest asking in September for "5 Jan" means next January.
    expect(extractDate("5 Jan", NOW)?.getTime()).toBe(day("2027-01-05"));
    expect(extractDate("5/1", NOW)?.getTime()).toBe(day("2027-01-05"));
  });

  it("returns nothing when there is no date", () => {
    expect(extractDate("book a room", NOW)).toBeNull();
    expect(extractDate("", NOW)).toBeNull();
  });
});

describe("stay length and guest count", () => {
  it("reads nights in all three styles", () => {
    expect(extractNights("2 din ke liye")).toBe(2);
    expect(extractNights("3 nights")).toBe(3);
    expect(extractNights("दो दिन")).toBe(2);
    expect(extractNights("ek raat")).toBe(1);
  });

  it("reads guest counts in all three styles", () => {
    expect(extractGuests("2 log hain")).toBe(2);
    expect(extractGuests("3 guests")).toBe(3);
    expect(extractGuests("चार लोग")).toBe(4);
    expect(extractGuests("for 2 people")).toBe(2);
  });

  it("does not read a stay length as a guest count", () => {
    // "2 din ke liye room chahiye" is two nights, not two guests.
    expect(extractGuests("2 din ke liye room chahiye")).toBeNull();
    expect(extractNights("2 log ke liye room chahiye")).toBeNull();
  });

  it("reads a bare number only when the message is nothing else", () => {
    expect(extractBareNumber("2")).toBe(2);
    expect(extractBareNumber(" 3 ")).toBe(3);
    expect(extractBareNumber("2 log")).toBeNull();
    expect(extractBareNumber("room")).toBeNull();
  });
});

describe("place extraction", () => {
  it("pulls a place out of a full Hinglish request", () => {
    expect(extractPlace("mujhe kal Prem Mandir ke paas room chahiye")).toBe(
      "Prem Mandir",
    );
  });

  it("pulls a place out of an English request", () => {
    expect(extractPlace("I want a room near Prem Mandir")).toBe("Prem Mandir");
  });

  it("returns nothing rather than a sentence it failed to strip", () => {
    // A bad guess here is harmless, but a whole sentence handed to search is
    // worse than asking the guest to name the place.
    expect(
      extractPlace(
        "hello I would very much like to know about all the many options you have available",
      ),
    ).toBeNull();
  });

  it("returns nothing when there is no place left after the noise", () => {
    expect(extractPlace("room chahiye")).toBeNull();
    expect(extractPlace("kal ke liye")).toBeNull();
  });
});

describe("reference extraction", () => {
  it("reads a quoted Tirvona reference", () => {
    expect(extractReference("cancel TRV-ABC12-XY9Z please")).toBe(
      "TRV-ABC12-XY9Z",
    );
    expect(extractReference("trv-abc12-xy9z")).toBe("TRV-ABC12-XY9Z");
  });

  it("returns nothing when no reference is quoted", () => {
    expect(extractReference("cancel my booking")).toBeNull();
  });
});

describe("whole-message understanding", () => {
  it("reads every fact out of one Hinglish sentence", () => {
    const result = understand(
      "Mujhe kal Prem Mandir ke paas 2 din ke liye room chahiye, 3 log hain",
      NOW,
    );
    expect(result.intent).toBe("search_stay");
    expect(result.parameters.place).toBe("Prem Mandir");
    expect(result.parameters.checkIn?.getTime()).toBe(day("2026-09-17"));
    expect(result.parameters.checkOut?.getTime()).toBe(day("2026-09-19"));
    expect(result.parameters.guests).toBe(3);
  });

  it("reads the same facts from Devanagari", () => {
    const result = understand("मुझे कल दो दिन के लिए कमरा चाहिए", NOW);
    expect(result.intent).toBe("search_stay");
    expect(result.parameters.checkIn?.getTime()).toBe(day("2026-09-17"));
    expect(result.parameters.checkOut?.getTime()).toBe(day("2026-09-19"));
  });

  it("returns only what it actually found", () => {
    const result = understand("I need a room", NOW);
    expect(result.intent).toBe("search_stay");
    expect(result.parameters.checkIn).toBeUndefined();
    expect(result.parameters.guests).toBeUndefined();
  });
});
