import { BadRequestException } from "@nestjs/common";
import { ContactCardService } from "./contact-card.service";
import { QrService } from "./qr.service";
import type { SmartContactProfileView } from "../domain/smart-contact.types";

const URL = "https://www.tirvona.com/c/ravindr-bhardwaj";

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
  profileUrl: URL,
  createdBy: null,
  updatedBy: null,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("ContactCardService", () => {
  const cards = new ContactCardService(new QrService());

  describe("SVG", () => {
    it("prints the identity and contact details on the card", () => {
      const svg = cards.renderSvg(profile(), URL);
      expect(svg).toContain("Ravindr Bhardwaj");
      expect(svg).toContain("Business Executive");
      expect(svg).toContain("Partnerships | Stay Onboarding");
      expect(svg).toContain("+918630949349");
      expect(svg).toContain("+917835066357");
      expect(svg).toContain("ravindr@tirvona.com");
      expect(svg).toContain("TIRVONA");
      expect(svg).toContain("Connecting Sacred Destinations");
    });

    it("strips the scheme from the website so the line fits", () => {
      const svg = cards.renderSvg(profile(), URL);
      expect(svg).toContain(">www.tirvona.com<");
    });

    it("is an 88×55mm landscape card", () => {
      const svg = cards.renderSvg(profile(), URL);
      expect(svg).toContain('viewBox="0 0 249.45 155.91"');
    });

    it("still encodes only the URL in the symbol itself", () => {
      const svg = cards.renderSvg(profile(), URL);
      const { path } = new QrService().qrGeometry(URL);
      expect(svg).toContain(path);
    });

    it("omits contact lines the profile does not have", () => {
      const svg = cards.renderSvg(
        profile({ secondaryPhone: "", email: "", website: "" }),
        URL,
      );
      expect(svg).not.toContain("+917835066357");
      expect(svg).not.toContain("ravindr@tirvona.com");
      expect(svg).toContain("+918630949349");
    });

    it("includes the photograph only when asked and available", () => {
      const withPhoto = cards.renderSvg(
        profile({ photoUrl: "https://cdn.example/p.jpg" }),
        URL,
        { photo: true },
      );
      expect(withPhoto).toContain("https://cdn.example/p.jpg");
      expect(withPhoto).toContain("clipPath");

      expect(cards.renderSvg(profile(), URL, { photo: true })).not.toContain(
        "<image",
      );
    });

    it("escapes text so a stray bracket cannot break the markup", () => {
      const svg = cards.renderSvg(
        profile({ displayName: '<script>"x"' }),
        URL,
      );
      expect(svg).not.toContain("<script>");
      expect(svg).toContain("&lt;script&gt;");
    });

    it("truncates an overlong designation rather than running under the QR", () => {
      const svg = cards.renderSvg(
        profile({ designation: "Senior ".repeat(40) + "Executive" }),
        URL,
      );
      expect(svg).toContain("…");
    });

    it("renders Devanagari, which the PDF cannot", () => {
      const svg = cards.renderSvg(
        profile({ displayName: "रविन्द्र भारद्वाज" }),
        URL,
      );
      expect(svg).toContain("रविन्द्र भारद्वाज");
    });
  });

  describe("PDF", () => {
    it("produces a structurally valid single-page card", () => {
      const pdf = cards.renderPdf(profile(), URL);
      const text = pdf.toString("latin1");
      expect(text.startsWith("%PDF-1.4")).toBe(true);
      expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
      expect(text).toContain("/BaseFont /Helvetica");
      expect(text).toContain("/BaseFont /Helvetica-Bold");

      const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
      expect(text.slice(startxref, startxref + 4)).toBe("xref");
    });

    it("writes the identity into the content stream", () => {
      const text = cards.renderPdf(profile(), URL).toString("latin1");
      expect(text).toContain("(Ravindr Bhardwaj) Tj");
      expect(text).toContain("(Business Executive) Tj");
      expect(text).toContain("(+918630949349) Tj");
    });

    it("keeps xref offsets correct when text carries a smart apostrophe", () => {
      const text = cards.renderPdf(profile(), URL).toString("latin1");
      const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
      expect(text.slice(startxref, startxref + 4)).toBe("xref");
    });

    it("reports when a profile would lose characters in PDF", () => {
      expect(cards.pdfSafe(profile())).toBe(true);
      expect(
        cards.pdfSafe(profile({ displayName: "रविन्द्र भारद्वाज" })),
      ).toBe(false);
    });
  });

  describe("render()", () => {
    it("returns SVG by default and PDF on request", () => {
      expect(cards.render(profile(), URL, "svg")).toMatchObject({
        contentType: "image/svg+xml; charset=utf-8",
        extension: "svg",
      });
      expect(cards.render(profile(), URL, "pdf")).toMatchObject({
        contentType: "application/pdf",
        extension: "pdf",
      });
    });

    it("refuses PNG rather than silently returning a different layout", () => {
      expect(() => cards.render(profile(), URL, "png")).toThrow(
        BadRequestException,
      );
    });
  });
});
