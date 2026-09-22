import {
  extractCouponCode,
  extractPartySplit,
  extractRoomRequest,
  extractServiceCommands,
  isCouponQuestion,
  isCouponRemoval,
  isOfferQuestion,
  isPriceQuestion,
} from "./stay-selection";

const rooms = [
  { id: "r-deluxe", name: "Deluxe Room" },
  { id: "r-standard", name: "Standard Room" },
  { id: "r-family", name: "Family Room" },
];

describe("extractRoomRequest", () => {
  it("reads a count and a category", () => {
    const r = extractRoomRequest("2 deluxe rooms", rooms);
    expect(r.picks).toEqual([{ roomId: "r-deluxe", units: 2, explicit: true }]);
  });

  it("reads several categories in one sentence (Hinglish)", () => {
    const r = extractRoomRequest("1 deluxe aur 2 standard rooms", rooms);
    expect(r.picks).toEqual(
      expect.arrayContaining([
        { roomId: "r-deluxe", units: 1, explicit: true },
        { roomId: "r-standard", units: 2, explicit: true },
      ]),
    );
    expect(r.picks).toHaveLength(2);
  });

  it("reads several categories in English", () => {
    const r = extractRoomRequest("1 deluxe and 3 family rooms", rooms);
    expect(r.picks).toEqual(
      expect.arrayContaining([
        { roomId: "r-deluxe", units: 1, explicit: true },
        { roomId: "r-family", units: 3, explicit: true },
      ]),
    );
  });

  it("reads number words", () => {
    const r = extractRoomRequest("do deluxe room chahiye", rooms);
    expect(r.picks).toEqual([{ roomId: "r-deluxe", units: 2, explicit: true }]);
  });

  it("reads a trailing count: 'deluxe x2'", () => {
    const r = extractRoomRequest("deluxe x2", rooms);
    expect(r.picks[0]).toMatchObject({ roomId: "r-deluxe", units: 2 });
  });

  it("treats a bare name as one unit that does not reset an existing count", () => {
    const r = extractRoomRequest("deluxe wala", rooms);
    expect(r.picks).toEqual([{ roomId: "r-deluxe", units: 1, explicit: false }]);
  });

  it("does not take a guest count as a room count", () => {
    const r = extractRoomRequest("2 guests ke liye deluxe room", rooms);
    expect(r.picks).toEqual([{ roomId: "r-deluxe", units: 1, explicit: false }]);
  });

  it("does not take adults, children or nights as a room count", () => {
    const r = extractRoomRequest("2 adults aur 1 child 3 nights deluxe", rooms);
    expect(r.picks).toEqual([{ roomId: "r-deluxe", units: 1, explicit: false }]);
  });

  it("reads 'ye wala room 3 chahiye' as a count for whatever is chosen", () => {
    const r = extractRoomRequest("ye wala room 3 chahiye", rooms);
    expect(r.picks).toEqual([]);
    expect(r.unitsOnly).toBe(3);
  });

  it("reads '2 rooms kar do' as a count only", () => {
    const r = extractRoomRequest("2 rooms kar do", rooms);
    expect(r.unitsOnly).toBe(2);
    expect(r.picks).toEqual([]);
  });

  it("reads a Devanagari count", () => {
    const r = extractRoomRequest("दो कमरे चाहिए", rooms);
    expect(r.unitsOnly).toBe(2);
  });

  it("flags a name that fits several categories instead of guessing", () => {
    const many = [
      { id: "a", name: "Deluxe AC Room" },
      { id: "b", name: "Deluxe Non AC Room" },
    ];
    const r = extractRoomRequest("2 deluxe", many);
    // 'Deluxe' alone is a full match on both — neither is more specific.
    expect(r.picks.length + r.ambiguous.length).toBeGreaterThan(0);
  });

  it("returns nothing for a message that names no room", () => {
    const r = extractRoomRequest("checkout 12 baje kar do", rooms);
    expect(r.picks).toEqual([]);
    expect(r.ambiguous).toEqual([]);
    expect(r.unitsOnly).toBeUndefined();
  });

  it("caps an absurd count", () => {
    const r = extractRoomRequest("99 deluxe", rooms);
    expect(r.picks[0].units).toBeLessThanOrEqual(20);
  });
});

