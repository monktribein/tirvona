import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { PartnerCryptoService } from "./partner-crypto.service";
import { validateWebhookUrl } from "./ssrf-validator.util";
import type {
  CreateApiKeyDto,
  CreatePartnerDto,
  CreateWebhookDto,
  UpdatePartnerDto,
  UpdateWebhookDto,
} from "../presentation/dtos/partner-management.dto";
import { PartnerWebhookDispatcherService } from "./partner-webhook-dispatcher.service";

@Injectable()
export class PartnerManagementService {
  constructor(
    @InjectModel("Partner") private readonly partnerModel: Model<any>,
    @InjectModel("PartnerApiKey") private readonly apiKeyModel: Model<any>,
    @InjectModel("PartnerWebhook") private readonly webhookModel: Model<any>,
    @InjectModel("PartnerWebhookDeliveryLog")
    private readonly deliveryLogModel: Model<any>,
    private readonly cryptoService: PartnerCryptoService,
    private readonly webhookDispatcher: PartnerWebhookDispatcherService,
  ) {}

  // -------------------------------------------------------------
  // PARTNERS
  // -------------------------------------------------------------
  async createPartner(user: AuthenticatedUser, dto: CreatePartnerDto) {
    const existing = await this.partnerModel.findOne({ slug: dto.slug.toLowerCase().trim() });
    if (existing) {
      throw new ConflictException("Partner slug already in use");
    }

    const partner = await this.partnerModel.create({
      ...dto,
      slug: dto.slug.toLowerCase().trim(),
      createdBy: user.id,
      updatedBy: user.id,
    });

    return partner;
  }

  async listPartners() {
    return this.partnerModel.find().sort({ createdAt: -1 }).lean();
  }

  async getPartner(partnerId: string) {
    const partner = await this.partnerModel.findById(partnerId).lean();
    if (!partner) throw new NotFoundException("Partner not found");
    return partner;
  }

  async updatePartner(user: AuthenticatedUser, partnerId: string, dto: UpdatePartnerDto) {
    const partner = await this.partnerModel.findById(partnerId);
    if (!partner) throw new NotFoundException("Partner not found");

    Object.assign(partner, dto, { updatedBy: user.id });
    await partner.save();
    return partner;
  }

  // -------------------------------------------------------------
  // API KEYS
  // -------------------------------------------------------------
  async createApiKey(user: AuthenticatedUser, partnerId: string, dto: CreateApiKeyDto) {
    const partner = await this.partnerModel.findById(partnerId);
    if (!partner) throw new NotFoundException("Partner not found");

    // Validate requested permissions are within partner's allowedPermissions
    const unauthorizedPermissions = dto.permissions.filter(
      (p) => !partner.allowedPermissions?.includes(p),
    );
    if (unauthorizedPermissions.length > 0) {
      throw new BadRequestException(
        `Permissions not granted to partner: ${unauthorizedPermissions.join(", ")}`,
      );
    }

    const prefixTag = dto.environment === "production" ? "tv_live_" : "tv_test_";
    const randomHex = this.cryptoService.generateRandomString(24);
    const fullKeySecret = `${prefixTag}${randomHex}`;
    const keyPrefix = `${prefixTag}${randomHex.slice(0, 6)}`;
    const secretHash = this.cryptoService.hashSecret(fullKeySecret);

    const apiKey = await this.apiKeyModel.create({
      partnerId: partner._id,
      name: dto.name,
      keyPrefix,
      secretHash,
      environment: dto.environment,
      permissions: dto.permissions,
      status: "active",
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: user.id,
    });

    return {
      key: apiKey,
      // Show complete secret only once upon creation
      rawSecret: fullKeySecret,
    };
  }

  async listApiKeys(partnerId: string) {
    return this.apiKeyModel.find({ partnerId }).sort({ createdAt: -1 }).lean();
  }

  async revokeApiKey(user: AuthenticatedUser, keyId: string) {
    const key = await this.apiKeyModel.findById(keyId);
    if (!key) throw new NotFoundException("API key not found");

    key.status = "revoked";
    key.revokedAt = new Date();
    key.revokedBy = user.id;
    await key.save();
    return key;
  }

  async rotateApiKey(user: AuthenticatedUser, keyId: string) {
    const existing = await this.apiKeyModel.findById(keyId);
    if (!existing) throw new NotFoundException("API key not found");

    // Revoke old key
    existing.status = "revoked";
    existing.revokedAt = new Date();
    existing.revokedBy = user.id;
    await existing.save();

    // Create new replacement key with identical properties
    return this.createApiKey(user, String(existing.partnerId), {
      name: `${existing.name} (Rotated)`,
      environment: existing.environment,
      permissions: existing.permissions,
      expiresAt: existing.expiresAt ? existing.expiresAt.toISOString() : undefined,
    });
  }

