import { Schema, SchemaTypes } from "mongoose";

/**
 * Every public path an entity has ever answered to. When a slug or city
 * changes the old path is kept here so it can still 301 to the current one,
 * which is what stops previously indexed URLs from turning into 404s.
 */
export const UrlRedirectSchema = new Schema(
  {
    fromPath: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    toPath: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: SchemaTypes.ObjectId, index: true },
    reason: { type: String, default: "" },
  },
  { timestamps: true, collection: "url_redirects" },
);

UrlRedirectSchema.index({ entityType: 1, entityId: 1 });
