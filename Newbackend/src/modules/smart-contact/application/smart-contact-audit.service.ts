import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  SMART_CONTACT_AUDIT_MODEL,
  SMART_CONTACT_CONNECTION,
  type SmartContactAuditAction,
} from "../domain/smart-contact.constants";
import type { ActorRef } from "../domain/smart-contact.types";

export interface AuditEntryInput {
  profileId: Types.ObjectId | string;
  action: SmartContactAuditAction;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actor: ActorRef | null;
  ip?: string;
}

/**
 * The Smart Contact audit trail (spec §37).
 *
 * Writes are fire-and-forget by design: an audit failure must never roll back
 * a change the admin has already been told succeeded, and the alternative —
 * failing the request — would make the console less reliable than the log it
 * feeds. Failures are logged loudly instead.
 */
@Injectable()
export class SmartContactAuditService {
  private readonly logger = new Logger(SmartContactAuditService.name);

  constructor(
    @InjectModel(SMART_CONTACT_AUDIT_MODEL, SMART_CONTACT_CONNECTION)
    private readonly audits: Model<Record<string, unknown>>,
  ) {}

  private stringify(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  async record(entry: AuditEntryInput): Promise<void> {
    try {
      await this.audits.create({
        profileId: new Types.ObjectId(String(entry.profileId)),
        action: entry.action,
        field: entry.field ?? "",
        oldValue: this.stringify(entry.oldValue),
        newValue: this.stringify(entry.newValue),
        actorId: entry.actor?.id ?? "",
        actorName: entry.actor?.name ?? "",
        ip: entry.ip ?? "",
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit entry ${entry.action} for profile ${String(entry.profileId)}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async recordMany(entries: AuditEntryInput[]): Promise<void> {
    await Promise.all(entries.map((entry) => this.record(entry)));
  }

  /** Per-profile history for the console's audit tab. */
  async list(
    profileId: string,
    limit = 100,
  ): Promise<Record<string, unknown>[]> {
    if (!Types.ObjectId.isValid(profileId)) return [];
    const rows = await this.audits
      .find({ profileId: new Types.ObjectId(profileId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(500, Math.max(1, limit)))
      .lean();
    return rows.map((row) => ({
      id: String(row._id),
      action: row.action,
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      actor: row.actorId
        ? { id: row.actorId, name: row.actorName }
        : null,
      ip: row.ip,
      createdAt: row.createdAt,
    }));
  }
}
