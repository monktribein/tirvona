import { VcardService } from "./vcard.service";
import type { SmartContactProfileView } from "../domain/smart-contact.types";

const profile = (
  overrides: Partial<SmartContactProfileView> = {},
): SmartContactProfileView => ({
  id: "sc_001",
  uuid: "uuid-1",
  employeeId: "TRV-001",
  slug: "ravindr-bhardwaj",
  firstName: "Ravindr",
  lastName: "Bhardwaj",
  displayName: "Ravindr Bhardwaj",
  organization: "Tirvona",
  designation: "Business Executive",
  department: "",
  roleLine: "Partnerships | Stay Onboarding",
  primaryPhone: "+918630949349",
  secondaryPhone: "+917835066357",
  whatsappPhone: "+918630949349",
  email: "ravindr@tirvona.com",
  website: "https://www.tirvona.com",
  addressLine1: "",
  addressLine2: "",
  city: "",
  district: "",
  state: "",
  postalCode: "",
  country: "India",
  photoUrl: "",
  photoAssetId: "",
  brandId: "tirvona",
  category: "employee",
  status: "ACTIVE",
  profileUrl: "https://www.tirvona.com/c/ravindr-bhardwaj",
  createdBy: null,
  updatedBy: null,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("VcardService", () => {
  const service = new VcardService();

  it("emits the vCard 3.0 envelope from spec §47", () => {
    const vcf = service.build(profile());
    const lines = vcf.split("\r\n");

    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[1]).toBe("VERSION:3.0");
    expect(lines).toContain("N:Bhardwaj;Ravindr;;;");
    expect(lines).toContain("FN:Ravindr Bhardwaj");
    expect(lines).toContain("ORG:Tirvona");
    expect(lines).toContain("TITLE:Business Executive");
    expect(lines).toContain("TEL;TYPE=CELL:+918630949349");
    expect(lines).toContain("TEL;TYPE=WORK:+917835066357");
    expect(lines).toContain("EMAIL;TYPE=INTERNET,WORK:ravindr@tirvona.com");
    expect(lines).toContain("URL:https://www.tirvona.com");
    expect(vcf.trimEnd().endsWith("END:VCARD")).toBe(true);
  });

  it("terminates every line with CRLF, which iOS requires", () => {
    const vcf = service.build(profile());
    expect(vcf).toContain("\r\n");
    // No bare LF anywhere.
    expect(/[^\r]\n/.test(vcf)).toBe(false);
  });

  it("escapes the pipe-and-comma role line without splitting the field", () => {
    const vcf = service.build(
      profile({ roleLine: "Partnerships, Stay Onboarding; North" }),
    );
    expect(vcf).toContain("ROLE:Partnerships\\, Stay Onboarding\\; North");
  });

  it("does not repeat the WhatsApp number when it matches the primary", () => {
    const vcf = service.build(profile());
    const telLines = vcf.split("\r\n").filter((l) => l.startsWith("TEL"));
    expect(telLines).toHaveLength(2);
  });

  it("emits a third TEL when WhatsApp differs from both numbers", () => {
    const vcf = service.build(profile({ whatsappPhone: "+919999999999" }));
    const telLines = vcf.split("\r\n").filter((l) => l.startsWith("TEL"));
    expect(telLines).toHaveLength(3);
  });

  it("omits ADR entirely when only the country is known", () => {
    expect(service.build(profile())).not.toContain("ADR");
  });

  it("emits ADR in RFC order once a business address exists", () => {
    const vcf = service.build(
      profile({
        addressLine1: "12 Ganga Marg",
        city: "Rishikesh",
        state: "Uttarakhand",
        postalCode: "249201",
      }),
    );
    expect(vcf).toContain(
      "ADR;TYPE=WORK:;;12 Ganga Marg;Rishikesh;Uttarakhand;249201;India",
    );
  });

  it("folds long lines without splitting a Devanagari codepoint", () => {
    const vcf = service.build(
      profile({
        displayName: "रविन्द्र भारद्वाज".repeat(8),
      }),
    );
    // Every folded continuation begins with a single space.
    const folded = vcf.split("\r\n").filter((line) => line.startsWith(" "));
    expect(folded.length).toBeGreaterThan(0);
    // Unfolding restores intact text — no U+FFFD from a mid-sequence cut.
    const unfolded = vcf.replace(/\r\n /g, "");
    expect(unfolded).not.toContain("�");
    expect(unfolded).toContain("रविन्द्र भारद्वाज");
  });

  it("names the download after the slug", () => {
    expect(service.filename("ravindr-bhardwaj")).toBe("ravindr-bhardwaj.vcf");
  });
});
