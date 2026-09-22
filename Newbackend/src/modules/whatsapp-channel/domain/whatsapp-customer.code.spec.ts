import {
  WHATSAPP_CUSTOMER_CODE_PATTERN,
  formatWhatsAppCustomerCode,
  generateWhatsAppCustomerSuffix,
  isWhatsAppCustomerCode,
  whatsAppCustomerDateFromCode,
  whatsAppCustomerDateStamp,
} from "./whatsapp-customer.code";

const CREATED = new Date("2026-09-16T04:30:00.000Z");

describe("WhatsApp customer codes", () => {
  it("renders WAPP-YYYYMMDD-XXXXXX from the creation date and a suffix", () => {
    expect(formatWhatsAppCustomerCode(CREATED, "abc123")).toBe(
      "WAPP-20260916-ABC123",
    );
  });

  it("uses the UTC calendar day the identity was created", () => {
    expect(whatsAppCustomerDateStamp(new Date("2026-01-05T23:59:00.000Z"))).toBe(
      "20260105",
    );
    expect(whatsAppCustomerDateStamp(new Date("2026-12-31T00:00:00.000Z"))).toBe(
      "20261231",
    );
  });

  it("upper-cases the suffix regardless of how it was generated", () => {
    expect(formatWhatsAppCustomerCode(CREATED, "aB3xY9")).toBe(
      "WAPP-20260916-AB3XY9",
    );
  });

  it("matches the pattern used by the schema's own validator", () => {
    const code = formatWhatsAppCustomerCode(CREATED, generateWhatsAppCustomerSuffix());
    expect(code).toMatch(WHATSAPP_CUSTOMER_CODE_PATTERN);
  });

  it("keeps every code the same shape whatever the date or suffix", () => {
    const codes = [
      formatWhatsAppCustomerCode(new Date("2026-01-01T00:00:00Z"), "000001"),
      formatWhatsAppCustomerCode(new Date("2026-12-31T23:59:59Z"), "ZZZZZZ"),
      formatWhatsAppCustomerCode(CREATED, generateWhatsAppCustomerSuffix()),
    ];
    expect(new Set(codes.map((code) => code.length)).size).toBe(1);
    for (const code of codes) expect(code).toMatch(WHATSAPP_CUSTOMER_CODE_PATTERN);
  });

  it("rejects a suffix that is not exactly six alphanumeric characters", () => {
    for (const bad of ["", "abc", "abcdefg", "abc-12", "abc 12"])
      expect(() => formatWhatsAppCustomerCode(CREATED, bad)).toThrow(RangeError);
  });

  it("rejects an invalid creation date", () => {
    expect(() =>
      formatWhatsAppCustomerCode(new Date("not a date"), "abc123"),
    ).toThrow(RangeError);
  });

  it("is immutable in the sense that it never depends on anything but its own inputs", () => {
    // Formatting the same (date, suffix) pair twice must always agree — the
    // schema marks the field `immutable: true`, and support relies on being
    // able to recompute what a code should look like for a known date.
    expect(formatWhatsAppCustomerCode(CREATED, "ABC123")).toBe(
      formatWhatsAppCustomerCode(CREATED, "ABC123"),
    );
  });
});

describe("global uniqueness of the suffix", () => {
  it("generates six-character alphanumeric suffixes", () => {
    for (let i = 0; i < 50; i += 1)
      expect(generateWhatsAppCustomerSuffix()).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("does not produce the same suffix on consecutive calls in practice", () => {
    // Not a mathematical guarantee (that is what the unique index and the
    // create-and-retry loop in WhatsAppIdentityService are for) but a sanity
    // check that this is not, say, always returning the same value.
    const suffixes = new Set(
      Array.from({ length: 200 }, () => generateWhatsAppCustomerSuffix()),
    );
    expect(suffixes.size).toBeGreaterThan(190);
  });
});

describe("reading the date back out of a code", () => {
  it("round-trips the creation date", () => {
    const code = formatWhatsAppCustomerCode(CREATED, "ABC123");
    expect(whatsAppCustomerDateFromCode(code)?.toISOString().slice(0, 10)).toBe(
      "2026-09-16",
    );
  });

  it("reads a code whatever its casing or surrounding space", () => {
    expect(
      whatsAppCustomerDateFromCode("  wapp-20260916-abc123 ")?.toISOString()
        .slice(0, 10),
    ).toBe("2026-09-16");
  });

  it("rejects an impossible calendar date rather than rolling it over", () => {
    // Date.UTC would silently turn 20260231 into March 3rd; this must refuse
    // it instead, since a code with an impossible date was never issued here.
    expect(whatsAppCustomerDateFromCode("WAPP-20260231-ABC123")).toBeNull();
    expect(whatsAppCustomerDateFromCode("WAPP-20261301-ABC123")).toBeNull();
  });

  it("returns null for anything that is not a WAPP code", () => {
    for (const value of [
      "",
      null,
      undefined,
      "WAPP1000000",
      "WAPP-2026916-ABC123",
      "WAPP-20260916-ABC12",
      "WAPP-20260916-ABC1234",
      "TRV-ABC-123",
      "919876543210",
    ])
      expect(whatsAppCustomerDateFromCode(value)).toBeNull();
  });
});

describe("recognising a WAPP code", () => {
  it("accepts a well-formed code", () => {
    expect(isWhatsAppCustomerCode("WAPP-20260916-ABC123")).toBe(true);
    expect(isWhatsAppCustomerCode(" wapp-20260916-abc123 ")).toBe(true);
  });

  it("rejects a shape that matches the pattern but has an impossible date", () => {
    // Two answers to "is this valid" is how a lookup ends up accepting
    // something no customer could actually own.
    expect(isWhatsAppCustomerCode("WAPP-20261301-ABC123")).toBe(false);
  });

  it("rejects anything that is not a WAPP code", () => {
    for (const value of [
      "",
      null,
      undefined,
      "WAPP1000000",
      "WAPP-20260916-ABC12",
      "TRV-ABC-123",
      "919876543210",
    ])
      expect(isWhatsAppCustomerCode(value)).toBe(false);
  });

  it("is not the phone number", () => {
    // The public id must not leak the guest's number to owner or admin views
    // that are only entitled to an identifier.
    const code = formatWhatsAppCustomerCode(CREATED, generateWhatsAppCustomerSuffix());
    expect(code).not.toContain("91987");
  });

  it("is human-readable: the date is legible at a glance without a lookup", () => {
    const code = formatWhatsAppCustomerCode(
      new Date("2026-03-04T00:00:00Z"),
      "Q1W2E3",
    );
    expect(code).toBe("WAPP-20260304-Q1W2E3");
  });
});
