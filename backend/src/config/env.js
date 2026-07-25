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
};

export default config;
