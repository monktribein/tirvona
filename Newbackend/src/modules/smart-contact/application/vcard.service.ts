import { Injectable } from "@nestjs/common";
import type { SmartContactProfileView } from "../domain/smart-contact.types";

@Injectable()
export class VcardService {
  private escape(value: string): string {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  private fold(line: string): string {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return line;

    const chunks: string[] = [];
    let start = 0;
    let limit = 75;
    while (start < bytes.length) {
      let end = Math.min(start + limit, bytes.length);
      while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
        end -= 1;
      }
      chunks.push(bytes.subarray(start, end).toString("utf8"));
      start = end;
      limit = 74;
    }
    return chunks.join("\r\n ");
  }

  private tel(value: string): string {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return "";
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!digits) return "";
    return trimmed.startsWith("+") ? `+${digits}` : digits;
  }

  build(profile: SmartContactProfileView): string {
    const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

    lines.push(
      `N:${this.escape(profile.lastName)};${this.escape(profile.firstName)};;;`,
    );
    lines.push(`FN:${this.escape(profile.displayName)}`);

    if (profile.organization) {
      const org = profile.department
        ? `${this.escape(profile.organization)};${this.escape(profile.department)}`
        : this.escape(profile.organization);
      lines.push(`ORG:${org}`);
    }
    if (profile.designation)
      lines.push(`TITLE:${this.escape(profile.designation)}`);
    if (profile.roleLine) lines.push(`ROLE:${this.escape(profile.roleLine)}`);

    const primary = this.tel(profile.primaryPhone);
    const secondary = this.tel(profile.secondaryPhone);
    if (primary) lines.push(`TEL;TYPE=CELL:${primary}`);
    if (secondary) lines.push(`TEL;TYPE=WORK:${secondary}`);
    const whatsapp = this.tel(profile.whatsappPhone);
    if (whatsapp && whatsapp !== primary && whatsapp !== secondary) {
      lines.push(`TEL;TYPE=CELL:${whatsapp}`);
    }

    if (profile.email)
      lines.push(`EMAIL;TYPE=INTERNET,WORK:${this.escape(profile.email)}`);
    if (profile.website) lines.push(`URL:${this.escape(profile.website)}`);

    const street = [profile.addressLine1, profile.addressLine2]
      .filter(Boolean)
      .join(", ");
    const hasAddress = Boolean(
      street || profile.city || profile.state || profile.postalCode,
    );
    if (hasAddress) {
      lines.push(
        `ADR;TYPE=WORK:;;${this.escape(street)};${this.escape(profile.city)};` +
          `${this.escape(profile.state)};${this.escape(profile.postalCode)};` +
          `${this.escape(profile.country)}`,
      );
    }

    if (profile.photoUrl) {
      lines.push(`PHOTO;VALUE=URI:${this.escape(profile.photoUrl)}`);
    }

    lines.push(
      `NOTE:${this.escape(
        `${profile.organization || "Tirvona"}™ - India's Digital Infrastructure for Religious Destinations`,
      )}`,
    );
    lines.push(`REV:${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`);
    lines.push("END:VCARD");

    return lines.map((line) => this.fold(line)).join("\r\n") + "\r\n";
  }

  filename(slug: string): string {
    return `${slug}.vcf`;
  }
}
