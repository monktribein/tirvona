import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import * as admin from "firebase-admin";

export interface FcmSendInput {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  successCount: number;
  failureCount: number;
}

const FCM_MULTICAST_BATCH_SIZE = 500;

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/** Thin wrapper around the Firebase Admin Messaging API. A no-op (logs and
 * returns zero counts) when no service-account credentials are configured,
 * so the rest of the notifications pipeline works in dev without Firebase. */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private app: admin.app.App | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectModel("User") private readonly users: Model<any>,
  ) {}

  onModuleInit(): void {
    const projectId = this.config.get<string>("firebaseProjectId");
    const clientEmail = this.config.get<string>("firebaseClientEmail");
    const privateKey = this.config.get<string>("firebasePrivateKey");
    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        JSON.stringify({ event: "fcm.disabled", reason: "credentials_missing" }),
      );
      return;
    }
    this.app = admin.apps.length
      ? (admin.app() as admin.app.App)
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            // .env files can't hold real newlines, so the key is stored with
            // literal "\n" escapes and unescaped here.
            privateKey: privateKey.replace(/\\n/g, "\n"),
          }),
        });
  }

  get isConfigured(): boolean {
    return this.app !== null;
  }

  async sendToTokens(
    tokens: string[],
    input: FcmSendInput,
  ): Promise<FcmSendResult> {
    const unique = [...new Set(tokens.filter(Boolean))];
    if (!unique.length || !this.app) return { successCount: 0, failureCount: 0 };

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < unique.length; i += FCM_MULTICAST_BATCH_SIZE) {
      const batch = unique.slice(i, i + FCM_MULTICAST_BATCH_SIZE);
      try {
        const response = await admin.messaging(this.app).sendEachForMulticast({
          tokens: batch,
          notification: {
            title: input.title,
            body: input.body,
          },
          data: input.data ?? {},
          android: {
            notification: input.imageUrl ? { imageUrl: input.imageUrl } : undefined,
          },
          apns: {
            fcmOptions: input.imageUrl ? { imageUrl: input.imageUrl } : undefined,
          },
        });
        successCount += response.successCount;
        failureCount += response.failureCount;
        response.responses.forEach((result, index) => {
          if (!result.success && INVALID_TOKEN_ERROR_CODES.has(result.error?.code ?? ""))
            invalidTokens.push(batch[index]);
        });
      } catch (error) {
        failureCount += batch.length;
        this.logger.error(
          JSON.stringify({
            event: "fcm.batch_send_failed",
            batchSize: batch.length,
            errorType: (error as Error).name,
          }),
        );
      }
    }

    if (invalidTokens.length) {
      await this.users.updateMany(
        { fcmTokens: { $in: invalidTokens } },
        { $pull: { fcmTokens: { $in: invalidTokens } } },
      );
    }

    return { successCount, failureCount };
  }

  async sendToUser(userId: string, input: FcmSendInput): Promise<FcmSendResult> {
    const user = await this.users.findById(userId).select("fcmTokens").lean();
    const tokens: string[] = (user as any)?.fcmTokens ?? [];
    if (!tokens.length) return { successCount: 0, failureCount: 0 };
    return this.sendToTokens(tokens, input);
  }
}
