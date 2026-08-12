import { Schema, Types } from "mongoose";
import {
  SMART_CONTACT_QR_COLLECTION,
  SMART_CONTACT_QR_FORMATS,
  SMART_CONTACT_QR_SOURCES,
  SMART_CONTACT_QR_STATUSES,
} from "../../domain/smart-contact.constants";

/**
 * `smart_contact_qr_codes` — one row per printed QR asset (spec §17, §30).
 *
 * A profile has many of these because the same person's URL gets printed on a
 * visiting card, an ID card, a brochure and an event badge, and spec §28 wants
 * to know which placement a scan came from. The rows differ only by `source`
 * and the `?src=` parameter appended to `destinationUrl`; the slug underneath
 * is identical, which is what makes them all survive a profile edit.
 *
 * Artwork is not stored. Regenerating a PNG from the same `destinationUrl` is
 * deterministic and cheap, so the rendered bytes are a response, not a record
 * — which also means "Regenerate QR Artwork" (spec §20) provably cannot change
 * the URL, because the URL is the only thing persisted.
 */
export const SmartContactQrCodeSchema = new Schema(
  {
    profileId: {
      type: Types.ObjectId,
      required: true,
      index: true,
      immutable: true,
    },
    // Human-quotable identifier printed in the console and, optionally, in
    // small type on the artwork itself — e.g. `TSC-RB-00001` (spec §17). This
    // is what someone reads out when asking which card they are holding.
    qrIdentifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    // Immutable by design. This is the string burned into physical artwork;
    // changing it here would not change anything already printed, so allowing
    // the edit could only ever desynchronise the two.
    destinationUrl: { type: String, required: true, trim: true, immutable: true },
    source: {
      type: String,
      enum: SMART_CONTACT_QR_SOURCES,
      default: "business-card",
      index: true,
    },
    // Which formats have been requested for this asset. Informational — every
    // format stays renderable on demand regardless of what is listed here.
    formats: {
      type: [{ type: String, enum: SMART_CONTACT_QR_FORMATS }],
      default: ["svg", "png"],
    },
    status: {
      type: String,
      enum: SMART_CONTACT_QR_STATUSES,
      default: "ACTIVE",
      index: true,
    },
    label: { type: String, trim: true, default: "", maxlength: 120 },
    createdById: { type: String, trim: true, default: "", immutable: true },
    createdByName: { type: String, trim: true, default: "", immutable: true },
  },
  {
    timestamps: true,
    collection: SMART_CONTACT_QR_COLLECTION,
  },
);

SmartContactQrCodeSchema.index({ profileId: 1, status: 1, createdAt: -1 });
