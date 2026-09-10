/**
 * Branded HTML for every transactional email Tirvona sends.
 *
 * Email clients strip <style> blocks, flexbox and grid, so the layout is built
 * from nested tables with inline styles only. Colours follow the public site:
 * navy #0B192C, blue #0A4DA6, saffron #E58C28.
 */

export interface EmailDetailRow {
  label: string;
  value: string;
}

export interface EmailHighlight {
  /** e.g. "Check-in code" — describes what the code is for. */
  label: string;
  /** The code itself, shown large so it can be read off a phone at a counter. */
  code: string;
}

export interface EmailTemplateInput {
  title: string;
  message: string;
  siteUrl: string;
  recipientName?: string;
  /** Booking / pass reference printed under the title. */
  reference?: string;
  highlight?: EmailHighlight;
  details?: EmailDetailRow[];
  /** Content ID of an inline QR attachment, referenced as cid:<qrCid>. */
  qrCid?: string;
  qrCaption?: string;
  cta?: { label: string; url: string };
  /** Closing note above the footer, e.g. a refund timeline. */
  note?: string;
}

const NAVY = "#0B192C";
const BLUE = "#0A4DA6";
const SAFFRON = "#E58C28";
const INK = "#334155";
const HEADING = "#0B192C";
const MUTED = "#64748B";
const FAINT = "#94A3B8";
const LINE = "#E8EDF3";
const CANVAS = "#EEF2F7";
const CODE_BG = "#FFF8F1";
const CODE_LINE = "#F6DCBC";

/**
 * Outlook and several webmail previewers do not resolve the `-apple-system` /
 * `BlinkMacSystemFont` keywords and fall back to their default serif or
 * monospace face, so the stack starts with real font names instead.
 */
const FONT =
  "'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

export const escapeHtml = (value: string): string =>
  String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ]!,
  );

/**
 * Only http(s) links are emitted, so a bad value cannot become javascript:.
 * FRONTEND_URL may hold a comma-separated list, so the first origin wins.
 */
const safeUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  const first = value.split(",")[0].trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(first) ? first : null;
};

const detailRows = (details: EmailDetailRow[]): string =>
  details
    .map(
      (row, index) => `
                  <tr>
                    <td style="padding:${index === 0 ? "0" : "11px"} 14px 11px 0;font-family:${FONT};font-size:13px;color:${MUTED};vertical-align:top;${index === 0 ? "" : `border-top:1px solid ${LINE};`}">${escapeHtml(row.label)}</td>
                    <td style="padding:${index === 0 ? "0" : "11px"} 0 11px 0;font-family:${FONT};font-size:13px;color:${HEADING};font-weight:600;text-align:right;vertical-align:top;${index === 0 ? "" : `border-top:1px solid ${LINE};`}">${escapeHtml(row.value)}</td>
                  </tr>`,
    )
    .join("");

const highlightBlock = (highlight: EmailHighlight): string => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
                <tr>
                  <td align="center" bgcolor="${CODE_BG}" style="background-color:${CODE_BG};border:1px solid ${CODE_LINE};border-radius:14px;padding:22px 18px;">
                    <div style="font-family:${FONT};font-size:10px;letter-spacing:2.4px;text-transform:uppercase;color:${SAFFRON};font-weight:700;">${escapeHtml(highlight.label)}</div>
                    <div style="font-family:${MONO};font-size:32px;line-height:1.2;letter-spacing:7px;color:${HEADING};font-weight:700;padding-top:10px;">${escapeHtml(highlight.code)}</div>
                  </td>
                </tr>
              </table>`;

const qrBlock = (qrCid: string, caption?: string): string => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
                <tr>
                  <td align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid ${LINE};border-radius:14px;padding:22px 18px;">
                    <img src="cid:${escapeHtml(qrCid)}" alt="QR code for your pass" width="170" height="170" style="display:block;width:170px;height:170px;border:0;" />
                    ${
                      caption
                        ? `<div style="font-family:${FONT};font-size:12px;color:${MUTED};padding-top:14px;line-height:1.55;">${escapeHtml(caption)}</div>`
                        : ""
                    }
                  </td>
                </tr>
              </table>`;

