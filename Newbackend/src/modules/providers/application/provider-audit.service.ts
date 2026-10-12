import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import { currentRequestContext } from "../infrastructure/request-context";

type Actor = Pick<AuthenticatedUser, "id" | "role"> | null;

/**
 * Writes provider-domain actions to the platform `audit_logs` collection
 * (module "providers"). Data Dictionary 7.54: the audit trail records who did
 * what to which resource and why, and never the sensitive values themselves,
 * so callers pass identifiers, status changes and reason codes only. KYC
 * content, contact details, storage keys and notes must not be put in `details`.
 */
@Injectable()
export class ProviderAuditService {
  private readonly logger = new Logger(ProviderAuditService.name);

  constructor(@InjectModel("AuditLog") private readonly auditLogs: Model<any>) {}

  async log(
    actor: Actor,
    action: string,
    resourceType: string,
    resourceId: unknown,
    details: Record<string, unknown> = {},
    result: "SUCCESS" | "DENIED" | "FAILED" = "SUCCESS",
  ): Promise<void> {
    try {
      const request = currentRequestContext();
      await this.auditLogs.create({
        userId: actor?.id,
        action: `providers.${action}`,
        module: "providers",
        details: {
          resourceType,
          resourceId: resourceId ? String(resourceId) : undefined,
          actorRole: actor?.role ?? "system",
          result,
          ...details,
        },
        ipAddress: request?.ip,
        userAgent: request?.userAgent,
        requestId: request?.requestId,
        timestamp: new Date(),
      });
    } catch (error) {
      // Auditing must never break the business action it records.
      this.logger.error(
        `Audit write failed for ${action}: ${(error as Error).message}`,
      );
    }
  }
}
