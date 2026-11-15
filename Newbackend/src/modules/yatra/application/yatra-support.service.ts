import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { v2 as cloudinary } from "cloudinary";
import { InjectModel } from "../../../database/orm-nest";
import type { ClientSession, Model } from "../../../database/orm";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { InAppNotificationService } from "../../notifications/application/in-app-notification.service";
import { renderEmail, renderEmailText, type EmailTemplateInput } from "../../notifications/email-template";
import { Resend } from "resend";
import {
  DOCUMENT_LINK_SECONDS,
  YATRA_AUDIT_MODULE,
  YATRA_DEFAULT_SETTINGS,
  YATRA_MODEL,
  YATRA_SETTING_LIMITS,
  type MemberPermission,
} from "../domain/yatra.constants";
import { YatraException } from "../domain/yatra.errors";
import { memberCan, toPaise } from "../domain/yatra.utils";

export type YatraActor = Pick<AuthenticatedUser, "id" | "role"> & Partial<AuthenticatedUser>;

/** Who the caller is inside an organiser, and the organiser itself. */
@Injectable()
export class YatraAccessService {
  constructor(
    @InjectModel(YATRA_MODEL.Member) private readonly members: Model<any>,
    @InjectModel(YATRA_MODEL.Operator) private readonly operators: Model<any>,
  ) {}

  async membership(userId: string): Promise<{ member: any; operator: any } | null> {
    const member = await this.members.findOne({ userId, status: "active" }).lean();
    if (!member) return null;
    const operator = await this.operators.findById(member.operatorId).lean();
    if (!operator) return null;
    return { member, operator };
  }

  /**
   * The caller's organiser, after checking the caller's organiser role allows
   * `permission`. With `approved`, a suspended or unapproved organiser is
   * refused too. Every organiser endpoint goes through here, so one organiser
   * can never reach another's records.
   */
  async require(
    user: YatraActor,
    permission?: MemberPermission,
    options: { approved?: boolean; writable?: boolean } = {},
  ): Promise<{ member: any; operator: any }> {
    const found = await this.membership(user.id);
    if (!found)
      throw new YatraException("You have not registered as a Yatra organiser yet.", 404, "NOT_AN_ORGANISER");
    if (permission && !memberCan(found.member.role, permission))
      throw new YatraException("Your organiser role does not allow this. Ask your organisation's owner.", 403, "ROLE_NOT_ALLOWED");
    if (options.writable && found.operator.status === "suspended")
      throw new YatraException("Your organisation is suspended. Contact Tirvona support.", 403, "OPERATOR_SUSPENDED");
    if (options.approved && found.operator.status !== "approved")
      throw new YatraException(
        found.operator.status === "suspended"
          ? "Your organisation is suspended. Contact Tirvona support."
          : "Tirvona has not approved your organisation yet.",
        403,
        "OPERATOR_NOT_APPROVED",
      );
    return found;
  }
}

/** Writes Yatra actions to the platform audit log (module "yatra"). */
@Injectable()
export class YatraAuditService {
  private readonly logger = new Logger(YatraAuditService.name);
  constructor(@InjectModel("AuditLog") private readonly audits: Model<any>) {}

  async record(
    actor: { id?: string } | null,
    action: string,
    details: Record<string, unknown>,
    change: { before?: unknown; after?: unknown } = {},
    session?: ClientSession,
  ): Promise<void> {
    const row = {
      userId: actor?.id ?? null,
      action,
      module: YATRA_AUDIT_MODULE,
      details,
      before: change.before ?? null,
      after: change.after ?? null,
      timestamp: new Date(),
    };
    if (session) {
      await this.audits.create([row], { session });
      return;
    }
    try {
      await this.audits.create(row);
    } catch (error) {
      this.logger.error(`Yatra audit write failed for ${action}: ${(error as Error).message}`);
    }
  }
}

export interface YatraSettings {
  holdMinutes: number;
  paymentLinkMinutes: number;
  maxSeatsPerBooking: number;
  salesCloseMinutes: number;
  supportPhone: string;
  rideFullRefundHours: number;
  ridePartnerResponseHours: number;
  reminderHours: number;
}

@Injectable()
export class YatraSettingsService {
  constructor(@InjectModel(YATRA_MODEL.Setting) private readonly settings: Model<any>) {}