const ctaBlock = (label: string, url: string): string => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:2px auto 4px auto;">
                <tr>
                  <td align="center" bgcolor="${BLUE}" style="background-color:${BLUE};border-radius:999px;">
                    <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table>`;

export const renderEmail = (input: EmailTemplateInput): string => {
  const site = safeUrl(input.siteUrl) || "https://www.tirvona.com";
  const cta = input.cta && safeUrl(input.cta.url) ? input.cta : undefined;
  const details = input.details?.filter((row) => row.value) ?? [];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CANVAS};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.message)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CANVAS};padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <tr>
          <td align="center" bgcolor="#FFFFFF" style="background-color:#FFFFFF;border-radius:18px 18px 0 0;padding:22px 24px 16px 24px;">
            <a href="${escapeHtml(site)}" style="text-decoration:none;display:inline-block;">
              <img src="${escapeHtml(site)}/logo.png" alt="Tirvona" width="170" height="113" style="display:block;border:0;width:170px;height:113px;margin:0 auto;font-family:${FONT};font-size:24px;font-weight:700;color:${HEADING};letter-spacing:0.5px;" />
            </a>
          </td>
        </tr>

        <tr>
          <td bgcolor="${SAFFRON}" style="background-color:${SAFFRON};font-size:0;line-height:0;height:3px;">&nbsp;</td>
        </tr>

        <tr>
          <td bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:30px 32px 30px 32px;">

            ${
              input.recipientName
                ? `<div style="font-family:${FONT};font-size:14px;color:${MUTED};padding-bottom:12px;">Hi ${escapeHtml(input.recipientName)},</div>`
                : ""
            }

            <h1 style="margin:0 0 12px 0;font-family:${FONT};font-size:22px;line-height:1.35;color:${HEADING};font-weight:700;letter-spacing:-0.2px;">${escapeHtml(input.title)}</h1>

            <p style="margin:0 0 ${input.reference ? "14px" : "26px"} 0;font-family:${FONT};font-size:14px;line-height:1.7;color:${INK};">${escapeHtml(input.message)}</p>

            ${
              input.reference
                ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
                <tr>
                  <td bgcolor="#F4F7FB" style="background-color:#F4F7FB;border-radius:8px;padding:8px 14px;font-family:${FONT};font-size:12px;color:${MUTED};">
                    Reference&nbsp;<span style="font-family:${MONO};font-size:12.5px;color:${HEADING};font-weight:700;letter-spacing:0.6px;">${escapeHtml(input.reference)}</span>
                  </td>
                </tr>
              </table>`
                : ""
            }

            ${input.highlight ? highlightBlock(input.highlight) : ""}

            ${input.qrCid ? qrBlock(input.qrCid, input.qrCaption) : ""}

            ${
              details.length
                ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;">
                <tr>
                  <td bgcolor="#FAFBFD" style="background-color:#FAFBFD;border:1px solid ${LINE};border-radius:14px;padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows(details)}
                    </table>
                  </td>
                </tr>
              </table>`
                : ""
            }

            ${cta ? ctaBlock(cta.label, cta.url) : ""}

            ${
              input.note
                ? `<p style="margin:${cta ? "22px" : "0"} 0 0 0;font-family:${FONT};font-size:12.5px;line-height:1.65;color:${MUTED};${cta ? "text-align:center;" : ""}">${escapeHtml(input.note)}</p>`
                : ""
            }

          </td>
        </tr>

        <tr>
          <td bgcolor="#F7F9FC" style="background-color:#F7F9FC;border-top:1px solid ${LINE};border-radius:0 0 18px 18px;padding:20px 32px;">
            <div style="font-family:${FONT};font-size:12.5px;color:${MUTED};line-height:1.7;">
              Need help? Reply to this email or write to
              <a href="mailto:support@tirvona.com" style="color:${BLUE};text-decoration:none;font-weight:600;">support@tirvona.com</a>
            </div>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:22px 24px 6px 24px;">
            <div style="font-family:${FONT};font-size:12px;color:${MUTED};line-height:1.8;">
              <a href="${escapeHtml(site)}" style="color:${MUTED};text-decoration:none;">Home</a>
              <span style="color:${FAINT};">&nbsp;·&nbsp;</span>
              <a href="${escapeHtml(site)}/profile/bookings" style="color:${MUTED};text-decoration:none;">My Bookings</a>
              <span style="color:${FAINT};">&nbsp;·&nbsp;</span>
              <a href="${escapeHtml(site)}/help-center" style="color:${MUTED};text-decoration:none;">Help Centre</a>
              <span style="color:${FAINT};">&nbsp;·&nbsp;</span>
              <a href="${escapeHtml(site)}/contact" style="color:${MUTED};text-decoration:none;">Contact</a>
            </div>
            <div style="font-family:${FONT};font-size:11px;color:${FAINT};line-height:1.7;padding-top:12px;">
              © ${new Date().getFullYear()} Tirvona. All rights reserved.<br />
              This is a transactional email about your Tirvona account or booking.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
};

/** Plain-text alternative, for clients that refuse HTML. */
export const renderEmailText = (input: EmailTemplateInput): string => {
  const lines: string[] = [];
  if (input.recipientName) lines.push(`Hi ${input.recipientName},`, "");
  lines.push(input.title, "", input.message, "");
  if (input.reference) lines.push(`Reference: ${input.reference}`);
  if (input.highlight)
    lines.push(`${input.highlight.label}: ${input.highlight.code}`);
  for (const row of input.details ?? []) {
    if (row.value) lines.push(`${row.label}: ${row.value}`);
  }
  if (input.qrCid) lines.push("", "Your QR pass is attached to this email.");
  if (input.cta) lines.push("", `${input.cta.label}: ${input.cta.url}`);
  if (input.note) lines.push("", input.note);
  lines.push("", "Need help? support@tirvona.com", "— Tirvona");
  return lines.join("\n");
};
