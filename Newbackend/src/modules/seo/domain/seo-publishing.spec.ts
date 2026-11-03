import {
  SEO_PAGE_TYPES,
  SEO_PAGE_TYPES_WITHOUT_ENTITY,
  checkContentJson,
  checkRedirect,
  checkSchemaJson,
  checkTexts,
  cleanText,
  textKey,
} from "./seo-publishing";
import { STATIC_PAGES } from "./seo-route-policy";

describe("SEO publishing rules", () => {
  it("treats empty text as 'no override' and collapses whitespace", () => {
    expect(cleanText("  Har  Ki\nPauri ")).toBe("Har Ki Pauri");
    expect(cleanText("   ")).toBeNull();
    expect(cleanText(null)).toBeNull();
    expect(textKey("  Same Title ")).toBe(textKey("same title"));
  });

  it("errors on hard limits and markup, warns outside the recommended lengths", () => {
    expect(checkTexts({ seoTitle: "x".repeat(71) }).errors).toHaveLength(1);
    expect(checkTexts({ metaDescription: "x".repeat(171) }).errors).toHaveLength(1);
    expect(checkTexts({ h1: "x".repeat(121) }).errors).toHaveLength(1);
    expect(checkTexts({ seoTitle: "Temples <script>" }).errors[0]).toMatch(/plain text/);
    expect(checkTexts({ seoTitle: "Short" })).toEqual({ errors: [], warnings: [expect.stringMatching(/30–65/)] });
    expect(checkTexts({ seoTitle: "Har Ki Pauri Haridwar: Ganga Aarti Timings & Guide" })).toEqual({ errors: [], warnings: [] });
    expect(checkTexts({ seoTitle: null, metaDescription: undefined })).toEqual({ errors: [], warnings: [] });
  });

  it("accepts FAQ/HowTo/Event additions with on-site URLs and the schema.org vocabulary", () => {
    const faq = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "Timings?", acceptedAnswer: { "@type": "Answer", text: "Sunset.", url: "https://www.tirvona.com/temples/x" } }],
    };
    expect(checkSchemaJson(faq)).toEqual([]);
    expect(checkSchemaJson([faq, { "@type": "Event", name: "Snan", image: "https://res.cloudinary.com/demo/x.jpg" }])).toEqual([]);
    expect(checkSchemaJson(null)).toEqual([]);
  });

  it("rejects other types, ratings, off-site URLs, markup and oversized schema", () => {
    expect(checkSchemaJson({ "@type": "Product" })[0]).toMatch(/@type must be one of/);
    expect(checkSchemaJson({ "@type": "FAQPage", aggregateRating: { ratingValue: 5 } })).toEqual([expect.stringMatching(/aggregateRating/)]);
    expect(checkSchemaJson({ "@type": "FAQPage", review: [] })).toEqual([expect.stringMatching(/review/)]);
    expect(checkSchemaJson({ "@type": "FAQPage", url: "https://evil.example.com/" })[0]).toMatch(/www\.tirvona\.com/);
    expect(checkSchemaJson({ "@type": "FAQPage", "@context": "https://schema.org.evil.com" })[0]).toMatch(/www\.tirvona\.com/);
    expect(checkSchemaJson({ "@type": "FAQPage", name: "<b>x</b>" })[0]).toMatch(/plain text/);
    expect(checkSchemaJson({ "@type": "FAQPage", text: "x".repeat(17 * 1024) })[0]).toMatch(/16 KB/);
    expect(checkSchemaJson("FAQPage")).toEqual(["Schema must be a JSON object or a list of objects."]);
    expect(checkSchemaJson([])).toEqual(["Schema must be a JSON object or a list of objects."]);
  });

  it("accepts only intro, sections and faq as page copy", () => {
    expect(checkContentJson({ intro: "Hello", sections: [{ heading: "Rooms", body: "Clean rooms." }], faq: [{ question: "Q?", answer: "A." }] })).toEqual([]);
    expect(checkContentJson({ intro: "x", html: "<p>" })).toEqual([expect.stringMatching(/"html"/)]);
    expect(checkContentJson({ sections: [{ heading: "x" }] })[0]).toMatch(/sections\[0\]/);
    expect(checkContentJson({ faq: [{ question: "Q", answer: "<b>A</b>" }] })[0]).toMatch(/plain text/);
    expect(checkContentJson([1])).toEqual(["Content must be a JSON object."]);
  });

  it("allows a retired page to point only at another on-site path", () => {
    expect(checkRedirect("/temples/mansa-devi", "/temples/x")).toEqual([]);
    expect(checkRedirect("/temples/x", "/temples/x")[0]).toMatch(/itself/);
    expect(checkRedirect("https://evil.example.com/", "/temples/x")[0]).toMatch(/site path/);
    expect(checkRedirect("/Temples/X", "/temples/x")[0]).toMatch(/site path/);
  });

  it("covers every route-policy page kind, and only fixed or city pages go without an entity", () => {
    expect(SEO_PAGE_TYPES).toEqual(expect.arrayContaining(["static", "landing", "temple", "volunteerJob", "marketplaceStore"]));
    expect([...SEO_PAGE_TYPES_WITHOUT_ENTITY].sort()).toEqual(["ashramCity", "destination", "landing", "static"]);
    // Landing pages are fixed pages in the route policy too.
    expect(STATIC_PAGES["/stays-near-prem-mandir-vrindavan"]).toBeDefined();
  });
});
