import { Schema, SchemaTypes } from "mongoose";
export const AuthChallengeSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true, select: false },
    purpose: {
      type: String,
      enum: ["register", "login", "phone_login", "google"],
      required: true,
      index: true,
    },
    identifier: { type: String, required: true, index: true },
    payload: { type: SchemaTypes.Mixed, select: false },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    resendAvailableAt: Date,
    verifiedAt: Date,
    consumedAt: Date,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "auth_challenges" },
);
AuthChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthChallengeSchema.index({ identifier: 1, purpose: 1, createdAt: -1 });
