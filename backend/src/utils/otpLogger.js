// Structured logging for the OTP lifecycle.
//
// Hard rule: the OTP value itself is NEVER passed to this module. Only the
// user, the type, the masked destination and the outcome are recorded, so logs
// (and anything that ships them onward) can never be replayed into an account.

export const OTP_EVENTS = {
  GENERATED: 'OTP_GENERATED',
  SENT: 'OTP_SENT',
  SEND_FAILED: 'OTP_SEND_FAILED',
  VERIFIED: 'OTP_VERIFIED',
  FAILED: 'OTP_FAILED',
  EXPIRED: 'OTP_EXPIRED',
  TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
};

/** `9876543210` → `98****3210`, `foo.bar@x.com` → `f***r@x.com`. */
export const maskPhone = (phone) => {
  const value = String(phone || '');
  if (value.length < 6) return '***';
  return `${value.slice(0, 2)}****${value.slice(-4)}`;
};

export const maskEmail = (email) => {
  const value = String(email || '');
  const [local, domain] = value.split('@');
  if (!domain) return '***';
  const visible = local.length <= 2 ? local[0] || '' : `${local[0]}***${local.slice(-1)}`;
  return `${visible}@${domain}`;
};

export const logOtpEvent = (event, { userId, type, email, phone, ...rest } = {}) => {
  const destination = email ? maskEmail(email) : maskPhone(phone);
  const extra = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');

  const line = `[OTP] ${event} user=${userId || 'unknown'} type=${type || 'unknown'} to=${destination}${extra ? ` ${extra}` : ''}`;

  if (event === OTP_EVENTS.SEND_FAILED || event === OTP_EVENTS.TOO_MANY_ATTEMPTS) {
    console.error(line);
  } else {
    console.log(line);
  }
};

export default { logOtpEvent, OTP_EVENTS, maskPhone, maskEmail };
