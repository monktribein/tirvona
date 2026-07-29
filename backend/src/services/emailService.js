import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';
import config from '../config/env.js';

// Optimised copy of the brand mark (320px wide, ~26KB) generated from
// frontend/public/logo/logo.png. Lives under the backend so mail works when the
// API is deployed separately from the frontend.
const LOGO_PATH = path.join(process.cwd(), 'public', 'email', 'logo.png');

// Read and encode once at boot; a missing file must not take the mailer down.
//
// Stored base64 rather than as a Buffer: the Resend SDK forwards `content`
// to JSON.stringify untouched, which would turn a Buffer into a
// {type:'Buffer',data:[…]} integer array roughly four times the size of the
// equivalent base64 string, on every single email we send.
let logoBase64 = null;
try {
  logoBase64 = fs.readFileSync(LOGO_PATH).toString('base64');
} catch {
  console.warn(`[EMAIL] Brand logo not found at ${LOGO_PATH}; emails will send without it.`);
}

// Inline attachment referenced by <img src="cid:tirvona-logo">. Gmail refuses to
// render base64 data URIs, so CID is the only reliable way to embed the mark.
//
// The field is `contentId` (Nodemailer called it `cid`). Use the SDK's camelCase
// spelling, not the REST API's `content_id`: the SDK maps `contentId` onto the
// wire format and ignores unknown keys, so snake_case here would be silently
// dropped and the logo would render as a broken image.
const logoAttachment = () =>
  logoBase64
    ? [{
        filename: 'tirvona-logo.png',
        content: logoBase64,
        contentId: LOGO_CID,
        contentType: 'image/png',
      }]
    : [];

// Resend client, created lazily and reused. When no API key is configured the
// service degrades to dev mode (logged, not sent) rather than throwing, so local
// development and the existing test environment keep working.
//
// There is no connection pool to manage here: Resend is a stateless HTTPS API,
// which is precisely why the previous SMTP transport needed cache-invalidation
// logic (a revoked Gmail App Password left a dead pool behind) and this does not.
let client = null;

const getClient = () => {
  if (!config.resend.configured) return null;
  if (!client) client = new Resend(config.resend.apiKey);
  return client;
};

// Resend's SDK reports API failures as a returned `error` object rather than a
// throw, so both shapes have to be normalised into one message string.
const errorMessage = (error) =>
  error?.message || error?.name || (typeof error === 'string' ? error : 'Unknown email error');

/**
 * Check the Resend API key at boot so a bad one surfaces immediately in the
 * startup log, rather than as a failed OTP for a real user later on.
 *
 * The probe lists domains, which is the cheapest authenticated call available.
 * A *sending-only* key legitimately cannot read domains, so that specific
 * rejection is reported as "usable but unverified" instead of a failure —
 * treating it as fatal would false-alarm on a correctly-scoped production key.
 */
export const verifyEmailTransport = async () => {
  const mail = getClient();
  if (!mail) {
    console.warn('[EMAIL] RESEND_API_KEY not set — OTP, password-reset and notification emails will not be sent.');
    return false;
  }

  try {
    const { error } = await mail.domains.list();

    if (!error) {
      console.log(`[EMAIL] Resend ready as ${config.resend.from}`);
      return true;
    }

    if (error.name === 'restricted_api_key') {
      console.log(`[EMAIL] Resend ready as ${config.resend.from} (send-only key; domain list not readable).`);
      return true;
    }

    // An `application_error` that carries an HTTP statusCode means the request
    // REACHED Resend and Resend answered — so it is not a network problem.
    //
    // Verified against the live API: an invalid or revoked key returns
    // HTTP 500 `application_error` "Something went wrong", byte-identical to
    // what a made-up key returns. A *missing* key returns a clean 401, and the
    // API root returns 200 even while this happens. Resend simply reports bad
    // credentials as a 500 instead of a 401.
    //
    // This branch previously reported the opposite ("network/DNS problem, not a
    // bad key"), which sent readers looking at their connection while the real
    // fault was the credential.
    if (error.name === 'application_error') {
      console.error(`[EMAIL] RESEND KEY REJECTED: ${errorMessage(error)}`);
      console.error('[EMAIL] Resend reports invalid/revoked keys as a 500, so this is almost certainly');
      console.error('[EMAIL] a bad RESEND_API_KEY — not a network fault. Issue a new key at');
      console.error('[EMAIL] https://resend.com/api-keys and update backend/.env.');
      console.error('[EMAIL] (If https://api.resend.com/ is also failing, it is a Resend outage instead.)');
      return false;
    }

    console.error(`[EMAIL] RESEND KEY REJECTED: ${errorMessage(error)}`);
    console.error('[EMAIL] Emails will fail until this is fixed. Check RESEND_API_KEY in .env.');
    return false;
  } catch (error) {
    // A thrown error means no HTTP response at all — DNS failure, refused
    // connection, TLS problem. THIS is the genuine network case.
    console.error(`[EMAIL] Could not reach Resend: ${errorMessage(error)}`);
    console.error('[EMAIL] No response received — this is a network/DNS problem, not the key.');
    return false;
  }
};

