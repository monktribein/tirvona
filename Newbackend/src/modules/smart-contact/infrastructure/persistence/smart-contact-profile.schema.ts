import { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import {
  SMART_CONTACT_BRANDS,
  SMART_CONTACT_CATEGORIES,
  SMART_CONTACT_PROFILE_COLLECTION,
  SMART_CONTACT_STATUSES,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from "../../domain/smart-contact.constants";

/**
 * `smart_contact_profiles` — the identity behind a printed QR (spec §29).
 *
 * The whole product rests on one invariant: `slug` is permanent. Every printed
 * card, ID badge and brochure encodes a URL built from it, so a slug change
 * silently bricks physical artwork that is already in people's wallets. The
 * schema cannot enforce "permanent" outright — spec §20 allows a deliberate
 * change — so the service gates it behind an explicit flag and writes a
 * `SLUG_CHANGED` audit line; the index below only guarantees uniqueness.
 *
 * Note there is no `photoAssetId` ref and no `createdBy` ref: platform users
 * and Cloudinary assets live outside this database, so both are stored flat.
 * A `populate()` across databases would fail at runtime, and the absence of
 * any ref is what keeps that from ever being attempted.
 */
export const SmartContactProfileSchema = new Schema(
  {
    // A stable external identifier that is not the Mongo `_id`. The spec's
    // model lists both; keeping `uuid` means an extracted service can migrate
    // storage engines without invalidating anything that referenced a profile.
    uuid: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: () => randomUUID(),
    },
    employeeId: { type: String, trim: true, default: "", index: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: SLUG_MIN_LENGTH,
      maxlength: SLUG_MAX_LENGTH,
      match: SLUG_PATTERN,
    },

    // ── Identity (spec §19) ────────────────────────────────────────────────
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, default: "", maxlength: 80 },
    // Derived from first + last when the admin leaves it blank, but stored
    // rather than computed: a representative may present a name that is not
    // simply the concatenation, and the vCard `FN` has to match the card.
    displayName: { type: String, required: true, trim: true, maxlength: 160 },

    // ── Organization ───────────────────────────────────────────────────────
    organization: { type: String, trim: true, default: "Tirvona" },
    designation: { type: String, trim: true, default: "", maxlength: 120 },
    department: { type: String, trim: true, default: "", maxlength: 120 },
    roleLine: { type: String, trim: true, default: "", maxlength: 160 },

    // ── Contact ────────────────────────────────────────────────────────────
    // Phones are stored E.164-normalised by the service. The vCard and the
    // wa.me link both need an unambiguous international form, and normalising
    // on write means neither has to guess at read time.
    primaryPhone: { type: String, trim: true, default: "" },
    secondaryPhone: { type: String, trim: true, default: "" },
    whatsappPhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    website: { type: String, trim: true, default: "" },

    // ── Address (spec §38: business address only, never a home address) ────
    addressLine1: { type: String, trim: true, default: "", maxlength: 200 },
    addressLine2: { type: String, trim: true, default: "", maxlength: 200 },
    city: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },

    // ── Media ──────────────────────────────────────────────────────────────
    photoUrl: { type: String, trim: true, default: "" },
    photoAssetId: { type: String, trim: true, default: "" },

    // ── Classification ─────────────────────────────────────────────────────
    brandId: {
      type: String,
      enum: SMART_CONTACT_BRANDS,
      default: "tirvona",
      index: true,
    },
    category: {
      type: String,
      enum: SMART_CONTACT_CATEGORIES,
      default: "employee",
      index: true,
    },
    status: {
      type: String,
      enum: SMART_CONTACT_STATUSES,
      default: "DRAFT",
      index: true,
    },

    // Platform identities, denormalised. Stored as plain strings, not refs:
    // the platform `users` collection lives in another database and must never
    // be populated from here.
    createdById: { type: String, trim: true, default: "", immutable: true },
    createdByName: { type: String, trim: true, default: "", immutable: true },
    updatedById: { type: String, trim: true, default: "" },
    updatedByName: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
    collection: SMART_CONTACT_PROFILE_COLLECTION,
    optimisticConcurrency: true,
  },
);

// The public page resolves by slug on every scan, and only ever for a profile
// that is not a draft. A compound index keeps that lookup covered.
SmartContactProfileSchema.index({ slug: 1, status: 1 });
SmartContactProfileSchema.index({ status: 1, createdAt: -1 });
SmartContactProfileSchema.index({ category: 1, status: 1 });
// Console search across the fields the admin actually types into the box.
SmartContactProfileSchema.index({
  displayName: 1,
  email: 1,
  employeeId: 1,
});
