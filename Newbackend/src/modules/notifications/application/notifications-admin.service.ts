import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { AudienceResolverService } from "../fcm/audience-resolver.service";
import { FcmService } from "../fcm/fcm.service";
import type {
  AudiencePreviewDto,
  SendCampaignDto,
} from "../presentation/notifications.dto";

const FCM_BATCH_SIZE = 500;

/** Sends an admin/ashram-owner push campaign: resolves the allowed
 * audience, writes each recipient's inbox row, and dispatches the FCM push
 * in batches. A recipient still gets the in-app inbox row even if they have
 * no registered device token. */
@Injectable()
export class NotificationsAdminService {
  constructor(
    @InjectModel("PushCampaign") private readonly campaigns: Model<any>,
    @InjectModel("UserNotification") private readonly userNotifications: Model<any>,
    @InjectModel("User") private readonly users: Model<any>,
    private readonly audience: AudienceResolverService,
    private readonly fcm: FcmService,
  ) {}

  async previewAudience(actor: AuthenticatedUser, dto: AudiencePreviewDto): Promise<number> {
    return this.audience.previewCount(actor, dto);
  }

  async listCustomers(actor: AuthenticatedUser, search?: string): Promise<any[]> {
    return this.audience.listPickableCustomers(actor, search);
  }

  async sendCampaign(actor: AuthenticatedUser, dto: SendCampaignDto): Promise<any> {
    const userIds = await this.audience.resolve(actor, dto);
    if (!userIds.length)
      throw new BadRequestException("No recipients matched the selected audience.");

    const campaign = await this.campaigns.create({
      senderId: actor.id,
      title: dto.title,
      body: dto.body,
      imageUrl: dto.imageUrl,
      deepLink: dto.deepLink,
      audienceType: dto.audienceType,
      targetRoles: dto.targetRoles ?? [],
      targetUserIds: dto.audienceType === "users" ? userIds : [],
      targetAshramIds: dto.ashramIds ?? [],
      recipientCount: userIds.length,
    });

    await this.userNotifications.insertMany(
      userIds.map((userId) => ({
        userId,
        campaignId: campaign._id,
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        deepLink: dto.deepLink,
      })),
    );

    const recipients = await this.users
      .find({ _id: { $in: userIds } })
      .select("fcmTokens")
      .lean();
    const tokens = recipients.flatMap((row: any) => row.fcmTokens ?? []);

    let sentCount = 0;
    let failedCount = 0;
    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const result = await this.fcm.sendToTokens(tokens.slice(i, i + FCM_BATCH_SIZE), {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: dto.deepLink ? { deepLink: dto.deepLink } : undefined,
      });
      sentCount += result.successCount;
      failedCount += result.failureCount;
    }

    campaign.sentCount = sentCount;
    campaign.failedCount = failedCount;
    campaign.status = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
    await campaign.save();
    return campaign.toObject();
  }

  async listCampaigns(
    actor: AuthenticatedUser,
    page: number,
    limit: number,
  ): Promise<any[]> {
    const filter = actor.role === "super_admin" ? {} : { senderId: actor.id };
    return this.campaigns
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
  }
}