  async get(): Promise<YatraSettings> {
    const row = await this.settings.findOne({ scope: "platform" }).lean();
    const pick = (key: keyof typeof YATRA_SETTING_LIMITS): number => {
      const value = Number(row?.[key]);
      const { min, max } = YATRA_SETTING_LIMITS[key];
      return Number.isFinite(value) && row?.[key] !== null && value >= min && value <= max
        ? value
        : YATRA_DEFAULT_SETTINGS[key];
    };
    return {
      holdMinutes: pick("holdMinutes"),
      paymentLinkMinutes: pick("paymentLinkMinutes"),
      maxSeatsPerBooking: pick("maxSeatsPerBooking"),
      salesCloseMinutes: pick("salesCloseMinutes"),
      supportPhone: String(row?.supportPhone ?? ""),
      rideFullRefundHours: pick("rideFullRefundHours"),
      ridePartnerResponseHours: pick("ridePartnerResponseHours"),
      reminderHours: pick("reminderHours"),
    };
  }

  async update(input: Partial<YatraSettings>, actorId: string): Promise<{ before: YatraSettings; after: YatraSettings }> {
    const before = await this.get();
    const set: Record<string, unknown> = { updatedBy: actorId };
    for (const key of Object.keys(YATRA_SETTING_LIMITS) as Array<keyof typeof YATRA_SETTING_LIMITS>) {
      if (input[key] === undefined) continue;
      const value = Number(input[key]);
      const { min, max } = YATRA_SETTING_LIMITS[key];
      if (!Number.isInteger(value) || value < min || value > max)
        throw new YatraException(`${key} must be a whole number from ${min} to ${max}.`, 400);
      set[key] = value;
    }
    if (input.supportPhone !== undefined) set.supportPhone = String(input.supportPhone).trim().slice(0, 20);
    await this.settings.updateOne({ scope: "platform" }, { $set: set, $setOnInsert: { scope: "platform" } }, { upsert: true });
    return { before, after: await this.get() };
  }
}

export interface GatewayOrder {
  demo: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

/**
 * Tirvona's existing Razorpay account. With no keys configured (local
 * development only) it runs in demo mode; production refuses to take a
 * booking without keys.
 */
@Injectable()
export class YatraGatewayService {
  constructor(private readonly config: ConfigService) {}

  private keys(): { keyId: string; keySecret: string } | null {
    const keyId = this.config.get<string>("razorpayKeyId") ?? "";
    const keySecret = this.config.get<string>("razorpayKeySecret") ?? "";
    return keyId && keySecret ? { keyId, keySecret } : null;
  }

  private isProduction(): boolean {
    return this.config.get<string>("nodeEnv") === "production";
  }

  async createOrder(amountRupees: number, receipt: string, notes: Record<string, string>): Promise<GatewayOrder> {
    const keys = this.keys();
    const amount = toPaise(amountRupees);
    if (amount < 100) throw new YatraException("The amount to pay is too small.", 400);
    if (!keys) {
      if (this.isProduction())
        throw new ServiceUnavailableException("Online payment is not configured. Please try again later.");
      return { demo: true, orderId: `demo_order_${randomBytes(8).toString("hex")}`, amount, currency: "INR", keyId: "" };
    }
    const razorpay = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
    const order: any = await razorpay.orders.create({ amount, currency: "INR", receipt: receipt.slice(0, 40), notes });
    return { demo: false, orderId: String(order.id), amount: Number(order.amount), currency: String(order.currency), keyId: keys.keyId };
  }

