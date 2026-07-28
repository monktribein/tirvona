import config from '../config/env.js';

const MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';
const MSG91_SMS_URL = 'https://control.msg91.com/api/v5/otp';

// MSG91 wants a fully-qualified number without '+'.
const toGatewayNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length > 10) return digits; // already carries a country code
  return `${config.msg91.countryCode}${digits}`;
};

const buildMessage = (otp, expiryMinutes) =>
  `Tirvona OTP: ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`;

/**
 * Send an OTP over SMS via MSG91.
 *
 * Two transports are supported:
 *  - Flow API (preferred) when MSG91_TEMPLATE_ID is set — required for DLT-
 *    approved transactional templates in India.
 *  - OTP API as a fallback when only an auth key is configured.
 *
 * Returns { sent, simulated } and never throws, so a gateway outage cannot
 * break the auth flow.
 */
export const sendOtpSms = async ({ phone, otp, expiryMinutes }) => {
  // Master switch (config.otp.smsEnabled). Kept as a guard here as well as in
  // the routing layer so no code path can dispatch an SMS while it is off.
  if (!config.otp.smsEnabled) {
    console.log('[SMS] SMS OTP is disabled (OTP_SMS_ENABLED=false); nothing sent.');
    return { sent: false, simulated: true, disabled: true };
  }

  if (!config.msg91.configured) {
    // Dev mode: no gateway credentials. Keeps local registration/login usable.
    console.log(`[SMS:DEV] OTP SMS for ${phone} — MSG91 not configured, not sent.`);
    return { sent: false, simulated: true };
  }

  const mobile = toGatewayNumber(phone);

  try {
    let response;

    if (config.msg91.templateId) {
      response = await fetch(MSG91_FLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authkey: config.msg91.authKey },
        body: JSON.stringify({
          template_id: config.msg91.templateId,
          sender: config.msg91.senderId,
          short_url: '0',
          recipients: [{ mobiles: mobile, OTP: otp, EXPIRY: String(expiryMinutes) }],
        }),
      });
    } else {
      const params = new URLSearchParams({
        authkey: config.msg91.authKey,
        mobile,
        otp,
        sender: config.msg91.senderId,
        otp_length: String(String(otp).length),
        otp_expiry: String(expiryMinutes),
        message: buildMessage(otp, expiryMinutes),
      });
      response = await fetch(`${MSG91_SMS_URL}?${params.toString()}`, { method: 'POST' });
    }

    const payload = await response.json().catch(() => ({}));

    // MSG91 answers 200 with {type:'error'} on rejection, so status alone is not enough.
    if (!response.ok || payload.type === 'error') {
      console.error(`[SMS] MSG91 rejected OTP to ${phone}:`, payload.message || response.status);
      return { sent: false, simulated: false, error: payload.message || `HTTP ${response.status}` };
    }

    return { sent: true, simulated: false, requestId: payload.request_id };
  } catch (error) {
    console.error(`[SMS] Failed to deliver OTP to ${phone}:`, error.message);
    return { sent: false, simulated: false, error: error.message };
  }
};

export default { sendOtpSms };
