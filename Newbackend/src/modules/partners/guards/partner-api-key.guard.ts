import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import { timingSafeEqual } from "node:crypto";
import { PartnerCryptoService } from "../application/partner-crypto.service";
import type { AuthenticatedPartnerContext } from "../decorators/current-partner.decorator";

@Injectable()
export class PartnerApiKeyGuard implements CanActivate {
  constructor(
    @InjectModel("Partner") private readonly partnerModel: Model<any>,
    @InjectModel("PartnerApiKey") private readonly apiKeyModel: Model<any>,
    private readonly cryptoService: PartnerCryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined =
      request.headers["x-api-key"] ||
      (request.headers["authorization"]?.startsWith("Bearer ")
        ? request.headers["authorization"].slice(7).trim()
        : undefined);

    if (!authHeader) {
      throw new UnauthorizedException("API key is required in X-API-Key or Authorization header");
    }

    const trimmedKey = authHeader.trim();
    if (!trimmedKey.startsWith("tv_test_") && !trimmedKey.startsWith("tv_live_")) {
      throw new UnauthorizedException("Invalid API key format");
    }

    const calculatedHash = this.cryptoService.hashSecret(trimmedKey);
    const keyRecord = await this.apiKeyModel
      .findOne({
        secretHash: calculatedHash,
      })
      .lean();

    if (!keyRecord) {
      throw new UnauthorizedException("Invalid API key");
    }

    // Constant-time hash verification
    const expectedBuf = Buffer.from(keyRecord.secretHash, "hex");
    const actualBuf = Buffer.from(calculatedHash, "hex");
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      throw new UnauthorizedException("Invalid API key");
    }

    if (keyRecord.status !== "active") {
      throw new UnauthorizedException("API key has been revoked");
    }

    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
      throw new UnauthorizedException("API key has expired");
    }

    // Verify Partner
    const partner = await this.partnerModel.findById(keyRecord.partnerId).lean();
    if (!partner) {
      throw new UnauthorizedException("Partner not found");
    }

    if (partner.status !== "active") {
      throw new UnauthorizedException(`Partner account is ${partner.status}`);
    }

    // Attach partner context to request
    const partnerContext: AuthenticatedPartnerContext = {
      partnerId: String(partner._id),
      partnerName: partner.name,
      partnerSlug: partner.slug,
      environment: keyRecord.environment,
      scopedAshramIds: (partner.scopedAshramIds ?? []).map(String),
      permissions: keyRecord.permissions ?? [],
      keyId: String(keyRecord._id),
      keyPrefix: keyRecord.keyPrefix,
      rateLimitPerMinute: partner.rateLimitPerMinute ?? 120,
    };

    request.partner = partnerContext;

    // Asynchronously update lastUsedAt on the API key without blocking request
    void this.apiKeyModel
      .updateOne({ _id: keyRecord._id }, { $set: { lastUsedAt: new Date() } })
      .exec();

    return true;
  }
}
