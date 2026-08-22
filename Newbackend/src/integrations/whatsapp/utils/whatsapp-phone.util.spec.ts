import { normalizeWhatsAppNumber } from "./whatsapp-phone.util";

describe("normalizeWhatsAppNumber", () => {
  it.each([
    ["9936968762", "919936968762"],
    ["919936968762", "919936968762"],
    ["+91 99369 68762", "919936968762"],
    ["91919936968762", "919936968762"],
  ])("normalizes %s without duplicating India's country code", (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });

  it("rejects malformed Indian numbers", () => {
    expect(normalizeWhatsAppNumber("9112345")).toBeNull();
  });
});