  /** Checks Razorpay's checkout signature. Demo orders verify only outside production. */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const keys = this.keys();
    if (!keys) return !this.isProduction() && orderId.startsWith("demo_order_") && paymentId.startsWith("demo_pay_");
    if (!orderId || !paymentId || !signature) return false;
    const expected = Buffer.from(createHmac("sha256", keys.keySecret).update(`${orderId}|${paymentId}`).digest("hex"));
    const actual = Buffer.from(signature);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

/** In-app notifications (inbox, live socket, push). Never throws. */
@Injectable()
export class YatraNotifier {
  private readonly logger = new Logger(YatraNotifier.name);
  constructor(
    private readonly inApp: InAppNotificationService,
    @InjectModel(YATRA_MODEL.Member) private readonly members: Model<any>,
    @InjectModel(YATRA_MODEL.UserRef) private readonly userRefs: Model<any>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Transactional email through the existing Resend account and Tirvona email
   * template. Off unless YATRA_EMAIL_ENABLED=true and Resend is configured.
   * Never throws.
   */
  async emailCustomer(
    target: { customerId?: unknown; contact?: { email?: string; name?: string } },
    input: Omit<EmailTemplateInput, "siteUrl" | "cta"> & { ctaPath?: string },
  ): Promise<boolean> {
    try {
      const apiKey = this.config.get<string>("resendApiKey");
      const from = this.config.get<string>("resendFromEmail");
      if (!this.config.get<boolean>("yatraEmailEnabled") || !apiKey || !from) return false;
      let to = target.contact?.email ?? "";
      let name = target.contact?.name ?? "";
      if (!to && target.customerId) {
        const user = await this.userRefs.findById(target.customerId).select("email name").lean();
        to = user?.email ?? "";
        name = name || user?.name || "";
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
      const siteUrl = String(this.config.get<string>("frontendUrl") ?? "").replace(/\/+$/, "");
      const { ctaPath, ...rest } = input;
      const body: EmailTemplateInput = { ...rest, siteUrl, recipientName: name, ...(ctaPath ? { cta: { label: "Open in Tirvona", url: `${siteUrl}${ctaPath}` } } : {}) };
      await new Resend(apiKey).emails.send({ from, to, replyTo: this.config.get<string>("resendReplyTo") || undefined, subject: input.title, html: renderEmail(body), text: renderEmailText(body) });
      return true;
    } catch (error) {
      this.logger.warn(`Yatra email failed: ${(error as Error).message}`);
      return false;
    }
  }

  async users(userIds: Array<string | null | undefined>, title: string, body: string, deepLink?: string, kind = "yatra"): Promise<void> {
    try {
      await this.inApp.notifyUsers(userIds.filter(Boolean).map(String), { title, body, deepLink, kind });
    } catch (error) {
      this.logger.warn(`Yatra notification failed: ${(error as Error).message}`);
    }
  }

  /** The organiser's owner and managers. */
  async operatorTeam(operatorId: string, title: string, body: string, deepLink?: string, kind = "yatra.operator"): Promise<void> {
    try {
      const team = await this.members
        .find({ operatorId, status: "active", role: { $in: ["owner", "manager"] } })
        .select("userId")
        .lean();
      await this.users(team.map((m: any) => String(m.userId)), title, body, deepLink, kind);
    } catch (error) {
      this.logger.warn(`Yatra team notification failed: ${(error as Error).message}`);
    }
  }
}

/**
 * Private document storage: Cloudinary "authenticated" assets, which have no
 * public URL. Viewing one needs a signed, short-lived download link.
 */
@Injectable()
export class YatraDocumentStorage {
  constructor(private readonly config: ConfigService) {}

  private configure(): void {
    const cloudName = this.config.get<string>("cloudinaryCloudName");
    const apiKey = this.config.get<string>("cloudinaryApiKey");
    const apiSecret = this.config.get<string>("cloudinaryApiSecret");
    if (!cloudName || !apiKey || !apiSecret)
      throw new ServiceUnavailableException("Document storage is not configured.");
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  async put(
    buffer: Buffer,
    folder: string,
    resourceType: "image" | "raw",
  ): Promise<{ publicId: string; resourceType: string; format: string; bytes: number }> {
    this.configure();
    const base = this.config.get<string>("cloudinaryFolder") ?? "tirvona";
    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `${base}/${folder}`, type: "authenticated", resource_type: resourceType },
        (error, value) => (error ? reject(error) : resolve(value)),
      );
      stream.end(buffer);
    });
    return {
      publicId: String(result.public_id),
      resourceType: String(result.resource_type),
      format: String(result.format ?? ""),
      bytes: Number(result.bytes ?? buffer.length),
    };
  }

  signedUrl(storage: { publicId: string; resourceType: string; format: string }): { url: string; expiresAt: Date } {
    this.configure();
    const expiresAt = new Date(Date.now() + DOCUMENT_LINK_SECONDS * 1000);
    const url = cloudinary.utils.private_download_url(storage.publicId, storage.format || "", {
      resource_type: storage.resourceType,
      type: "authenticated",
      expires_at: Math.floor(expiresAt.getTime() / 1000),
    });
    return { url, expiresAt };
  }

  async remove(storage: { publicId: string; resourceType: string }): Promise<void> {
    try {
      this.configure();
      await cloudinary.uploader.destroy(storage.publicId, { type: "authenticated", resource_type: storage.resourceType });
    } catch {
      // Best effort: the database row is what grants access, and it is gone.
    }
  }
}