/**
 * Low-level sender every email in the platform goes through — OTP, password
 * reset, notifications and messages alike.
 *
 * Returns { sent, simulated, messageId?, error? } and never throws, so a mail
 * outage can never break the flow that triggered it. `simulated: true` means no
 * API key is configured (a dev-mode state), which callers must not treat as a
 * delivery failure.
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  replyTo = config.resend.replyTo,
  attachments = [],
  headers = {},
  tags,
  label = 'email',
}) => {
  const mail = getClient();
  if (!mail) {
    console.log(`[EMAIL:DEV] ${label} for ${to} — RESEND_API_KEY not configured, not sent.`);
    return { sent: false, simulated: true };
  }

  try {
    const { data, error } = await mail.emails.send({
      from: config.resend.from,
      to,
      replyTo,
      subject,
      html,
      text,
      attachments,
      headers: {
        // Marks the message as transactional so it is not treated as bulk mail,
        // and tells clients not to auto-reply to it.
        'X-Auto-Response-Suppress': 'All',
        'Auto-Submitted': 'auto-generated',
        Precedence: 'transactional',
        ...headers,
      },
      ...(tags ? { tags } : {}),
    });

    if (error) {
      console.error(`[EMAIL] Resend rejected ${label} for ${to}: ${errorMessage(error)}`);
      return { sent: false, simulated: false, error: errorMessage(error) };
    }

    // An id back from Resend is the proof it accepted the message for delivery.
    console.log(`[EMAIL] ${label} accepted by Resend for ${to} — id ${data?.id}`);
    return { sent: true, simulated: false, messageId: data?.id };
  } catch (error) {
    console.error(`[EMAIL] Failed to deliver ${label} to ${to}:`, errorMessage(error));
    return { sent: false, simulated: false, error: errorMessage(error) };
  }
};

// ── Brand tokens ────────────────────────────────────────────────────────────
// Mirrors frontend/src/index.css so email and app stay visually identical.
const BRAND = {
  navy: '#0B192C', // --secondary  (Tirvona Deep Navy)
  blue: '#0A4DA6', // --primary    (Royal Navy Blue)
  gold: '#E58C28', // --accent     (Saffron Gold)
  ink: '#43506B',
  muted: '#8A94A6',
  page: '#F4F6F9',
  border: '#E8EDF4',
};

// The app's global font is "Plus Jakarta Sans" (index.css --font-sans). Gmail
// strips @import and web fonts, so the stack degrades gracefully; clients that
// do support it (Apple Mail, Outlook.com, Superhuman) get the real typeface.
const FONT_STACK = `'Plus Jakarta Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

// Referenced by <img src="cid:..."> and attached per message. Data URIs are
// blocked by Gmail, so the logo must travel as a CID attachment.
export const LOGO_CID = 'tirvona-logo';

// ── Templates ───────────────────────────────────────────────────────────────
// Table-based shell: nested <table> is the only layout primitive Outlook's Word
// renderer handles reliably. All styling is inline for the same reason.
const baseTemplate = ({ heading, intro, bodyHtml, preheader = '' }) => `
<!--[if mso]><style>body,table,td{font-family:'Segoe UI',Arial,sans-serif !important;}</style><![endif]-->
<style>
  /* No @import here on purpose: Gmail strips web fonts anyway, and a remote
     fetch inside an email body is a spam-filter signal for zero visual gain. */
  @media only screen and (max-width:600px){
    .tv-wrap{width:100% !important;}
    .tv-pad{padding-left:24px !important;padding-right:24px !important;}
    .tv-code{font-size:30px !important;letter-spacing:8px !important;}
  }
