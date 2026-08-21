import { normalizeGateCode, parkingDisplayCode } from "./parking.utils";

describe("gate code entry", () => {
  it("accepts the code exactly as the pass prints it", () => {
    expect(normalizeGateCode("H24R-BGTB")).toBe("H24R-BGTB");
  });

  it("ignores case and separators", () => {
    for (const typed of ["h24r-bgtb", "H24RBGTB", "h24r bgtb", " H24R-BGTB "])
      expect(normalizeGateCode(typed)).toBe("H24R-BGTB");
  });

  it("maps the characters the alphabet deliberately omits", () => {
    expect(normalizeGateCode("I234-5678")).toBe("1234-5678");
    expect(normalizeGateCode("L234-5678")).toBe("1234-5678");
    expect(normalizeGateCode("O234-5678")).toBe("0234-5678");
    expect(normalizeGateCode("U234-5678")).toBe("V234-5678");
  });

  it("rejects anything that is not a gate code", () => {
    expect(normalizeGateCode("TVNPK1.abc.def.ghi")).toBeNull();
    expect(normalizeGateCode("H24R-BGT")).toBeNull();
    expect(normalizeGateCode("H24R-BGTBX")).toBeNull();
    expect(normalizeGateCode("")).toBeNull();
  });

  it("round-trips a freshly generated code", () => {
    for (let i = 0; i < 200; i += 1) {
      const issued = parkingDisplayCode();
      expect(normalizeGateCode(issued)).toBe(issued);
      expect(normalizeGateCode(issued.toLowerCase().replace("-", " "))).toBe(
        issued,
      );
    }
  });
});
