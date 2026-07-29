import mongoose from 'mongoose';

// The three OTP purposes the platform issues codes for. Kept as a shared export
// so services, controllers and validators cannot drift apart on the spelling.
export const OTP_TYPES = {
  PHONE_REGISTER: 'PHONE_REGISTER',
  // Used for account creation while SMS delivery is switched off
  // (config.otp.smsEnabled === false). Same flow, email channel.
  EMAIL_REGISTER: 'EMAIL_REGISTER',
  EMAIL_LOGIN: 'EMAIL_LOGIN',
  MOBILE_LOGIN: 'MOBILE_LOGIN',
};

// Types delivered over email rather than SMS.
export const EMAIL_OTP_TYPES = [OTP_TYPES.EMAIL_REGISTER, OTP_TYPES.EMAIL_LOGIN];

// The two registration types, whichever channel is currently active.
export const REGISTER_OTP_TYPES = [OTP_TYPES.PHONE_REGISTER, OTP_TYPES.EMAIL_REGISTER];

const otpSchema = new mongoose.Schema(
  {
    // Absent for pre-account challenges (Google sign-up, where the code is
    // verified before the User document is created). Exactly one of `userId`
    // or `identifier` is set.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    // Email address a pre-account challenge belongs to.
    identifier: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    // SHA-256 of the code. The plain OTP is never persisted, never logged, and
    // never returned to the client outside non-production dev mode.
    otpHash: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(OTP_TYPES),
      required: true,
      index: true,
    },
    // Destination the code was delivered to, recorded for audit and so a resend
    // reuses the same channel. Only one is set per OTP.
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    // Failed verification attempts. Once this hits config.otp.maxAttempts the
    // code is dead and the user must request a new one.
    attempts: {
      type: Number,
      default: 0,
    },
    // Last time a code of this type was dispatched — drives the resend cooldown.
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    // Outcome of the actual send. The record is written before delivery is
    // attempted, so without these you cannot tell "code created" from "code
    // delivered" after the fact — which makes "I never got the email" reports
    // impossible to diagnose.
    delivered: {
      type: Boolean,
      default: false,
    },
    deliveryError: {
      type: String,
      default: '',
    },
    // Resend email id (or SMS gateway request id), for correlating with the
    // provider's own logs — e.g. https://resend.com/emails/<id>.
    providerMessageId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Only one active (unverified) OTP may exist per user per type. A new request
// replaces the previous document rather than leaving several codes valid.
// Partial, so the many pre-account documents (which have no userId) do not all
// collide on a single null key.
otpSchema.index(
  { userId: 1, type: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true } } }
);

// Same invariant for pre-account challenges, keyed by email instead.
otpSchema.index(
  { identifier: 1, type: 1 },
  { unique: true, partialFilterExpression: { identifier: { $exists: true } } }
);

// Mongo reaps consumed/expired documents an hour past expiry, so the collection
// stays small without needing a cleanup job. The grace period keeps a just-used
// OTP around briefly for audit correlation.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

const Otp = mongoose.model('Otp', otpSchema);
export default Otp;
