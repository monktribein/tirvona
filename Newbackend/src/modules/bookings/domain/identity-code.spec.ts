import {
  IDENTITY_CODE_PATTERN,
  MAX_PROPERTY_SEQUENCE,
  MAX_VISITOR_SEQUENCE,
  VISITOR_BLOCK_SIZE,
  formatIdentityCode,
  formatPropertyCode,
  parseIdentityCode,
  propertyCounterKey,
  resolveClusterCode,
  resolvePropertyTypeCode,
  visitorCounterKey,
  visitorSequenceFromToken,
  visitorToken,
} from "./identity-code";

describe("visitor sequence tokens", () => {
  it("starts the first block at A1001", () =>
    expect(visitorToken(1)).toBe("A1001"));

  it("fills a block to 9999 before advancing the letter", () => {
    expect(visitorToken(VISITOR_BLOCK_SIZE)).toBe("A9999");
    expect(visitorToken(VISITOR_BLOCK_SIZE + 1)).toBe("B1001");
  });

  it("carries across several blocks", () => {
    expect(visitorToken(VISITOR_BLOCK_SIZE * 2)).toBe("B9999");
    expect(visitorToken(VISITOR_BLOCK_SIZE * 2 + 1)).toBe("C1001");
    expect(visitorToken(MAX_VISITOR_SEQUENCE)).toBe("Z9999");
  });

  it("never emits a number below 1001 — blocks hold 8999, not 10000", () => {
    for (let sequence = 1; sequence <= VISITOR_BLOCK_SIZE * 3; sequence += 7) {
      const offset = Number(visitorToken(sequence).slice(1));
      expect(offset).toBeGreaterThanOrEqual(1001);
      expect(offset).toBeLessThanOrEqual(9999);
    }
  });

  it("is collision-free across a whole block boundary", () => {
    const window = 5_000;
    const start = VISITOR_BLOCK_SIZE - window / 2;
    const seen = new Set<string>();
    for (let sequence = start; sequence < start + window; sequence += 1)
      seen.add(visitorToken(sequence));
    expect(seen.size).toBe(window);
  });

  it("round-trips through visitorSequenceFromToken", () => {
    for (const sequence of [
      1,
      1000,
      VISITOR_BLOCK_SIZE,
      VISITOR_BLOCK_SIZE + 1,
      123_456,
      MAX_VISITOR_SEQUENCE,
    ])
      expect(visitorSequenceFromToken(visitorToken(sequence))).toBe(sequence);
  });

  it("rejects tokens outside the addressable range", () => {
    expect(visitorSequenceFromToken("A1000")).toBeNull();
    expect(visitorSequenceFromToken("A0999")).toBeNull();
    expect(visitorSequenceFromToken("a1001")).toBeNull();
    expect(visitorSequenceFromToken("A101")).toBeNull();
  });

  it("refuses sequences it cannot represent", () => {
    expect(() => visitorToken(0)).toThrow(RangeError);
    expect(() => visitorToken(-1)).toThrow(RangeError);
    expect(() => visitorToken(1.5)).toThrow(RangeError);
    expect(() => visitorToken(MAX_VISITOR_SEQUENCE + 1)).toThrow(RangeError);
  });
});

describe("property codes", () => {
  it("zero-pads the registration number to five digits", () => {
    expect(formatPropertyCode("BC", "AG", 1)).toBe("BCAG-00001");
    expect(formatPropertyCode("HC", "DG", 42)).toBe("HCDG-00042");
    expect(formatPropertyCode("BC", "HG", MAX_PROPERTY_SEQUENCE)).toBe(
      "BCHG-99999",
    );
  });

  it("refuses numbers outside the five-digit register", () => {
    expect(() => formatPropertyCode("BC", "AG", 0)).toThrow(RangeError);
    expect(() =>
      formatPropertyCode("BC", "AG", MAX_PROPERTY_SEQUENCE + 1),
    ).toThrow(RangeError);
  });

  it("refuses malformed cluster and type codes", () => {
    expect(() => formatPropertyCode("B", "AG", 1)).toThrow(RangeError);
    expect(() => formatPropertyCode("bc", "AG", 1)).toThrow(RangeError);
    expect(() => formatPropertyCode("BC", "ZZ" as any, 1)).toThrow(RangeError);
  });
});

