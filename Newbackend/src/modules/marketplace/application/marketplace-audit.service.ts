import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";

/** Writes marketplace actions to the platform-wide `audit_logs` collection (AuditModule). */
@Injectable()
export class MarketplaceAuditService {
  private readonly logger = new Logger(MarketplaceAuditService.name);

  constructor(@InjectModel("AuditLog") private readonly auditLogs: Model<any>) {}

  async log(
    actor: Pick<AuthenticatedUser, "id" | "role"> | null,
    action: string,
    entity: string,
    entityId: unknown,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      const { before, after, ...rest } = details as any;
      await this.auditLogs.create({
        userId: actor?.id,
        action: `marketplace.${action}`,
        module: "marketplace",
        details: { entity, entityId: entityId ? String(entityId) : undefined, actorRole: actor?.role ?? "system", ...rest },
        before,
        after,
        timestamp: new Date(),
      });
    } catch (err: any) {
      // Auditing must never break the business action it records.
      this.logger.error(`Audit write failed for ${action}: ${err?.message}`);
    }
  }

  /** Latest marketplace actions, for the admin overview's activity feed. */
  async recent(limit = 10): Promise<any[]> {
    return this.auditLogs
      .find({ module: "marketplace" })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select("action details.entity details.entityId details.actorRole details.reason timestamp")
      .lean();
  }
}