  // -------------------------------------------------------------
  // WEBHOOKS
  // -------------------------------------------------------------
  async createWebhook(user: AuthenticatedUser, partnerId: string, dto: CreateWebhookDto) {
    const partner = await this.partnerModel.findById(partnerId);
    if (!partner) throw new NotFoundException("Partner not found");

    // Validate URL against SSRF
    await validateWebhookUrl(dto.url);

    // Generate cryptographically secure signing secret
    const rawSigningSecret = `whsec_${this.cryptoService.generateRandomString(24)}`;
    const encrypted = this.cryptoService.encryptSecret(rawSigningSecret);

    const webhook = await this.webhookModel.create({
      partnerId: partner._id,
      url: dto.url,
      description: dto.description,
      subscribedEvents: dto.subscribedEvents,
      status: "active",
      secretCiphertext: encrypted.ciphertext,
      secretIv: encrypted.iv,
      secretTag: encrypted.tag,
      secretLast4: encrypted.last4,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return {
      webhook,
      // Show signing secret only once
      signingSecret: rawSigningSecret,
    };
  }

  async listWebhooks(partnerId?: string) {
    const query = partnerId ? { partnerId } : {};
    return this.webhookModel.find(query).sort({ createdAt: -1 }).lean();
  }

  async updateWebhook(user: AuthenticatedUser, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.webhookModel.findById(webhookId);
    if (!webhook) throw new NotFoundException("Webhook not found");

    if (dto.url) {
      await validateWebhookUrl(dto.url);
      webhook.url = dto.url;
    }
    if (dto.description !== undefined) webhook.description = dto.description;
    if (dto.status !== undefined) webhook.status = dto.status;
    if (dto.subscribedEvents !== undefined) webhook.subscribedEvents = dto.subscribedEvents;

    webhook.updatedBy = user.id;
    await webhook.save();
    return webhook;
  }

  async deleteWebhook(webhookId: string) {
    const result = await this.webhookModel.deleteOne({ _id: webhookId });
    if (result.deletedCount === 0) throw new NotFoundException("Webhook not found");
    return { success: true };
  }

  async rotateWebhookSecret(user: AuthenticatedUser, webhookId: string) {
    const webhook = await this.webhookModel.findById(webhookId);
    if (!webhook) throw new NotFoundException("Webhook not found");

    const newSecret = `whsec_${this.cryptoService.generateRandomString(24)}`;
    const encrypted = this.cryptoService.encryptSecret(newSecret);

    webhook.secretCiphertext = encrypted.ciphertext;
    webhook.secretIv = encrypted.iv;
    webhook.secretTag = encrypted.tag;
    webhook.secretLast4 = encrypted.last4;
    webhook.updatedBy = user.id;
    await webhook.save();

    return {
      webhook,
      signingSecret: newSecret,
    };
  }

  // -------------------------------------------------------------
  // DELIVERY LOGS
  // -------------------------------------------------------------
  async listDeliveryLogs(query: { webhookId?: string; partnerId?: string; status?: string; limit?: number }) {
    const filter: Record<string, any> = {};
    if (query.webhookId) filter.webhookId = query.webhookId;
    if (query.partnerId) filter.partnerId = query.partnerId;
    if (query.status) filter.status = query.status;

    const limit = Math.min(query.limit ?? 50, 100);
    return this.deliveryLogModel.find(filter).sort({ deliveredAt: -1 }).limit(limit).lean();
  }

  async retryDelivery(deliveryOrEventId: string) {
    if (!deliveryOrEventId?.trim()) {
      throw new BadRequestException("Delivery or event ID is required");
    }

    const trimmed = deliveryOrEventId.trim();
    let eventId = trimmed;

    const isObjectId = trimmed.match(/^[0-9a-fA-F]{24}$/);
    if (isObjectId) {
      const log = await this.deliveryLogModel.findById(trimmed).lean();
      if (log?.eventId) {
        eventId = log.eventId;
      }
    } else {
      const log = await this.deliveryLogModel.findOne({ eventId: trimmed }).lean();
      if (log?.eventId) {
        eventId = log.eventId;
      }
    }

    const success = await this.webhookDispatcher.retryEvent(eventId);
    if (!success) {
      throw new NotFoundException("Webhook event not found for retry");
    }

    return { success: true, eventId };
  }
}
