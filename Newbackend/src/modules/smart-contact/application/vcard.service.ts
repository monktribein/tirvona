import { Injectable } from "@nestjs/common";
import type { SmartContactProfileView } from "../domain/smart-contact.types";

/**
 * Builds vCard 3.0 payloads from live profile data (spec §9, §10, §47).
 *
 * 3.0 rather than 4.0 on purpose: spec §10 picks it for address-book
 * compatibility, and it remains the version both the iOS and Android contact
 * importers handle without argument. The cost is 3.0's quoted-printable-era
 * escaping rules, which is most of what this file is.
 *
 * Nothing here is hard-coded per §10's closing line — every field is read from
 * the profile, so changing a number in the console changes the next .vcf.
 */
@Injectable()
export class VcardService {
  /**
   * Escapes a value for a vCard text field.
   *
   * Backslash first, or it would double-escape the backslashes introduced by
   * the later replacements. Commas and semicolons are structural separators in
   * 3.0 — an unescaped comma in "Partnerships, Stay Onboarding" would split
   * one ROLE into two values.
   */
  private escape(value: string): string {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  /**
   * Folds a line to 75 octets per RFC 2426, continuing with a leading space.
   *
   * Counted in UTF-8 octets, not JS characters, and never split inside a
   * multi-byte sequence — spec §11 requires UTF-8 support because profiles may
   * carry Hindi names, and a fold placed mid-codepoint produces a .vcf that
   * imports as mojibake on Android.
   */
  private fold(line: string): string {
    const bytes = Buffer.from(line, "utf8");
    if (bytes.length <= 75) return line;

    const chunks: string[] = [];
    let start = 0;
    // First line takes 75 octets; continuations take 74 plus the leading space.
    let limit = 75;
    while (start < bytes.length) {
      let end = Math.min(start + limit, bytes.length);
      // Walk back off a continuation byte (10xxxxxx) so the cut lands on a
      // codepoint boundary.
      while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) {
        end -= 1;
      }
      chunks.push(bytes.subarray(start, end).toString("utf8"));
      start = end;
      limit = 74;
    }
    return chunks.join("\r\n ");
  }

  /**
   * A phone as the dialler wants it: digits and a single leading `+`.
   *
   * Profiles are stored normalised, but a value that predates normalisation
   * (or arrived through a migration) would otherwise reach the TEL field with
   * spaces in it, which some importers keep verbatim in the saved contact.
   */
  private tel(value: string): string {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return "";
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!digits) return "";
    return trimmed.startsWith("+") ? `+${digits}` : digits;
  }

  /**
   * Assembles the .vcf body.
   *
   * CRLF throughout — RFC 2426 mandates it, and iOS in particular is strict
   * enough that an LF-only file imports as a single malformed contact.
   */
  build(profile: SmartContactProfileView): string {
    const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

    // N is structured: Family;Given;Additional;Prefix;Suffix. The trailing
    // semicolons are required even when empty.
    lines.push(
      `N:${this.escape(profile.lastName)};${this.escape(profile.firstName)};;;`,
    );
    lines.push(`FN:${this.escape(profile.displayName)}`);

    if (profile.organization) {
      // ORG's second component is the department, which is exactly what the
      // spec's "Department" field means.
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
    // Only when it differs from the numbers already present — a duplicate TEL
    // shows up as a repeated row in the saved contact on both platforms.
    const whatsapp = this.tel(profile.whatsappPhone);
    if (whatsapp && whatsapp !== primary && whatsapp !== secondary) {
      lines.push(`TEL;TYPE=CELL:${whatsapp}`);
    }

    if (profile.email)
      lines.push(`EMAIL;TYPE=INTERNET,WORK:${this.escape(profile.email)}`);
    if (profile.website) lines.push(`URL:${this.escape(profile.website)}`);

    // ADR structure: PO;Extended;Street;Locality;Region;PostalCode;Country.
    // Emitted only when there is something beyond the country to say, so a
    // profile with no confirmed office address does not import an entry
    // reading only "India" (spec §47 leaves the address as a placeholder until
    // the official one is set from the console).
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
      // Referenced by URI rather than embedded. A base64 PHOTO would inflate
      // the .vcf from ~400 bytes to hundreds of kilobytes, and both mobile
      // importers fetch the URI form.
      lines.push(`PHOTO;VALUE=URI:${this.escape(profile.photoUrl)}`);
    }

    lines.push(
      `NOTE:${this.escape(
        `${profile.organization || "Tirvona"}™ - India's Digital Infrastructure for Religious Destinations`,
      )}`,
    );
    // Lets a contacts app show when the card was last refreshed, which is the
    // visible half of "always updated".
    lines.push(`REV:${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`);
    lines.push("END:VCARD");

    return lines.map((line) => this.fold(line)).join("\r\n") + "\r\n";
  }

  /** `ravindr-bhardwaj.vcf` — the filename the browser saves (spec §11). */
  filename(slug: string): string {
    return `${slug}.vcf`;
  }
}