</style>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" class="tv-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${BRAND.border};border-radius:24px;overflow:hidden;">

        <!-- Header: light, because the logo mark is navy + gold on transparent -->
        <tr>
          <td align="center" style="padding:36px 32px 24px;background:#FFFFFF;">
            <img src="cid:${LOGO_CID}" width="150" alt="Tirvona"
                 style="display:block;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;" />
          </td>
        </tr>

        <!-- Saffron → navy brand rule -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${BRAND.gold};">&nbsp;</td></tr>

        <tr>
          <td class="tv-pad" style="padding:32px 40px 8px;font-family:${FONT_STACK};">
            <h1 style="margin:0 0 12px;color:${BRAND.navy};font-size:22px;line-height:1.35;font-weight:800;letter-spacing:-0.2px;">${heading}</h1>
            ${intro ? `<p style="margin:0;color:${BRAND.ink};font-size:15px;line-height:1.7;">${intro}</p>` : ''}
          </td>
        </tr>

        <tr>
          <td class="tv-pad" style="padding:20px 40px 36px;font-family:${FONT_STACK};">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 28px;background:${BRAND.page};border-top:1px solid ${BRAND.border};font-family:${FONT_STACK};" align="center">
            <p style="margin:0 0 8px;color:${BRAND.navy};font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">
              Connecting Sacred Destinations
            </p>
            <p style="margin:0;color:${BRAND.muted};font-size:11px;line-height:1.7;">
              This is an automated message from Tirvona — please do not reply.<br />
              Need help? <a href="mailto:support@tirvona.com" style="color:${BRAND.blue};text-decoration:none;font-weight:700;">support@tirvona.com</a>
            </p>
            <p style="margin:12px 0 0;color:${BRAND.muted};font-size:10px;">
              © ${new Date().getFullYear()} Tirvona. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

// Shared saffron security callout used by both messages.
const securityNote = (text) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
    <tr>
      <td style="padding:14px 18px;background:#FFF6EC;border-left:3px solid ${BRAND.gold};border-radius:0 12px 12px 0;">
        <p style="margin:0;color:#8A5A18;font-size:12px;line-height:1.7;font-family:${FONT_STACK};">
          <strong style="color:#7A4E12;">Security notice:</strong> ${text}
        </p>
      </td>
    </tr>
  </table>
`;

const otpTemplate = ({ name, otp, expiryMinutes, purpose }) =>
  baseTemplate({
    preheader: `Your Tirvona ${purpose} code is valid for ${expiryMinutes} minutes.`,
    heading: `Your ${purpose} code`,
    intro: `Namaste${name ? ` ${name}` : ''}, use the one-time password below to continue.`,
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding:24px 16px;background:#F5F8FD;border:1px solid ${BRAND.border};border-radius:16px;">
            <div class="tv-code" style="color:${BRAND.blue};font-size:36px;font-weight:800;letter-spacing:12px;text-indent:12px;font-family:${FONT_STACK};">${otp}</div>
            <div style="margin-top:10px;color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;font-family:${FONT_STACK};">
              Expires in ${expiryMinutes} minutes
            </div>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;color:${BRAND.ink};font-size:13px;line-height:1.7;font-family:${FONT_STACK};">
        This code can be used only once. Enter it on the Tirvona screen you left open.
      </p>
      ${securityNote('Tirvona staff will never ask you for this code. If you did not request it, ignore this email and consider changing your password.')}
    `,
  });

