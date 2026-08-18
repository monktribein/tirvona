import { Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";
import type { SmartContactProfileView } from "../domain/smart-contact.types";
import { QrService, type PdfImage } from "./qr.service";

/**
 * The printable identity badge.
 *
 * CR80 portrait — 54 × 85.6 mm, the ISO/IEC 7810 ID-1 card size every badge
 * printer and lanyard holder is built around. Emitted as vector PDF at exactly
 * that size so "print at 100%" produces a card that fits the holder, which a
 * PNG at some assumed DPI would not.
 *
 * As with the contact card, the QR on it encodes only the profile URL. The
 * details printed beside it are fixed at print time; the page behind the QR
 * stays editable. Reprint to correct the card, edit the profile to correct
 * everything a scan will ever show.
 */
@Injectable()
export class IdCardService {
  private readonly logger = new Logger(IdCardService.name);
  private readonly config: SmartContactConfig = smartContactConfig();

  constructor(private readonly qr: QrService) {}

  /** 54 × 85.6 mm in points (1pt = 1/72in). */
  private static readonly W = 153.07;
  private static readonly H = 242.65;

  /**
   * The brand logo, read once at startup.
   *
   * Despite its `.png` name the file is a JFIF/JPEG — which is lucky, because
   * JPEG embeds into a PDF verbatim. Read from disk rather than fetched, so
   * rendering a card makes no network call and cannot fail on someone else's
   * uptime.
   */
  private readonly logo: PdfImage | null = this.loadLogo();

  private loadLogo(): PdfImage | null {
    // `dist/` mirrors `src/`, so the asset is resolved relative to this file
    // in dev and to the compiled output in production — hence both candidates.
    const candidates = [
      resolve(__dirname, "../assets/tirvona-logo.jpg"),
      resolve(process.cwd(), "src/modules/smart-contact/assets/tirvona-logo.jpg"),
    ];

    for (const path of candidates) {
      try {
        const data = readFileSync(path);
        const size = this.jpegSize(data);
        if (!size) continue;
        return { name: "Im1", data, width: size.width, height: size.height };
      } catch {
        // Try the next candidate.
      }
    }

    this.logger.warn(
      "Tirvona logo not found — ID cards will render with the wordmark set in " +
        "type instead of the brand mark.",
    );
    return null;
  }

  /**
   * Reads dimensions out of a JPEG's SOF marker.
   *
   * The PDF image dictionary must declare the true pixel dimensions, and there
   * is no decoder here to ask — so the marker segments are walked directly.
   * Returns null for anything that is not a baseline/progressive JPEG, which
   * is also the format check.
   */
  private jpegSize(data: Buffer): { width: number; height: number } | null {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = data[i + 1];
      // SOF0–SOF15 carry the frame header; DHT/DAC/RST share the range.
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof) {
        return {
          height: data.readUInt16BE(i + 5),
          width: data.readUInt16BE(i + 7),
        };
      }
      const length = data.readUInt16BE(i + 2);
      if (length < 2) return null;
      i += 2 + length;
    }
    return null;
  }

  /** Folds text to what the standard WinAnsi fonts can actually render. */
  private ascii(value: string): string {
    return String(value ?? "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x20-\xFF]/g, "")
      .trim();
  }

  /** Truncates to a column width, using Helvetica's ~0.52em average advance. */
  private fit(text: string, fontSize: number, maxWidth: number): string {
    const value = this.ascii(text);
    if (!value) return "";
    const max = Math.floor(maxWidth / (fontSize * 0.52));
    return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`;
  }

  /** Centred text, positioned from an estimated width. */
  private centred(
    text: string,
    font: "F1" | "F2",
    size: number,
    yFromTop: number,
    colour: string,
  ): string[] {
    const value = this.fit(text, size, IdCardService.W - 16);
    if (!value) return [];
    const width = value.length * size * 0.5;
    return [
      colour,
      "BT",
      `/${font} ${size} Tf`,
      `${((IdCardService.W - width) / 2).toFixed(2)} ${(IdCardService.H - yFromTop).toFixed(2)} Td`,
      `(${this.qr.escapePdfText(value)}) Tj`,
      "ET",
    ];
  }

  /**
   * Renders the badge.
   *
   * Coordinates below are written top-down for legibility and converted with
   * `H - y` at the point of use, because PDF's origin is bottom-left and a
   * layout described upside-down is unreadable.
   */
  render(profile: SmartContactProfileView, url: string): Buffer {
    const { W, H } = IdCardService;
    const [dr, dg, db] = this.qr.hexToRgb(this.config.qrDarkColor);
    const [ar, ag, ab] = this.qr.hexToRgb(this.config.qrAccentColor);
    const navy = `${dr} ${dg} ${db} rg`;
    const gold = `${ar} ${ag} ${ab} rg`;
    const primary = "0.039 0.302 0.651 rg";
    const muted = "0.392 0.455 0.545 rg";
    const white = "1 1 1 rg";

    const ops: string[] = [];

    // Card ground
    ops.push(white, `0 0 ${W.toFixed(2)} ${H.toFixed(2)} re f`);

    // Navy header band + gold rule beneath it.
    //
    // The vertical budget is tight — 242.65pt for a logo, photo, four lines of
    // type, a QR and a caption — so every band below is sized to leave the
    // next element clear. Changing one number here means rechecking the rest.
    const headerH = 76;
    ops.push(navy, `0 ${(H - headerH).toFixed(2)} ${W.toFixed(2)} ${headerH} re f`);
    ops.push(gold, `0 ${(H - headerH - 3).toFixed(2)} ${W.toFixed(2)} 3 re f`);

    // Logo, on a white chip because the artwork has a white ground. Sized to
    // sit entirely inside the band: an earlier version overflowed it and the
    // chip painted over the gold rule.
    if (this.logo) {
      const logoW = 72;
      const logoH = (logoW * this.logo.height) / this.logo.width;
      const x = (W - logoW) / 2;
      const y = H - 8 - logoH;
      ops.push(
        white,
        `${(x - 4).toFixed(2)} ${(y - 4).toFixed(2)} ${(logoW + 8).toFixed(2)} ${(logoH + 8).toFixed(2)} re f`,
      );
      ops.push(
        "q",
        `${logoW.toFixed(2)} 0 0 ${logoH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
        `/${this.logo.name} Do`,
        "Q",
      );
    } else {
      ops.push(...this.centred("TIRVONA", "F2", 15, 34, white));
    }

    ops.push(...this.centred("AUTHORISED REPRESENTATIVE", "F1", 5.2, 71, gold));

    // Photograph frame. A square rather than a circle: clipping to a circle in
    // raw PDF means four bezier curves and a clip path, and a square badge
    // photo is entirely conventional. The frame is drawn either way, so the
    // layout does not shift when a profile has no photo.
    const photoSide = 46;
    const photoX = (W - photoSide) / 2;
    const photoTop = 86;
    ops.push(
      gold,
      `${(photoX - 2).toFixed(2)} ${(H - photoTop - photoSide - 2).toFixed(2)} ${(photoSide + 4).toFixed(2)} ${(photoSide + 4).toFixed(2)} re f`,
    );
    ops.push(
      "0.945 0.961 0.976 rg",
      `${photoX.toFixed(2)} ${(H - photoTop - photoSide).toFixed(2)} ${photoSide} ${photoSide} re f`,
    );
    // Initials stand in for the photograph — see the class note on why the
    // image itself is not fetched here.
    const initials =
      `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase() || "T";
    ops.push(...this.centred(initials, "F2", 19, photoTop + 30, primary));

    // Identity block
    ops.push(...this.centred(profile.displayName, "F2", 12, 148, navy));
    ops.push(...this.centred(profile.designation, "F2", 7.5, 158, primary));
    ops.push(...this.centred(profile.roleLine, "F1", 6, 166, muted));
    if (profile.employeeId) {
      ops.push(...this.centred(`ID ${profile.employeeId}`, "F1", 5.5, 174, muted));
    }

    // QR — the only machine-readable thing on the card, and it holds the URL
    // and nothing else.
    const qrSide = 40;
    const qrX = (W - qrSide) / 2;
    const qrY = H - 180 - qrSide;
    ops.push(navy);
    ops.push(...this.qr.qrPdfRects(url, qrX, qrY, qrSide));
    ops.push(...this.centred("Scan to save contact", "F1", 5, 228, muted));

    // Gold foot
    ops.push(gold, `0 0 ${W.toFixed(2)} 6 re f`);

    return this.qr.assemblePdf(
      ops.join("\n"),
      W,
      H,
      this.logo ? [this.logo] : [],
    );
  }

  filename(slug: string): string {
    return `${slug}-id-card.pdf`;
  }
}
