import { Schema, Types } from "mongoose";
import {
  SMART_CONTACT_AUDIT_ACTIONS,
  SMART_CONTACT_AUDIT_COLLECTION,
} from "../../domain/smart-contact.constants";

/**
 * `smart_contact_audit_logs` — who changed what, and to what (spec §37).
 *
 * A local collection rather than the platform's audit module, because the
 * module's database isolation is the point: an extracted Smart Contact service
 * has to carry its own history with it. The trade-off is that these entries do
 * not appear in the platform's System Audit Logs page; the Smart Contact
 * console surfaces them per profile instead.
 *
 * Unlike the event log this one *does* record an IP, because §37 names it as a
 * field and the subject here is a Tirvona staff member acting on the system,
 * not a member of the public visiting a page.
 */
export const SmartContactAuditSchema = new Schema(
  {
    profileId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      immutable: true,
    },
    action: {
      type: String,
      enum: SMART_CONTACT_AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    field: { type: String, trim: true, default: "" },
    // Stringified on write. Values here are business contact fields — a phone
    // number, a designation — so there is no secret to redact, but they are
    // stored as text rather than mixed so a malformed value can never change
    // the shape of the document.
    oldValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
    actorId: { type: String, trim: true, default: "", immutable: true },
    actorName: { type: String, trim: true, default: "", immutable: true },
    ip: { type: String, trim: true, default: "" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: SMART_CONTACT_AUDIT_COLLECTION,
  },
);

SmartContactAuditSchema.index({ profileId: 1, createdAt: -1 });
