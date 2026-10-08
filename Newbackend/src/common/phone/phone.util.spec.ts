import { canonicalPhone, phoneCandidates } from "./phone.util";

describe("canonicalPhone", () => {
  it.each([
    ["+918920877101", "8920877101"],
    ["08920877101", "8920877101"],
    ["8920877101", "8920877101"],
    ["919936968762", "9936968762"],
    ["+91 99369 68762", "9936968762"],
    ["+14155550123", "+14155550123"],
  ])("stores %s as %s", (input, stored) => {
    expect(canonicalPhone(input)).toBe(stored);
  });

  it("keeps unrecognisable input as typed", () => {
    expect(canonicalPhone("  12ab  ")).toBe("12ab");
  });
});

describe("phoneCandidates", () => {
  it("covers every spelling accounts were created with", () => {
    const spellings = phoneCandidates("8920877101");
    for (const stored of [
      "8920877101",
      "+918920877101",
      "918920877101",
      "08920877101",
    ])
      expect(spellings).toContain(stored);
  });

  it("resolves different spellings of one number to the same set", () => {
    const a = new Set(phoneCandidates("+918920877101"));
    const b = new Set(phoneCandidates("08920877101"));
    for (const value of ["8920877101", "918920877101", "+918920877101"]) {
      expect(a.has(value)).toBe(true);
      expect(b.has(value)).toBe(true);
    }
  });
});
