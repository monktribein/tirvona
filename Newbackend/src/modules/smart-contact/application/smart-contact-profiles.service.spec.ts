import { SmartContactProfilesService } from "./smart-contact-profiles.service";
import type { SmartContactAuditService } from "./smart-contact-audit.service";

/**
 * Covers the pure logic — slug derivation, phone normalisation and the public
 * projection — without a database. The projection test is the important one:
 * it is what enforces spec §22 and §38, and a regression there leaks a
 * suspended representative's phone number.
 */
describe("SmartContactProfilesService", () => {
  const service = new SmartContactProfilesService(
    {} as never,
    {} as unknown as SmartContactAuditService,
  );

  describe("slugify", () => {
    it("produces the spec's example slug", () => {
      expect(service.slugify("Ravindr Bhardwaj")).toBe("ravindr-bhardwaj");
    });

    it("folds diacritics rather than dropping the letter", () => {
      expect(service.slugify("Ravīndr Bhāradwāj")).toBe("ravindr-bharadwaj");
    });

    it("collapses punctuation and trims stray separators", () => {
      expect(service.slugify("  Dr. A.K.  Sharma (Jr.) ")).toBe(
        "dr-a-k-sharma-jr",
      );
    });

    it("returns empty for a name with no Latin characters, so the caller asks", () => {
      expect(service.slugify("रविन्द्र")).toBe("");
    });
  });

  describe("normalisePhone", () => {
    it.each([
      ["8630949349", "+918630949349"],
      ["+91 8630949349", "+918630949349"],
      ["+91-86309-49349", "+918630949349"],
      ["918630949349", "+918630949349"],
      ["08630949349", "+918630949349"],
      ["(863) 094-9349", "+918630949349"],
    ])("normalises %s to %s", (input, expected) => {
      expect(service.normalisePhone(input)).toBe(expected);
    });

    it("preserves a non-Indian country code", () => {
      expect(service.normalisePhone("+1 415 555 0100")).toBe("+14155550100");
    });

    it("returns empty for blank or non-numeric input", () => {
      expect(service.normalisePhone("")).toBe("");
      expect(service.normalisePhone(undefined)).toBe("");
      expect(service.normalisePhone("n/a")).toBe("");
    });
  });

  describe("toPublicView", () => {
    const doc = {
      _id: "sc1",
      slug: "ravindr-bhardwaj",
      firstName: "Ravindr",
      lastName: "Bhardwaj",
      displayName: "Ravindr Bhardwaj",
      organization: "Tirvona",
      designation: "Business Executive",
      roleLine: "Partnerships | Stay Onboarding",
      primaryPhone: "+918630949349",
      email: "ravindr@tirvona.com",
      website: "https://www.tirvona.com",
      photoUrl: "https://cdn.example/photo.jpg",
      city: "Rishikesh",
      status: "ACTIVE",
    };

    it("exposes contact details for an active profile", () => {
      const view = service.toPublicView(doc);
      expect(view.isActive).toBe(true);
      expect(view.primaryPhone).toBe("+918630949349");
      expect(view.email).toBe("ravindr@tirvona.com");
      expect(view.inactiveNotice).toBeUndefined();
    });

    it("withholds every contact detail once suspended (spec §22)", () => {
      const view = service.toPublicView({ ...doc, status: "SUSPENDED" });
      expect(view.isActive).toBe(false);
      expect(view.primaryPhone).toBe("");
      expect(view.email).toBe("");
      expect(view.website).toBe("");
      expect(view.photoUrl).toBe("");
      expect(view.designation).toBe("");
      // The name stays, so the visitor knows what they scanned.
      expect(view.displayName).toBe("Ravindr Bhardwaj");
      expect(view.inactiveNotice?.message).toBe(
        "This Tirvona representative profile is no longer active.",
      );
      expect(view.inactiveNotice?.contactEmail).toContain("@");
    });

    it("does the same for an archived profile", () => {
      const view = service.toPublicView({ ...doc, status: "ARCHIVED" });
      expect(view.isActive).toBe(false);
      expect(view.primaryPhone).toBe("");
      expect(view.inactiveNotice).toBeDefined();
    });

    it("never leaks an internal identifier or actor", () => {
      const view = service.toPublicView({
        ...doc,
        createdById: "admin-1",
        createdByName: "Admin",
        employeeId: "TRV-001",
      }) as unknown as Record<string, unknown>;
      expect(view.id).toBeUndefined();
      expect(view.createdBy).toBeUndefined();
      expect(view.employeeId).toBeUndefined();
      expect(view.uuid).toBeUndefined();
    });

    it("builds the permanent profile URL from the slug", () => {
      expect(service.toPublicView(doc).profileUrl).toMatch(
        /\/c\/ravindr-bhardwaj$/,
      );
      expect(service.toPublicView(doc).vcardUrl).toMatch(
        /\/api\/v1\/smart-contact\/ravindr-bhardwaj\/vcard$/,
      );
    });
  });
});
