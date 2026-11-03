import { generateTemporaryPassword } from "./temporary-password";

describe("generateTemporaryPassword", () => {
  it("is 12 random characters in three groups, easy to read out", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = generateTemporaryPassword();
      expect(value).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[2-9]/);
      // No characters that are confused when spoken or read.
      expect(value).not.toMatch(/[01OIl]/);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(2000);
  });
});
