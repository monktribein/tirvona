import dotenv from 'dotenv';

dotenv.config();

// Centralised, validated environment configuration.
// Fail fast at boot rather than silently falling back to insecure defaults.
const required = ['MONGODB_URI', 'JWT_SECRET'];

const missing = required.filter((key) => !process.env[key] || !process.env[key].trim());

if (missing.length > 0) {
  // In production we must never boot with missing secrets.
  const message = `FATAL: Missing required environment variables: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(message);
    process.exit(1);
  } else {
    console.warn(`${message} (continuing in non-production mode)`);
  }
}

if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 24) {
  console.warn('WARNING: JWT_SECRET is short and weak. Use a long, random value (>=32 chars) in production.');
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/ashray_bharat',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  clientUrl: process.env.CLIENT_URL,
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    get configured() {
      return Boolean(this.cloudName && this.apiKey && this.apiSecret);
    },
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    get configured() {
      return Boolean(this.keyId && this.keySecret);
    },
  },
  // OTP policy. Kept in one place so the services, the model TTL and the
  // rate limiters all agree on the same numbers.
  otp: {
    // Master switch for SMS delivery. While false, every OTP — registration and
    // login — is delivered by email instead, and no SMS is dispatched. The MSG91
    // service and all phone-OTP code paths stay intact; set this to `true` (and
    // fill in MSG91_AUTH_KEY) to turn phone OTP back on.
    smsEnabled: process.env.OTP_SMS_ENABLED === 'true',
    length: parseInt(process.env.OTP_LENGTH, 10) || 6,
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 30,
  },
  // MSG91 transactional SMS gateway.
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY,
    senderId: process.env.MSG91_SENDER_ID || 'TRVONA',
    templateId: process.env.MSG91_TEMPLATE_ID,
    route: process.env.MSG91_ROUTE || '4',
    countryCode: process.env.MSG91_COUNTRY_CODE || '91',
    get configured() {
      return Boolean(this.authKey);
    },
  },
  // Google Sign-In. The client ID is public (it ships in the frontend bundle);
  // it is kept here so the backend can verify that an ID token was minted for
  // *this* application and not some other Google project.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    get configured() {
      return Boolean(this.clientId);
    },
  },
  // Resend transactional email (OTP, password reset, notifications, messages).
  // Replaces the previous SMTP/Nodemailer transport: a single HTTPS API key
  // instead of host/port/user/pass, no connection pool to go stale, and no
  // Gmail App Password to be silently revoked mid-process.
  //
  // `fromEmail` must be on a domain verified in the Resend dashboard, otherwise
  // Resend rejects the send. Use `onboarding@resend.dev` for local testing —
  // it only delivers to the address that owns the Resend account.
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromName: process.env.EMAIL_FROM_NAME || 'Tirvona',
    fromEmail: process.env.EMAIL_FROM_EMAIL || 'no-reply@tirvona.com',
    replyTo: process.env.EMAIL_REPLY_TO || 'support@tirvona.com',
    get configured() {
      return Boolean(this.apiKey);
    },
    // Full RFC 5322 sender used on every message.
    get from() {
      return `${this.fromName} <${this.fromEmail}>`;
    },
  },
};

export default config;
