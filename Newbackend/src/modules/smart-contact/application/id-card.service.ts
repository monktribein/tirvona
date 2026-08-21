import { Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  smartContactConfig,
  type SmartContactConfig,
} from "../config/smart-contact.config";
import type { SmartContactProfileView } from "../domain/smart-contact.types";
import { QrService, type PdfImage } from "./qr.service";

@Injectable()
export class IdCardService {
  private readonly logger = new Logger(IdCardService.name);
  private readonly config: SmartContactConfig = smartContactConfig();

  constructor(private readonly qr: QrService) {}

  private static readonly W = 153.07;
  private static readonly H = 242.65;

  private readonly logo: PdfImage | null = this.loadLogo();

  private loadLogo(): PdfImage | null {
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
        // Unreadable candidate path — fall through to the next one.
      }
    }

    this.logger.warn(
      "Tirvona logo not found — ID cards will render with the wordmark set in " +
        "type instead of the brand mark.",
    );
    return null;
  }

  private jpegSize(data: Buffer): { width: number; height: number } | null {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < data.length) {
      if (data[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = data[i + 1];
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

  private ascii(value: string): string {
    return String(value ?? "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x20-\xFF]/g, "")
      .trim();
  }

  private fit(text: string, fontSize: number, maxWidth: number): string {
    const value = this.ascii(text);
    if (!value) return "";
    const max = Math.floor(maxWidth / (fontSize * 0.52));
    return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 1))}…`;
  }

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

    ops.push(white, `0 0 ${W.toFixed(2)} ${H.toFixed(2)} re f`);

    const headerH = 76;
    ops.push(navy, `0 ${(H - headerH).toFixed(2)} ${W.toFixed(2)} ${headerH} re f`);
    ops.push(gold, `0 ${(H - headerH - 3).toFixed(2)} ${W.toFixed(2)} 3 re f`);

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
    const initials =
      `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase() || "T";
    ops.push(...this.centred(initials, "F2", 19, photoTop + 30, primary));

    ops.push(...this.centred(profile.displayName, "F2", 12, 148, navy));
    ops.push(...this.centred(profile.designation, "F2", 7.5, 158, primary));
    ops.push(...this.centred(profile.roleLine, "F1", 6, 166, muted));
    if (profile.employeeId) {
      ops.push(...this.centred(`ID ${profile.employeeId}`, "F1", 5.5, 174, muted));
    }

    const qrSide = 40;
    const qrX = (W - qrSide) / 2;
    const qrY = H - 180 - qrSide;
    ops.push(navy);
    ops.push(...this.qr.qrPdfRects(url, qrX, qrY, qrSide));
    ops.push(...this.centred("Scan to save contact", "F1", 5, 228, muted));

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
