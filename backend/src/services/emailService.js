import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import config from '../config/env.js';

// Optimised copy of the brand mark (320px wide, ~26KB) generated from
// frontend/public/logo/logo.png. Lives under the backend so mail works when the
// API is deployed separately from the frontend.
const LOGO_PATH = path.join(process.cwd(), 'public', 'email', 'logo.png');

// Read once at boot; a missing file must not take the mailer down.
let logoBuffer = null;
try {
  logoBuffer = fs.readFileSync(LOGO_PATH);
} catch {
  console.warn(`[EMAIL] Brand logo not found at ${LOGO_PATH}; emails will send without it.`);
}

// Inline attachment referenced by <img src="cid:tirvona-logo">. Gmail refuses to
// render base64 data URIs, so CID is the only reliable way to embed the mark.
const logoAttachment = () =>
  logoBuffer
    ? [{ filename: 'tirvona-logo.png', content: logoBuffer, cid: LOGO_CID, contentDisposition: 'inline' }]
    : [];

// Nodemailer transport, created lazily and reused. When SMTP is not configured
// the service degrades to dev mode (logged, not sent) rather than throwing, so
// local development and the existing test environment keep working.
let transporter = null;

const getTransporter = () => {
  if (!config.smtp.configured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      // Reuse the connection: a cold Gmail TLS handshake costs ~5s, which the
      // OTP request would otherwise wait on for every single code.
      pool: true,
      maxConnections: 3,
      maxMessages: 50,
      // Never let a stalled gateway hold an HTTP request open indefinitely.
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transporter;
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
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
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
  const subject = `Your Tirvona ${purpose} code`;

  const mail = getTransporter();
  if (!mail) {
    // Dev mode: no SMTP configured. The code is printed so local flows work.
    console.log(`[EMAIL:DEV] OTP email for ${to} (${type}) — SMTP not configured, not sent.`);
    return { sent: false, simulated: true };
  }

  try {
    await mail.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject,
      html: otpTemplate({ name, otp, expiryMinutes, purpose }),
      text: `Your Tirvona ${purpose} code is ${otp}. It expires in ${expiryMinutes} minutes. Never share this code with anyone.`,
      attachments: logoAttachment(),
    });
    return { sent: true, simulated: false };
  } catch (error) {
    console.error(`[EMAIL] Failed to deliver OTP to ${to}:`, error.message);
    return { sent: false, simulated: false, error: error.message };
  }
};

/**
 * Send the password-reset link. Same contract as sendOtpEmail: never throws,
 * reports `sent: false` on failure so the caller can log it without leaking
 * whether the address exists.
 */
export const sendPasswordResetEmail = async ({ to, name, resetUrl, expiryMinutes }) => {
  const mail = getTransporter();
  if (!mail) {
    console.log(`[EMAIL:DEV] Password reset link for ${to} — SMTP not configured, not sent.`);
    return { sent: false, simulated: true };
  }

  try {
    await mail.sendMail({
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
      to,
      subject: 'Reset your Tirvona password',
      html: passwordResetTemplate({ name, resetUrl, expiryMinutes }),
      text: `Reset your Tirvona password using this link (valid ${expiryMinutes} minutes): ${resetUrl}\n\nIf you did not request this, ignore this email.`,
      attachments: logoAttachment(),
    });
    return { sent: true, simulated: false };
  } catch (error) {
    console.error(`[EMAIL] Failed to deliver password reset to ${to}:`, error.message);
    return { sent: false, simulated: false, error: error.message };
  }
};

export default { sendOtpEmail, sendPasswordResetEmail };
