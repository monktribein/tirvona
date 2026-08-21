import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  tag: string;
}

@Injectable()
export class BankAccountCrypto {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const raw = this.config.get<string>("payout.encryptionKey") ?? "";
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
    if (this.config.get<string>("nodeEnv") !== "production" && raw)
      return createHash("sha256").update(raw).digest();
    throw new InternalServerErrorException("Payout encryption is not configured");
  }

  encrypt(value: string): EncryptedValue {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(value: EncryptedValue): string {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      Buffer.from(value.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(value.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }

  fingerprint(accountNumber: string, ifsc: string): string {
    return createHash("sha256")
      .update(`${this.key().toString("base64")}:${accountNumber}:${ifsc}`)
      .digest("hex");
  }
}
