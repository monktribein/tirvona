// Shared input validation for the authentication + OTP flows.
// Every helper returns `null` when the value is acceptable, or a human-readable
// message when it is not, so callers can do: `const err = validateEmail(x); if (err) ...`

// Mirrors the `match` regex on the User model so a value that passes validation
// here can never be rejected later by Mongoose.
const EMAIL_PATTERN = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

// Indian mobile numbers: 10 digits starting 6-9, optionally prefixed with +91/91/0.
const PHONE_PATTERN = /^(?:\+?91|0)?[6-9]\d{9}$/;

export const validateEmail = (email) => {
  if (typeof email !== 'string' || !email.trim()) return 'Email is required';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Please provide a valid email address';
  return null;
};

export const validatePhone = (phone) => {
  if (typeof phone !== 'string' || !phone.trim()) return 'Mobile number is required';
  if (!PHONE_PATTERN.test(phone.replace(/[\s-]/g, ''))) return 'Please provide a valid 10-digit Indian mobile number';
  return null;
};

export const validatePassword = (password) => {
  if (typeof password !== 'string' || !password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
};

export const validateName = (name) => {
  if (typeof name !== 'string' || !name.trim()) return 'Full name is required';
  if (name.trim().length < 2) return 'Please provide your full name';
  return null;
};

export const validateOtp = (otp, length = 6) => {
  if (typeof otp !== 'string' && typeof otp !== 'number') return 'OTP is required';
  const value = String(otp).trim();
  if (!value) return 'OTP is required';
  if (!new RegExp(`^\\d{${length}}$`).test(value)) return `OTP must be ${length} digits`;
  return null;
};

// Reduce any accepted phone format to the bare 10-digit national number, so a
// user who registered as "+91 98765 43210" can log in as "9876543210".
export const normalizePhone = (phone) => String(phone || '').replace(/[\s-]/g, '').replace(/^(?:\+?91|0)/, '');

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

// The login form has a single field that accepts either an email or a mobile
// number. Anything containing '@' is treated as an email; otherwise, if it looks
// like a phone number, it is one.
export const detectIdentifierType = (identifier) => {
  const value = String(identifier || '').trim();
  if (value.includes('@')) return 'email';
  if (PHONE_PATTERN.test(value.replace(/[\s-]/g, ''))) return 'phone';
  return 'unknown';
};

// Run a set of `[value, validatorFn]` pairs and return the first failure.
export const firstError = (checks) => {
  for (const error of checks) {
    if (error) return error;
  }
  return null;
};
