import { Injectable } from "@nestjs/common";
import * as QRCode from "qrcode";
import {
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";

export interface QrRenderOptions {
  /** Pixel width for raster output. Ignored by SVG and PDF, which are vector. */
  size?: number;
  /** Caption printed beneath the symbol (spec §16). */
  caption?: string;
  /** Draw the gold accent frame (spec §16). */
  frame?: boolean;
  /** Knock a hole for the Tirvona logo and place it (spec §15, §16). */
  logo?: boolean;
}

export interface RenderedQr {
  body: Buffer;
  contentType: string;
  extension: string;
}

/**
 * Renders the permanent profile URL as printable artwork (spec §12–§16).
 *
 * The one rule the whole product depends on: this service encodes a URL and
 * nothing else. It never receives a phone number, an email or a designation,
 * so it is structurally incapable of baking contact details into printed
 * artwork — which is what spec §2 and §49 require.
 *
 * Error correction is fixed at H (spec §15). That is 30% recovery, which is
 * what buys room for the centre logo; the logo box below is sized well inside
 * that budget so the symbol stays readable off a small visiting card.
 */
@Injectable()
export class QrService {
  private readonly config: SmartContactConfig = smartContactConfig();

  /** Quiet zone in modules. 4 is the spec minimum; anything less hurts scans. */
  private static readonly QUIET_ZONE = 4;

  /**
   * Logo box as a fraction of symbol width.
   *
   * 0.18 covers ~3.2% of the symbol's area — comfortably under H's 30% budget,
   * with the rest left as margin for print bleed and a scuffed card. Spec §15
   * warns specifically against a logo that eats too many modules; this is the
   * lever that respects it.
   */
  private static readonly LOGO_RATIO = 0.18;

  /** The bit matrix for a payload, at error correction level H. */
  private matrix(text: string): { size: number; get: (r: number, c: number) => boolean } {
    const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
    const { size, data } = qr.modules;
    return { size, get: (r, c) => Boolean(data[r * size + c]) };
  }

  /**
   * Module geometry for a payload: an SVG path drawn on a `grid × grid` unit
   * square, quiet zone included.
   *
   * Exposed so `ContactCardService` can place the symbol inside a larger
   * layout without duplicating the encoder or the quiet-zone rule — the card
   * scales this with a transform rather than re-deriving it.
   */
  qrGeometry(url: string): { path: string; grid: number } {
    const { size: modules, get } = this.matrix(url);
    const quiet = QrService.QUIET_ZONE;
    const parts: string[] = [];
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) {
        if (get(row, col)) parts.push(`M${col + quiet} ${row + quiet}h1v1h-1z`);
      }
    }
    return { path: parts.join(""), grid: modules + quiet * 2 };
  }

  /** Module rectangles in PDF user space, for a symbol of `side` points. */
  qrPdfRects(url: string, originX: number, originY: number, side: number): string[] {
    const { size: modules, get } = this.matrix(url);
    const quiet = QrService.QUIET_ZONE;
    const grid = modules + quiet * 2;
    const unit = side / grid;
    const ops: string[] = [];
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) {
        if (!get(row, col)) continue;
        const x = originX + (col + quiet) * unit;
        // PDF's origin is bottom-left; the matrix's is top-left.
        const y = originY + side - (row + quiet + 1) * unit;
        ops.push(
          `${x.toFixed(3)} ${y.toFixed(3)} ${(unit + 0.02).toFixed(3)} ${(unit + 0.02).toFixed(3)} re f`,
        );
      }
    }
    return ops;
  }

  private escapeXml(value: string): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * SVG — the master format (spec §13).
   *
   * Hand-built rather than delegated to `QRCode.toString`, because the branded
   * output needs things that helper cannot express: a gold frame, a caption
   * band, and a knocked-out centre for the logo. One `<path>` of module rects
   * keeps the file small enough to paste into a print layout.
   */
  renderSvg(url: string, options: QrRenderOptions = {}): string {
    const { size: modules, get } = this.matrix(url);
    const quiet = QrService.QUIET_ZONE;
    const grid = modules + quiet * 2;
    const caption = options.caption?.trim() ?? "";
    // Extra rows of module-space beneath the symbol for the caption text.
    const captionBand = caption ? 3 : 0;
    const height = grid + captionBand;

    const parts: string[] = [];
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) {
        if (get(row, col)) parts.push(`M${col + quiet} ${row + quiet}h1v1h-1z`);
      }
    }

    const logoSide = options.logo
      ? Math.max(1, Math.round(modules * QrService.LOGO_RATIO))
      : 0;
    const logoOrigin = (grid - logoSide) / 2;

    const frame = options.frame
      ? `<rect x="0.35" y="0.35" width="${(grid - 0.7).toFixed(2)}" ` +
        `height="${(height - 0.7).toFixed(2)}" rx="1" fill="none" ` +
        `stroke="${this.config.qrAccentColor}" stroke-width="0.35"/>`
      : "";

    // The knockout is drawn in the light colour so the logo sits on a clean
    // field; without it the logo would overlay live modules and the decoder
    // would have to spend its whole error budget on them.
    const logo =
      options.logo && this.config.qrLogoUrl
        ? `<rect x="${logoOrigin.toFixed(2)}" y="${logoOrigin.toFixed(2)}" ` +
          `width="${logoSide}" height="${logoSide}" rx="0.5" ` +
          `fill="${this.config.qrLightColor}"/>` +
          `<image x="${(logoOrigin + logoSide * 0.1).toFixed(2)}" ` +
          `y="${(logoOrigin + logoSide * 0.1).toFixed(2)}" ` +
          `width="${(logoSide * 0.8).toFixed(2)}" ` +
          `height="${(logoSide * 0.8).toFixed(2)}" ` +
          `preserveAspectRatio="xMidYMid meet" ` +
          `href="${this.escapeXml(this.config.qrLogoUrl)}"/>`
        : "";

    const captionSvg = caption
      ? `<text x="${(grid / 2).toFixed(2)}" y="${(grid + 1.9).toFixed(2)}" ` +
        `text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" ` +
        `font-size="1.5" font-weight="700" fill="${this.config.qrDarkColor}">` +
        `${this.escapeXml(caption)}</text>`
      : "";

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `viewBox="0 0 ${grid} ${height}" width="${grid * 8}" height="${height * 8}" ` +
      `shape-rendering="crispEdges" role="img" ` +
      `aria-label="QR code linking to ${this.escapeXml(url)}">` +
      `<rect width="${grid}" height="${height}" fill="${this.config.qrLightColor}"/>` +
      `<path d="${parts.join("")}" fill="${this.config.qrDarkColor}"/>` +
      logo +
      frame +
      captionSvg +
      `</svg>`
    );
  }

  /**
   * PNG for layouts that cannot place vector art (spec §13, §14).
   *
   * Delegated to the library's rasteriser rather than composited by hand: the
   * logo and frame are deliberately omitted here. Overlaying them would mean
   * decoding and compositing an external image server-side, and a PNG is the
   * fallback format anyway — spec §13 names SVG as the master, and that is
   * where the branding lives.
   */
  async renderPng(url: string, size?: number): Promise<Buffer> {
    return QRCode.toBuffer(url, this.pngOptions(size));
  }

  /**
   * Encoder options for a raster render. Split out from `renderPng` so the
   * width clamp is assertable without rasterising — a 2000px symbol is 290ms
   * in the app but tens of seconds under ts-jest.
   *
   * The clamp bounds are practical, not arbitrary: below ~200px a level-H
   * symbol of this URL stops scanning reliably off a screen, and above 4000px
   * the buffer is larger than any print workflow needs.
   */
  pngOptions(size?: number): QRCode.QRCodeToBufferOptions {
    return {
      errorCorrectionLevel: "H",
      type: "png",
      width: Math.min(4000, Math.max(200, size ?? this.config.qrDefaultPngSize)),
      margin: QrService.QUIET_ZONE,
      color: { dark: this.config.qrDarkColor, light: this.config.qrLightColor },
    };
  }

  /**
   * A print-ready single-page PDF containing the symbol as true vector art.
   *
   * Written by hand rather than pulling in a PDF library: the document is a
   * few thousand rectangles and one optional line of Helvetica, which is less
   * code than configuring a generator would be — and it keeps the module's
   * dependency list at what the platform already ships.
   *
   * The caption is restricted to WinAnsi-encodable characters because the page
   * uses a standard Type 1 font with no embedded glyphs. The Hindi caption
   * from spec §16 therefore has to come from the SVG, which has no such limit;
   * `pdfCaptionIsRenderable` lets the caller check before asking.
   */
  renderPdf(url: string, options: QrRenderOptions = {}): Buffer {
    const { size: modules, get } = this.matrix(url);
    const quiet = QrService.QUIET_ZONE;
    const grid = modules + quiet * 2;

    // 72pt = 1in. A 2in symbol is the largest that sits comfortably on a
    // visiting card and is well above the minimum reliable scan size.
    const symbolPt = 144;
    const unit = symbolPt / grid;
    const caption =
      options.caption && this.pdfCaptionIsRenderable(options.caption)
        ? options.caption.trim()
        : "";
    const captionPt = caption ? 22 : 0;
    const pageW = symbolPt;
    const pageH = symbolPt + captionPt;

    const [dr, dg, db] = this.hexToRgb(this.config.qrDarkColor);
    const [lr, lg, lb] = this.hexToRgb(this.config.qrLightColor);

    const ops: string[] = [];
    // Background.
    ops.push(`${lr} ${lg} ${lb} rg`, `0 0 ${pageW} ${pageH} re f`);
    ops.push(`${dr} ${dg} ${db} rg`);

    // PDF's origin is bottom-left and the matrix's is top-left, so the row
    // index is mirrored. Rectangles are emitted a hair oversized (+0.02pt) so
    // adjacent modules overlap rather than leaving hairline seams that some
    // rasterisers render as white gaps through the symbol.
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) {
        if (!get(row, col)) continue;
        const x = (col + quiet) * unit;
        const y = pageH - (row + quiet + 1) * unit;
        ops.push(
          `${x.toFixed(3)} ${y.toFixed(3)} ${(unit + 0.02).toFixed(3)} ${(unit + 0.02).toFixed(3)} re f`,
        );
      }
    }

    if (options.frame) {
      const [ar, ag, ab] = this.hexToRgb(this.config.qrAccentColor);
      ops.push(
        `${ar} ${ag} ${ab} RG`,
        "1.2 w",
        `1.5 1.5 ${(pageW - 3).toFixed(2)} ${(pageH - 3).toFixed(2)} re S`,
      );
    }

    if (caption) {
      // Helvetica's average advance is ~0.5em; good enough to centre a short
      // caption without embedding font metrics.
      const fontSize = 8;
      const textWidth = caption.length * fontSize * 0.5;
      ops.push(
        `${dr} ${dg} ${db} rg`,
        "BT",
        "/F1 8 Tf",
        `${Math.max(4, (pageW - textWidth) / 2).toFixed(2)} 8 Td`,
        `(${this.escapePdfText(caption)}) Tj`,
        "ET",
      );
    }

    return this.assemblePdf(ops.join("\n"), pageW, pageH);
  }

  /** Whether a caption survives WinAnsi encoding — see `renderPdf`. */
  pdfCaptionIsRenderable(caption: string): boolean {
    return /^[\x20-\x7E]*$/.test(caption.trim());
  }

  escapePdfText(value: string): string {
    return value.replace(/([\\()])/g, "\\$1");
  }

  hexToRgb(hex: string): [string, string, string] {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean;
    const value = Number.parseInt(full, 16);
    if (!Number.isFinite(value)) return ["0", "0", "0"];
    return [
      ((value >> 16) & 255) / 255,
      ((value >> 8) & 255) / 255,
      (value & 255) / 255,
    ].map((n) => n.toFixed(4)) as [string, string, string];
  }

  /**
   * Wraps a content stream in the minimum viable PDF 1.4 document.
   *
   * The cross-reference table stores each object's absolute byte offset, so
   * offsets are measured against the assembled buffer as it grows rather than
   * computed from string lengths — a multi-byte character anywhere in the
   * caption would otherwise shift every subsequent offset and produce a file
   * that readers reject.
   */
  assemblePdf(content: string, width: number, height: number): Buffer {
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] ` +
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      // F2 is the bold face the contact card sets names and headings in.
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ];

    const chunks: Buffer[] = [];
    let offset = 0;
    const push = (text: string): void => {
      const buf = Buffer.from(text, "latin1");
      chunks.push(buf);
      offset += buf.length;
    };

    push("%PDF-1.4\n");
    const xref: number[] = [];
    objects.forEach((body, index) => {
      xref.push(offset);
      push(`${index + 1} 0 obj\n${body}\nendobj\n`);
    });

    const xrefStart = offset;
    const entries = [
      "xref",
      `0 ${objects.length + 1}`,
      "0000000000 65535 f ",
      ...xref.map((position) => `${String(position).padStart(10, "0")} 00000 n `),
    ].join("\n");
    push(
      `${entries}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
        `startxref\n${xrefStart}\n%%EOF\n`,
    );

    return Buffer.concat(chunks);
  }

  /** Renders whichever format the caller asked for, with response metadata. */
  async render(
    url: string,
    format: "svg" | "png" | "pdf",
    options: QrRenderOptions = {},
  ): Promise<RenderedQr> {
    switch (format) {
      case "png":
        return {
          body: await this.renderPng(url, options.size),
          contentType: "image/png",
          extension: "png",
        };
      case "pdf":
        return {
          body: this.renderPdf(url, options),
          contentType: "application/pdf",
          extension: "pdf",
        };
      default:
        return {
          body: Buffer.from(this.renderSvg(url, options), "utf8"),
          contentType: "image/svg+xml; charset=utf-8",
          extension: "svg",
        };
    }
  }
}