describe("full identity codes", () => {
  it("assembles the specified shape", () => {
    const code = formatIdentityCode(formatPropertyCode("BC", "AG", 1), 1);
    expect(code).toBe("BCAG-00001-A1001");
    expect(code).toMatch(IDENTITY_CODE_PATTERN);
  });

  it("decodes back to every part", () => {
    expect(parseIdentityCode("HCDG-00042-B1001")).toEqual({
      clusterCode: "HC",
      clusterName: "Haridwar Cluster",
      propertyTypeCode: "DG",
      propertyTypeName: "Dharamshala Guest",
      propertySequence: 42,
      propertyCode: "HCDG-00042",
      visitorToken: "B1001",
      visitorSequence: VISITOR_BLOCK_SIZE + 1,
    });
  });

  it("normalises case and surrounding whitespace when decoding", () =>
    expect(parseIdentityCode("  bcag-00001-a1001  ")?.propertyCode).toBe(
      "BCAG-00001",
    ));

  it("rejects codes that match the shape but name nothing", () => {
    // Sequence 00000 is no property, and A1000 is below the block start.
    expect(parseIdentityCode("BCAG-00000-A1001")).toBeNull();
    expect(parseIdentityCode("BCAG-00001-A1000")).toBeNull();
    expect(parseIdentityCode("BCXX-00001-A1001")).toBeNull();
    expect(parseIdentityCode("BCAG-0001-A1001")).toBeNull();
    expect(parseIdentityCode("TRV-MJ8Q-A1B2C")).toBeNull();
    expect(parseIdentityCode(null)).toBeNull();
  });
});

describe("cluster resolution", () => {
  it("maps the named clusters", () => {
    expect(resolveClusterCode({ city: "Vrindavan" })).toBe("BC");
    expect(resolveClusterCode({ city: "Haridwar" })).toBe("HC");
  });

  it("tolerates spelling and spacing variants", () => {
    expect(resolveClusterCode({ city: "hardwar" })).toBe("HC");
    expect(resolveClusterCode({ city: "Bodh Gaya" })).toBe("GC");
    expect(resolveClusterCode({ city: "prayag-raj" })).toBe("PC");
  });

  it("falls back to the district when the city is unknown", () =>
    expect(resolveClusterCode({ city: "Chhata", district: "Mathura" })).toBe(
      "BC",
    ));

  it("prefers the city over the district", () =>
    expect(
      resolveClusterCode({ city: "Rishikesh", district: "Dehradun" }),
    ).toBe("RC"));

  it("always yields an allocatable cluster", () => {
    expect(resolveClusterCode({})).toBe("XC");
    expect(resolveClusterCode({ city: "Somewhere New" })).toBe("XC");
  });
});

describe("property type resolution", () => {
  it("maps the three guest types", () => {
    expect(resolvePropertyTypeCode("Ashram")).toBe("AG");
    expect(resolvePropertyTypeCode("Dharamshala")).toBe("DG");
    expect(resolvePropertyTypeCode("Homestay")).toBe("HG");
  });

  it("tolerates the spelling variants stored in free text", () => {
    expect(resolvePropertyTypeCode("Dharmshala")).toBe("DG");
    expect(resolvePropertyTypeCode("dharam shala")).toBe("DG");
    expect(resolvePropertyTypeCode("Guest House")).toBe("HG");
  });

  it("defaults unknown and empty types to Ashram Guest", () => {
    expect(resolvePropertyTypeCode("Yoga Retreat")).toBe("AG");
    expect(resolvePropertyTypeCode("")).toBe("AG");
    expect(resolvePropertyTypeCode(undefined)).toBe("AG");
  });
});

describe("counter scope keys", () => {
  it("separates each cluster/type register", () => {
    expect(propertyCounterKey("BC", "AG")).toBe("property:BC:AG");
    expect(propertyCounterKey("BC", "DG")).not.toBe(
      propertyCounterKey("BC", "AG"),
    );
    expect(propertyCounterKey("HC", "AG")).not.toBe(
      propertyCounterKey("BC", "AG"),
    );
  });

  it("gives every property its own visitor register", () => {
    expect(visitorCounterKey("BCAG-00001")).toBe("visitor:BCAG-00001");
    expect(visitorCounterKey("BCAG-00001")).not.toBe(
      visitorCounterKey("BCAG-00002"),
    );
  });

  it("cannot collide with a property key", () =>
    expect(visitorCounterKey("BCAG-00001")).not.toBe(
      propertyCounterKey("BC", "AG"),
    ));
});
