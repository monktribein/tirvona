import { Injectable } from "@nestjs/common";
import * as QRCode from "qrcode";
import {
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";

export interface QrRenderOptions {
  size?: number;
  caption?: string;
  frame?: boolean;
  logo?: boolean;
}

export interface RenderedQr {
  body: Buffer;
  contentType: string;
  extension: string;
}

export interface PdfImage {
  name: string;
  data: Buffer;
  width: number;
  height: number;
}

@Injectable()
export class QrService {
  private readonly config: SmartContactConfig = smartContactConfig();

  private static readonly QUIET_ZONE = 4;

  private static readonly LOGO_RATIO = 0.18;

  private matrix(text: string): { size: number; get: (r: number, c: number) => boolean } {
    const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
    const { size, data } = qr.modules;
    return { size, get: (r, c) => Boolean(data[r * size + c]) };
  }

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

  renderSvg(url: string, options: QrRenderOptions = {}): string {
    const { size: modules, get } = this.matrix(url);
    const quiet = QrService.QUIET_ZONE;
    const grid = modules + quiet * 2;
    const caption = options.caption?.trim() ?? "";
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

  async renderPng(url: string, size?: number): Promise<Buffer> {
    return QRCode.toBuffer(url, this.pngOptions(size));
  }

  pngOptions(size?: number): QRCode.QRCodeToBufferOptions {
    return {
      errorCorrectionLevel: "H",
      type: "png",
      width: Math.min(4000, Math.max(200, size ?? this.config.qrDefaultPngSize)),
      margin: QrService.QUIET_ZONE,
      color: { dark: this.config.qrDarkColor, light: this.config.qrLightColor },
    };
  }

  renderPdf(url: string, options: QrRenderOptions = {}): Buffer {
    const { size: modules, get } = this.matrix(url);
    const quiet = QrService.QUIET_ZONE;
    const grid = modules + quiet * 2;

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
    ops.push(`${lr} ${lg} ${lb} rg`, `0 0 ${pageW} ${pageH} re f`);
    ops.push(`${dr} ${dg} ${db} rg`);

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

  assemblePdf(
    content: string,
    width: number,
    height: number,
    images: PdfImage[] = [],
  ): Buffer {
    const imageRefs = images
      .map((image, index) => `/${image.name} ${7 + index} 0 R`)
      .join(" ");
    const xobject = imageRefs ? ` /XObject << ${imageRefs} >>` : "";

    const objects: (string | Buffer)[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width.toFixed(2)} ${height.toFixed(2)}] ` +
        `/Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${xobject} >> >>`,
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ];

    for (const image of images) {
      objects.push(
        Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${image.width} ` +
              `/Height ${image.height} /ColorSpace /DeviceRGB ` +
              `/BitsPerComponent 8 /Filter /DCTDecode ` +
              `/Length ${image.data.length} >>\nstream\n`,
            "latin1",
          ),
          image.data,
          Buffer.from("\nendstream", "latin1"),
        ]),
      );
    }

    const chunks: Buffer[] = [];
    let offset = 0;
    const push = (text: string | Buffer): void => {
      const buf =
        typeof text === "string" ? Buffer.from(text, "latin1") : text;
      chunks.push(buf);
      offset += buf.length;
    };

    push("%PDF-1.4\n");
    const xref: number[] = [];
    objects.forEach((body, index) => {
      xref.push(offset);
      push(
        Buffer.concat([
          Buffer.from(`${index + 1} 0 obj\n`, "latin1"),
          typeof body === "string" ? Buffer.from(body, "latin1") : body,
          Buffer.from("\nendobj\n", "latin1"),
        ]),
      );
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