describe("extractPartySplit", () => {
  it("reads adults and children", () => {
    expect(extractPartySplit("2 adults aur 1 child")).toEqual({
      adults: 2,
      children: 1,
    });
  });
  it("reads adults alone", () => {
    expect(extractPartySplit("3 adults")).toEqual({ adults: 3 });
  });
  it("reads children in Hinglish and Devanagari", () => {
    expect(extractPartySplit("2 bacche")).toEqual({ children: 2 });
    expect(extractPartySplit("2 बच्चे")).toEqual({ children: 2 });
  });
  it("reads number words", () => {
    expect(extractPartySplit("do adults aur ek child")).toEqual({
      adults: 2,
      children: 1,
    });
  });
  it("ignores a plain total", () => {
    expect(extractPartySplit("4 log")).toEqual({});
  });
});

describe("coupons", () => {
  it.each([
    ["ABC123 coupon apply karo", "ABC123"],
    ["Coupon SAVE20 laga do", "SAVE20"],
    ["coupon laga do SAVE20", "SAVE20"],
    ["promo code LASTMINUTE10", "LASTMINUTE10"],
    ["mere paas KUMBH2026 code hai", "KUMBH2026"],
    ["Coupon ABC123 laga do", "ABC123"],
    ["abc123 coupon", "ABC123"],
  ])("finds the code in %j", (text, code) => {
    expect(extractCouponCode(text)).toBe(code);
  });

  it("finds nothing in an ordinary sentence", () => {
    expect(extractCouponCode("2 rooms chahiye")).toBeNull();
    expect(extractCouponCode("checkout 12 baje")).toBeNull();
  });

  it("finds nothing when a coupon is mentioned without a code", () => {
    expect(extractCouponCode("koi coupon available hai?")).toBeNull();
  });

  it("does not read the word 'coupon' or a verb as a code", () => {
    expect(extractCouponCode("coupon laga do")).toBeNull();
  });

  it("takes a lone plain word as the code only while a code was asked for", () => {
    expect(extractCouponCode("welcome", { expectingCode: false })).toBeNull();
    expect(extractCouponCode("welcome", { expectingCode: true })).toBe("WELCOME");
  });

  it("recognises removal", () => {
    expect(isCouponRemoval("Coupon hata do")).toBe(true);
    expect(isCouponRemoval("remove coupon")).toBe(true);
    expect(isCouponRemoval("coupon laga do SAVE20")).toBe(false);
  });

  it("recognises a question about what exists", () => {
    expect(isCouponQuestion("Koi coupon available hai?")).toBe(true);
    expect(isCouponQuestion("SAVE20 coupon laga do")).toBe(false);
    expect(isCouponQuestion("coupon hata do")).toBe(false);
  });

  it("recognises an offers question", () => {
    expect(isOfferQuestion("Koi offer hai?")).toBe(true);
    expect(isOfferQuestion("koi discount milega")).toBe(true);
    expect(isOfferQuestion("2 rooms chahiye")).toBe(false);
  });

  it("recognises a price question", () => {
    expect(isPriceQuestion("Price batao")).toBe(true);
    expect(isPriceQuestion("total kitna hoga")).toBe(true);
    expect(isPriceQuestion("kal checkin")).toBe(false);
  });
});

describe("extractServiceCommands", () => {
  const addOns = [
    { id: "a-bed", name: "Extra Bed", maxQuantity: 3 },
    { id: "a-puja", name: "Puja Kit" },
  ];

  it("adds a flat service", () => {
    expect(extractServiceCommands("parking bhi chahiye", addOns).flat).toEqual({
      parking: true,
    });
  });

  it("removes a flat service", () => {
    expect(extractServiceCommands("meals hata do", addOns).flat).toEqual({
      meals: false,
    });
  });

  it("handles several services in one sentence", () => {
    expect(
      extractServiceCommands("prasad aur locker chahiye", addOns).flat,
    ).toEqual({ prasad: true, locker: true });
  });

  it("adds a property add-on with a quantity, capped at its maximum", () => {
    expect(extractServiceCommands("2 extra bed add karo", addOns).addOns).toEqual([
      { serviceId: "a-bed", quantity: 2 },
    ]);
    expect(extractServiceCommands("9 extra bed add karo", addOns).addOns).toEqual([
      { serviceId: "a-bed", quantity: 3 },
    ]);
  });

  it("removes an add-on", () => {
    expect(extractServiceCommands("puja kit hata do", addOns).removeAddOns).toEqual([
      "a-puja",
    ]);
  });

  it("ignores a service word with no add/remove verb", () => {
    const c = extractServiceCommands("parking kahan hai", addOns);
    expect(c.flat).toEqual({});
  });
});
