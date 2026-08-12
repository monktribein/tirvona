import { BadRequestException, Injectable } from "@nestjs/common";
import {
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";
import type { SmartContactProfileView } from "../domain/smart-contact.types";
import { QrService, type RenderedQr } from "./qr.service";

export interface CardRenderOptions {
  caption?: string;
  /** Include the representative's photograph. SVG only — see `renderPdf`. */
  photo?: boolean;
}

/**
 * Print-ready contact card artwork: the QR **plus** the identity beside it.
 *
 * The bare symbol from `QrService` is what you drop into an existing card
 * design. This is the finished asset — logo, name, designation, role line and
 * contact lines laid out around the QR — for handing straight to a printer.
 *
 * Note what this does *not* change: the QR still encodes only the permanent
 * profile URL (spec §2, §49). The contact details are set as text on the card
 * for a human to read, never inside the symbol, so a reprint is needed to fix
 * a number on the *card* while every already-printed QR keeps resolving to the
 * corrected profile. That asymmetry is the whole point of the product, and it
 * is why the card is an optional asset rather than the default download.
 *
 * Dimensions are the standard Indian visiting card, 88 × 55 mm, in points.
 */
@Injectable()
export class ContactCardService {
  private readonly config: SmartContactConfig = smartContactConfig();

  constructor(private readonly qr: QrService) {}

  /** 88 × 55 mm at 72dpi. Landscape: identity left, symbol right. */
  private static readonly W = 249.45;
  private static readonly H = 155.91;

  private escapeXml(value: string): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * Truncates to fit a column width.
   *
   * Helvetica's average advance is close to 0.52em across mixed-case text —
   * good enough to keep a long designation from running under the QR without
   * embedding font metrics. Errs toward cutting early: an ellipsis reads as
   * deliberate, text colliding with the symbol does not.
   */
  private fit(text: string, fontSize: number, maxWidth: number): string {
    const value = String(text ?? "").trim();
    if (!value) return "";
    const max = Math.floor(maxWidth / (fontSize * 0.52));
    return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`;
  }

  /** The contact lines, in the order the spec's §48 layout shows them. */
  private contactLines(profile: SmartContactProfileView): string[] {
    const address = [profile.addressLine1, profile.city, profile.state]
      .filter(Boolean)
      .join(", ");
    return [
      profile.primaryPhone,
      profile.secondaryPhone,
      profile.email,
      profile.website.replace(/^https?:\/\//, ""),
      address,
    ].filter(Boolean);
  }

  /**
   * SVG — the master format, and the only one that carries the photograph.
   */
  renderSvg(
    profile: SmartContactProfileView,
    url: string,
    options: CardRenderOptions = {},
  ): string {
    const { W, H } = ContactCardService;
    const { path, grid } = this.qr.qrGeometry(url);

    // Symbol block on the right; text column gets everything to its left.
    const qrSide = 68;
    const qrX = W - qrSide - 14;
    const qrY = 52;
    const textWidth = qrX - 14 - 10;

    const caption = options.caption?.trim() ?? "";
    const lines = this.contactLines(profile);
    const e = (v: string) => this.escapeXml(v);

    // Contact lines start below the identity block and step down evenly; the
    // block is anchored to the top rather than centred so a profile with two
    // contact lines and one with five both sit against the same baseline.
    const contactTop = 96;
    const contactStep = 9.5;

    const photo =
      options.photo && profile.photoUrl
        ? `<clipPath id="pc"><circle cx="30" cy="66" r="16"/></clipPath>` +
          `<image x="14" y="50" width="32" height="32" clip-path="url(#pc)" ` +
          `preserveAspectRatio="xMidYMid slice" href="${e(profile.photoUrl)}"/>` +
          `<circle cx="30" cy="66" r="16" fill="none" stroke="${this.config.qrAccentColor}" stroke-width="1.2"/>`
        : "";
    // The identity block shifts right to clear the photograph when present.
    const tx = options.photo && profile.photoUrl ? 54 : 14;
    const tw = qrX - tx - 10;

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
      `width="${(W * 4).toFixed(0)}" height="${(H * 4).toFixed(0)}" ` +
      `role="img" aria-label="Contact card for ${e(profile.displayName)}">` +
      `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
      // Header band
      `<rect width="${W}" height="34" fill="${this.config.qrDarkColor}"/>` +
      `<circle cx="24" cy="17" r="9" fill="${this.config.qrAccentColor}"/>` +
      `<path d="M24 11c2 1.9 3 3.7 3 5.8 0 2-1.3 3.7-3 3.7s-3-1.7-3-3.7c0-2.1 1-3.9 3-5.8z" fill="${this.config.qrDarkColor}"/>` +
      `<text x="40" y="16" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="700" letter-spacing="1.2" fill="#ffffff">TIRVONA</text>` +
      `<text x="40" y="25" font-family="Helvetica, Arial, sans-serif" font-size="5" letter-spacing="0.3" fill="${this.config.qrAccentColor}">India&#8217;s Digital Infrastructure for Religious Destinations</text>` +
      `<rect y="34" width="${W}" height="1.4" fill="${this.config.qrAccentColor}"/>` +
      photo +
      // Identity
      `<text x="${tx}" y="60" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="700" fill="${this.config.qrDarkColor}">${e(this.fit(profile.displayName, 13, tw))}</text>` +
      `<text x="${tx}" y="72" font-family="Helvetica, Arial, sans-serif" font-size="8" font-weight="700" fill="#0A4DA6">${e(this.fit(profile.designation, 8, tw))}</text>` +
      `<text x="${tx}" y="82" font-family="Helvetica, Arial, sans-serif" font-size="6.5" fill="#64748b">${e(this.fit(profile.roleLine, 6.5, tw))}</text>` +
      `<rect x="${tx}" y="88" width="26" height="1" fill="${this.config.qrAccentColor}"/>` +
      lines
        .map(
          (line, index) =>
            `<text x="14" y="${contactTop + index * contactStep}" font-family="Helvetica, Arial, sans-serif" font-size="6.8" fill="${this.config.qrDarkColor}">${e(this.fit(line, 6.8, textWidth))}</text>`,
        )
        .join("") +
      // Symbol
      `<g transform="translate(${qrX} ${qrY}) scale(${(qrSide / grid).toFixed(4)})">` +
      `<rect width="${grid}" height="${grid}" fill="#ffffff"/>` +
      `<path d="${path}" fill="${this.config.qrDarkColor}"/>` +
      `</g>` +
      (caption
        ? `<text x="${qrX + qrSide / 2}" y="${qrY + qrSide + 7}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5.2" font-weight="700" fill="${this.config.qrDarkColor}">${e(caption)}</text>`
        : "") +
      // Footer
      `<rect y="${H - 13}" width="${W}" height="13" fill="#f1f5f9"/>` +
      `<text x="${W / 2}" y="${H - 4.6}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="5.4" font-weight="700" fill="#64748b">Connecting Sacred Destinations. Empowering Communities.</text>` +
      `</svg>`
    );
  }

  /**
   * PDF — vector, print-ready, and the format a printer will ask for.
   *
   * No photograph: embedding a raster image would mean fetching and decoding
   * the remote file at request time and writing an XObject, which is a lot of
   * machinery for an asset whose SVG twin already carries it. Text is
   * WinAnsi-encoded, so non-Latin characters are dropped rather than rendered
   * as wrong glyphs — `pdfSafe` reports whether that would lose anything.
   */
  renderPdf(
    profile: SmartContactProfileView,
    url: string,
    options: CardRenderOptions = {},
  ): Buffer {
    const { W, H } = ContactCardService;
    const [dr, dg, db] = this.qr.hexToRgb(this.config.qrDarkColor);
    const [ar, ag, ab] = this.qr.hexToRgb(this.config.qrAccentColor);
    const t = (v: string) => this.qr.escapePdfText(this.toWinAnsi(v));

    const qrSide = 68;
    const qrX = W - qrSide - 14;
    // PDF y grows upward, so the symbol's origin is measured from the bottom.
    const qrY = H - 52 - qrSide;
    const tw = qrX - 14 - 10;

    const ops: string[] = [];
    // Card background
    ops.push("1 1 1 rg", `0 0 ${W.toFixed(2)} ${H.toFixed(2)} re f`);
    // Header band
    ops.push(
      `${dr} ${dg} ${db} rg`,
      `0 ${(H - 34).toFixed(2)} ${W.toFixed(2)} 34 re f`,
    );
    ops.push(
      `${ar} ${ag} ${ab} rg`,
      `0 ${(H - 35.4).toFixed(2)} ${W.toFixed(2)} 1.4 re f`,
    );
    // Wordmark
    ops.push(
      "1 1 1 rg",
      "BT",
      "/F2 12 Tf",
      "1.2 Tc",
      `40 ${(H - 16).toFixed(2)} Td`,
      "(TIRVONA) Tj",
      "ET",
      "0 Tc",
    );
    ops.push(
      `${ar} ${ag} ${ab} rg`,
      "BT",
      "/F1 5 Tf",
      `40 ${(H - 25).toFixed(2)} Td`,
      `(${t("India's Digital Infrastructure for Religious Destinations")}) Tj`,
      "ET",
    );

    // Identity
    ops.push(
      `${dr} ${dg} ${db} rg`,
      "BT",
      "/F2 13 Tf",
      `14 ${(H - 60).toFixed(2)} Td`,
      `(${t(this.fit(profile.displayName, 13, tw))}) Tj`,
      "ET",
    );
    ops.push(
      "0.039 0.302 0.651 rg",
      "BT",
      "/F2 8 Tf",
      `14 ${(H - 72).toFixed(2)} Td`,
      `(${t(this.fit(profile.designation, 8, tw))}) Tj`,
      "ET",
    );
    ops.push(
      "0.392 0.455 0.545 rg",
      "BT",
      "/F1 6.5 Tf",
      `14 ${(H - 82).toFixed(2)} Td`,
      `(${t(this.fit(profile.roleLine, 6.5, tw))}) Tj`,
      "ET",
    );
    ops.push(`${ar} ${ag} ${ab} rg`, `14 ${(H - 89).toFixed(2)} 26 1 re f`);

    // Contact lines
    ops.push(`${dr} ${dg} ${db} rg`);
    this.contactLines(profile).forEach((line, index) => {
      ops.push(
        "BT",
        "/F1 6.8 Tf",
        `14 ${(H - 96 - index * 9.5).toFixed(2)} Td`,
        `(${t(this.fit(line, 6.8, tw))}) Tj`,
        "ET",
      );
    });

    // Symbol
    ops.push(`${dr} ${dg} ${db} rg`);
    ops.push(...this.qr.qrPdfRects(url, qrX, qrY, qrSide));

    const caption = options.caption?.trim() ?? "";
    if (caption && this.qr.pdfCaptionIsRenderable(caption)) {
      const width = caption.length * 5.2 * 0.5;
      ops.push(
        "BT",
        "/F2 5.2 Tf",
        `${(qrX + qrSide / 2 - width / 2).toFixed(2)} ${(qrY - 7).toFixed(2)} Td`,
        `(${t(caption)}) Tj`,
        "ET",
      );
    }

    // Footer
    ops.push("0.945 0.961 0.976 rg", `0 0 ${W.toFixed(2)} 13 re f`);
    const footer = "Connecting Sacred Destinations. Empowering Communities.";
    ops.push(
      "0.392 0.455 0.545 rg",
      "BT",
      "/F2 5.4 Tf",
      `${(W / 2 - (footer.length * 5.4 * 0.5) / 2).toFixed(2)} 4.6 Td`,
      `(${t(footer)}) Tj`,
      "ET",
    );

    return this.qr.assemblePdf(ops.join("\n"), W, H);
  }

  /**
   * Drops characters the standard WinAnsi fonts cannot represent.
   *
   * A Devanagari name has no glyph in Helvetica; leaving it in produces
   * garbage in the output, so it is removed and the caller is expected to have
   * checked `pdfSafe` first and steered the user to SVG.
   */
  private toWinAnsi(value: string): string {
    return String(value ?? "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x20-\xFF]/g, "");
  }

  /** Whether every field on the card survives WinAnsi encoding. */
  pdfSafe(profile: SmartContactProfileView): boolean {
    const fields = [
      profile.displayName,
      profile.designation,
      profile.roleLine,
      ...this.contactLines(profile),
    ].join("");
    return this.toWinAnsi(fields).length === fields.length;
  }

  /**
   * Renders the card in the requested format.
   *
   * PNG is refused rather than silently substituted. Rasterising this layout
   * would mean shipping an SVG renderer (a large native dependency) purely to
   * flatten text the vector formats already carry perfectly — and a printer
   * wants the vector anyway. The error says so, so the caller can pick a real
   * format instead of wondering why the file looks different.
   */
  render(
    profile: SmartContactProfileView,
    url: string,
    format: string,
    options: CardRenderOptions = {},
  ): RenderedQr {
    if (format === "pdf") {
      return {
        body: this.renderPdf(profile, url, options),
        contentType: "application/pdf",
        extension: "pdf",
      };
    }
    if (format && format !== "svg") {
      throw new BadRequestException(
        "The contact card is available as SVG or PDF. PNG is offered for the " +
          "plain QR symbol only.",
      );
    }
    return {
      body: Buffer.from(this.renderSvg(profile, url, options), "utf8"),
      contentType: "image/svg+xml; charset=utf-8",
      extension: "svg",
    };
  }
}
