import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "../../../database/orm-nest";
import type { Model } from "../../../database/orm";

/**
 * Writes HR changes to the shared audit_logs table (module "HR"). Only ids, field names and
 * non-sensitive values go in: never contact details, notes or anything a token could be in.
 */
@Injectable()
export class HrAuditService {
  private readonly logger = new Logger(HrAuditService.name);

  constructor(@InjectModel("AuditLog") private readonly audits: Model<any>) {}

  async record(actorId: string, action: string, details: Record<string, unknown>, before?: unknown, after?: unknown) {
    try {
      await this.audits.create({ userId: actorId, action, module: "HR", details, before, after });
    } catch (error) {
      // The change itself already succeeded; a failed audit write is logged loudly, not hidden.
      this.logger.error(`HR audit write failed for ${action}: ${(error as Error).message}`);
    }
  }
}
