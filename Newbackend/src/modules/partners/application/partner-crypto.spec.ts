import { PartnerCryptoService } from "../application/partner-crypto.service";
import type { ConfigService } from "@nestjs/config";

describe("PartnerCryptoService", () => {
  let service: PartnerCryptoService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === "encryptionKey") return "test-secret-key-that-is-at-least-32-chars-long";
        return null;
      }),
    } as any;
    service = new PartnerCryptoService(configService);
  });

  it("hashes secrets deterministically using SHA-256", () => {
    const raw = "tv_test_abc123secret456";
    const hash1 = service.hashSecret(raw);
    const hash2 = service.hashSecret(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("encrypts and decrypts webhook signing secrets accurately using AES-256-GCM", () => {
    const secret = "whsec_9876543210abcdef12345678";
    const encrypted = service.encryptSecret(secret);

    expect(encrypted.last4).toBe("5678");
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = service.decryptSecret(encrypted);
    expect(decrypted).toBe(secret);
  });
});
