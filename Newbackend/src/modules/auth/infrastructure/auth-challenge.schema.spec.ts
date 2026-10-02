import { readFileSync } from "node:fs";
import { join } from "node:path";
import { model } from "mongoose";
import { AuthChallengeSchema } from "./auth-challenge.schema";

const AuthChallenge = model("AuthChallengeSpec", AuthChallengeSchema);

/** Every purpose AuthService opens a challenge with. */
const purposesInService = (): string[] => {
  const source = readFileSync(
    join(__dirname, "../application/auth.service.ts"),
    "utf8",
  );
  return [...source.matchAll(/createChallenge\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
};

describe("AuthChallenge schema", () => {
  // The service's unit tests mock the model, so a purpose missing from the
  // enum only failed against a real database ("email_change", 2026-10-02).
  it.each(purposesInService())("accepts the %s purpose the service uses", (purpose) => {
    const doc = new AuthChallenge({
      tokenHash: "t",
      codeHash: "c",
      purpose,
      identifier: "someone@example.com",
      expiresAt: new Date(),
      resendAvailableAt: new Date(),
    });
    expect(doc.validateSync()?.errors?.purpose).toBeUndefined();
  });

  it("finds the purposes it checks", () => {
    expect(purposesInService()).toEqual(
      expect.arrayContaining(["register", "phone_login", "google", "email_change"]),
    );
  });
});
