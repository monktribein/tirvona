import { isPlaceholderEmail, realEmail, walkInPlaceholderEmail } from "./placeholder-email";

describe("placeholder emails", () => {
  it("recognises the walk-in stand-in address and hides it", () => {
    const stand = walkInPlaceholderEmail("+91 98765 43210");
    expect(stand).toBe("walkin.919876543210@guest.tirvona.local");
    expect(isPlaceholderEmail(stand)).toBe(true);
    expect(realEmail(stand)).toBeNull();
  });

  it("keeps a real address, whatever its provider", () => {
    expect(realEmail("pilgrim@gmail.com")).toBe("pilgrim@gmail.com");
    expect(realEmail("undrjm9457@minitts.net")).toBe("undrjm9457@minitts.net");
    expect(realEmail(undefined)).toBeNull();
  });
});
