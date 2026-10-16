import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
  last4: string;
}

@Injectable()
export class PartnerCryptoService {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const raw =
      this.config.get<string>("encryptionKey") ||
      this.config.get<string>("jwtSecret") ||
      "development-tirvona-partner-crypto-key";
    return createHash("sha256").update(raw).digest();
  }

  /**
   * Encrypts a webhook signing secret with AES-256-GCM.
   */
  encryptSecret(secret: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      last4: secret.slice(-4),
    };
  }

  /**
   * Decrypts an encrypted webhook signing secret.
   */
  decryptSecret(encrypted: { ciphertext: string; iv: string; tag: string }): string {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.key(),
        Buffer.from(encrypted.iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    } catch {
      throw new InternalServerErrorException("Failed to decrypt webhook secret");
    }
  }

  /**
   * Generates a cryptographically secure random secret or key string.
   */
  generateRandomString(length = 32): string {
    return randomBytes(length).toString("hex");
  }

  /**
   * Computes SHA-256 hex digest of an API key secret.
   */
  hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }
}
