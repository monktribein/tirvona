import { ConfigService } from "@nestjs/config";
import { BankAccountCrypto } from "./bank-account.crypto";

describe("BankAccountCrypto", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const crypto = new BankAccountCrypto(
    new ConfigService({ payout: { encryptionKey: key }, nodeEnv: "test" }),
  );

  it("encrypts account numbers with authenticated encryption", () => {
    const encrypted = crypto.encrypt("123456789012");
    expect(encrypted.ciphertext).not.toContain("123456789012");
    expect(encrypted.iv).not.toBe("");
    expect(encrypted.tag).not.toBe("");
    expect(crypto.decrypt(encrypted)).toBe("123456789012");
  });

  it("creates stable non-reversible account fingerprints", () => {
    const first = crypto.fingerprint("123456789012", "HDFC0000001");
    expect(first).toBe(crypto.fingerprint("123456789012", "HDFC0000001"));
    expect(first).not.toContain("123456789012");
  });
});
