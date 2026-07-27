import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'tirvona_sacred_govt_memory_secret_key_32bytes!!';
const KEY = crypto.scryptSync(SECRET_KEY, 'salt', 32);

/**
 * Encrypt sensitive government ID numbers (Aadhaar, Passport, DL)
 */
export const encryptSensitive = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypt sensitive government ID numbers
 */
export const decryptSensitive = (text) => {
  if (!text || !text.includes(':')) return text;
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return text;
  }
};

/**
 * Mask sensitive government ID numbers for display (e.g. XXXX-XXXX-1234)
 */
export const maskGovtId = (govtIdNumber) => {
  if (!govtIdNumber) return '';
  const decrypted = decryptSensitive(govtIdNumber);
  const clean = decrypted.replace(/\s+/g, '');
  if (clean.length <= 4) return '****';
  const visible = clean.slice(-4);
  const maskedLength = clean.length - 4;
  return `${'*'.repeat(maskedLength)}-${visible}`;
};