const passwordResetTemplate = ({ name, resetUrl, expiryMinutes }) =>
  baseTemplate({
    preheader: `Reset your Tirvona password — this link is valid for ${expiryMinutes} minutes.`,
    heading: 'Reset your password',
    intro: `Namaste${name ? ` ${name}` : ''}, we received a request to reset the password for your Tirvona account. Choose a new one using the button below.`,
    bodyHtml: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding:8px 0 4px;">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${resetUrl}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="50%" fillcolor="${BRAND.blue}" stroke="f"><w:anchorlock/><center style="color:#FFFFFF;font-family:sans-serif;font-size:15px;font-weight:bold;">Reset My Password</center></v:roundrect><![endif]-->
            <!--[if !mso]><!-->
            <a href="${resetUrl}"
               style="display:inline-block;padding:15px 38px;background:${BRAND.blue};color:#FFFFFF;font-size:15px;font-weight:800;font-family:${FONT_STACK};text-decoration:none;border-radius:999px;">
              Reset My Password
            </a>
            <!--<![endif]-->
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:14px 0 0;">
            <p style="margin:0;color:${BRAND.muted};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;font-family:${FONT_STACK};">
              Link expires in ${expiryMinutes} minutes · single use
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:26px 0 8px;color:${BRAND.ink};font-size:13px;line-height:1.7;font-family:${FONT_STACK};">
        If the button does not work, paste this address into your browser:
      </p>
      <p style="margin:0;padding:12px 14px;background:${BRAND.page};border:1px solid ${BRAND.border};border-radius:12px;color:${BRAND.blue};font-size:11px;line-height:1.6;word-break:break-all;font-family:${FONT_STACK};">
        ${resetUrl}
      </p>
      ${securityNote('If you did not request this, you can safely ignore this email — your password will not change. Never forward this link to anyone.')}
    `,
  });

// Generic transactional shell for notifications and messages (booking
// confirmed, check-in code issued, ticket replied, owner approved…), so every
// non-auth email inherits the same brand frame as the OTP and reset mails
// instead of each caller hand-rolling its own HTML.
const notificationTemplate = ({ name, heading, intro, bodyHtml = '', ctaLabel, ctaUrl, preheader }) =>
  baseTemplate({
    preheader: preheader || intro || heading,
    heading,
    intro: `Namaste${name ? ` ${name}` : ''}, ${intro}`,
    bodyHtml: `
      ${bodyHtml}
      ${ctaLabel && ctaUrl ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
        <tr>
          <td align="center">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:230px;" arcsize="50%" fillcolor="${BRAND.blue}" stroke="f"><w:anchorlock/><center style="color:#FFFFFF;font-family:sans-serif;font-size:15px;font-weight:bold;">${ctaLabel}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!-->
            <a href="${ctaUrl}"
               style="display:inline-block;padding:15px 38px;background:${BRAND.blue};color:#FFFFFF;font-size:15px;font-weight:800;font-family:${FONT_STACK};text-decoration:none;border-radius:999px;">
              ${ctaLabel}
            </a>
            <!--<![endif]-->
          </td>
        </tr>
      </table>` : ''}
    `,
  });

const PURPOSE_LABELS = {
  EMAIL_LOGIN: 'login',
  MOBILE_LOGIN: 'login',
  PHONE_REGISTER: 'account verification',
  EMAIL_REGISTER: 'account verification',
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Send a branded OTP email.
 * Returns { sent, simulated } — never throws, so a mail outage cannot break the
 * auth flow. Delivery failures are logged and surfaced as `sent: false`.
 */
export const sendOtpEmail = async ({ to, name, otp, type, expiryMinutes }) => {
  const purpose = PURPOSE_LABELS[type] || 'verification';

  return sendEmail({
    to,
    label: `OTP (${type})`,
    subject: `Your Tirvona ${purpose} code`,
    html: otpTemplate({ name, otp, expiryMinutes, purpose }),
    text: `Your Tirvona ${purpose} code is ${otp}. It expires in ${expiryMinutes} minutes. Never share this code with anyone.`,
    attachments: logoAttachment(),
  });
};

/**
 * Send the password-reset link. Same contract as sendOtpEmail: never throws,
 * reports `sent: false` on failure so the caller can log it without leaking
 * whether the address exists.
 */
export const sendPasswordResetEmail = async ({ to, name, resetUrl, expiryMinutes }) =>
  sendEmail({
    to,
    label: 'password reset',
    subject: 'Reset your Tirvona password',
    html: passwordResetTemplate({ name, resetUrl, expiryMinutes }),
    text: `Reset your Tirvona password using this link (valid ${expiryMinutes} minutes): ${resetUrl}\n\nIf you did not request this, ignore this email.`,
    attachments: logoAttachment(),
  });

/**
 * Send a branded notification or message — booking confirmations, check-in
 * codes, support-ticket replies, owner approvals, and anything else the app
 * needs to mail a user. Same never-throws contract as the two above.
 *
 * `bodyHtml` is inserted verbatim into the template, so callers must pass
 * trusted markup only; anything derived from user input has to be escaped
 * before it gets here.
 */
export const sendNotificationEmail = async ({
  to,
  name,
  subject,
  heading,
  intro,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  preheader,
  text,
}) =>
  sendEmail({
    to,
    label: 'notification',
    subject,
    html: notificationTemplate({ name, heading: heading || subject, intro, bodyHtml, ctaLabel, ctaUrl, preheader }),
    // Plain-text alternative matters for deliverability; fall back to a stripped
    // version of the message rather than shipping an HTML-only email.
    text: text || `${heading || subject}\n\n${intro || ''}${ctaUrl ? `\n\n${ctaLabel || 'Open'}: ${ctaUrl}` : ''}`,
    attachments: logoAttachment(),
  });

export default { sendEmail, sendOtpEmail, sendPasswordResetEmail, sendNotificationEmail };
