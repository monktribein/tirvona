import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import {
  CANONICAL_ALIASES,
  STATIC_PAGES,
  canonicalPathFor,
  classifyPath,
  entitySeo,
  isPrivatePath,
  robotsFor,
  summarize,
} from "./seo-route-policy";
import { escapeHtml, renderDocument, safeUrl, serializeJsonLd } from "./seo-html";

const FRONTEND = path.resolve(__dirname, "../../../../../frontend/src");
const frontendFile = (rel: string) => path.join(FRONTEND, rel);
const hasFrontend = existsSync(frontendFile("App.tsx"));

describe("seo route policy", () => {
  (hasFrontend ? it : it.skip)("is byte-identical to the frontend copy", () => {
    const backend = readFileSync(path.join(__dirname, "seo-route-policy.ts"), "utf8").replace(/\r\n/g, "\n");
    const frontend = readFileSync(frontendFile("seo/routePolicy.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(backend).toBe(frontend);
  });

  (hasFrontend ? it : it.skip)("matches the landing-page titles and descriptions the React pages use", async () => {
    const { SEO_LANDING_CONFIGS } = await import(frontendFile("seo/seoLandingConfigs"));
    for (const config of Object.values<any>(SEO_LANDING_CONFIGS)) {
      const route = canonicalPathFor(config.route);
      expect({ route, title: STATIC_PAGES[route]?.title, description: STATIC_PAGES[route]?.description, h1: STATIC_PAGES[route]?.h1 }).toEqual({
        route,
        title: config.title,
        description: config.metaDescription,
        h1: config.h1,
      });
    }
  });

  (hasFrontend ? it : it.skip)("classifies every route App.tsx declares, so no real page gets a 404", () => {
    const app = readFileSync(frontendFile("App.tsx"), "utf8");
    const patterns = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
    expect(patterns.length).toBeGreaterThan(100);
    const unknown = patterns
      .map((p) => p.replace(/:([A-Za-z]+)\?/g, "x").replace(/:([A-Za-z]+)/g, "sample-slug"))
      .filter((p) => classifyPath(p).kind === "unknown");
    expect(unknown).toEqual([]);
  });

  it("keeps public profiles indexable but every dashboard private", () => {
    expect(isPrivatePath("/provider/ramesh-shastri")).toBe(false);
    expect(classifyPath("/provider/ramesh-shastri").kind).toBe("entity");
    for (const p of ["/provider/dashboard", "/provider/profile/new", "/vendor", "/vendor/orders", "/restaurant/dashboard", "/pandit/dashboard", "/wallet", "/parking/my-bookings", "/profile", "/admin/hr", "/staff/reception", "/booking/ABC123"]) {
      expect({ p, robots: robotsFor(p) }).toEqual({ p, robots: "noindex,nofollow" });
    }
    expect(isPrivatePath("/restaurants")).toBe(false);
    expect(robotsFor("/search")).toBe("noindex,follow");
    expect(robotsFor("/reset-password/abc")).toBe("noindex,follow");
    expect(robotsFor("/ashrams/haridwar/x/book")).toBe("noindex,follow");
    expect(robotsFor("/temples")).toBe("index,follow");
  });

  it("gives aliases one canonical and never includes query strings", () => {
    expect(canonicalPathFor("/provider/abc")).toBe("/pandit/abc");
    expect(canonicalPathFor("/pilgrimage-circuits/char-dham")).toBe("/circuits/char-dham");
    expect(canonicalPathFor("/destinations/haridwar")).toBe("/destination/haridwar");
    expect(canonicalPathFor("/destinations/planner")).toBe("/destinations/planner");
    expect(canonicalPathFor("/marketplace/product/abc")).toBe("/marketplace/products/abc");
    expect(canonicalPathFor("/Stays-near-prem-mandir-vrindavan")).toBe("/stays-near-prem-mandir-vrindavan");
    expect(canonicalPathFor("/temples//x/")).toBe("/temples/x");
    for (const [alias, target] of Object.entries(CANONICAL_ALIASES)) {
      expect(STATIC_PAGES[target]).toBeDefined();
      expect(classifyPath(alias)).toMatchObject({ kind: "static", canonicalPath: target });
    }
  });

  it("builds titles from real fields only and summarises on word boundaries", () => {
    expect(entitySeo.ashram({ name: "Shanti Kunj", address: { city: "haridwar" } }).title).toBe("Shanti Kunj in Haridwar · Tirvona");
    expect(entitySeo.pandit({ displayName: "Ramesh", providerType: "JYOTISHI", homeCity: "Varanasi" }).title).toBe("Ramesh — Jyotishi in Varanasi · Tirvona");
    expect(entitySeo.temple({ name: "A", seo: { seoTitle: "Editor title" } }).title).toBe("Editor title");
    const long = "word ".repeat(80);
    const s = summarize(long);
    expect(s.length).toBeLessThanOrEqual(160);
    expect(s.endsWith("…")).toBe(true);
    expect(summarize("<p>Hi&nbsp;there</p>")).toBe("Hi there");
  });

  it("titles and descriptions are unique across static pages", () => {
    const titles = Object.values(STATIC_PAGES).map((p) => p.title);
    const descriptions = Object.values(STATIC_PAGES).map((p) => p.description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const p of Object.values(STATIC_PAGES)) {
      expect(p.title.trim()).not.toBe("");
      expect(p.h1.trim()).not.toBe("");
      expect(p.description.length).toBeGreaterThan(40);
    }
  });
});

describe("seo html", () => {
  const shell = `<!doctype html><html lang="en"><head><title>Old</title><meta name="description" content="old" /><link rel="canonical" href="https://www.tirvona.com/" /><meta property="og:title" content="old" /></head><body><div id="root"></div><script type="module" src="/a.js"></script></body></html>`;
  const page = {
    title: `He said "hi" <b>`,
    description: "d & d",
    canonicalUrl: "https://www.tirvona.com/x",
    robots: "index,follow",
    h1: "<img src=x onerror=alert(1)>",
    jsonLd: [{ name: "</script><script>alert(1)</script>", text: "a\u2028b" }],
    sections: [{ heading: "Links", links: [{ label: "ok", path: "/ok" }, { label: "bad", path: "javascript:alert(1)" }, { label: "ext", path: "//evil.com" }] }],
  };

  it("escapes every database value and keeps the entry script", () => {
    const html = renderDocument(shell, page, []);
    expect(html).toContain("<title>He said &quot;hi&quot; &lt;b&gt;</title>");
    expect(html).toContain("<h1>&lt;img src=x onerror=alert(1)&gt;</h1>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("//evil.com");
    expect(html).toContain('href="/ok"');
    expect(html).toContain('<script type="module" src="/a.js"></script>');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/og:title/g)).toHaveLength(1);
    expect(html).not.toContain("content=\"old\"");
  });

  it("serialises JSON-LD that parses back to the same data", () => {
    const json = serializeJsonLd(page.jsonLd[0]);
    expect(json).not.toMatch(/[<>\u2028]/);
    expect(JSON.parse(json)).toEqual(page.jsonLd[0]);
  });

  it("does not treat $ sequences in content as replacement patterns", () => {
    const html = renderDocument(shell, { ...page, h1: "Price $& $1 $$" }, []);
    expect(html).toContain("<h1>Price $&amp; $1 $$</h1>");
  });

  it("accepts only http(s) and site-relative URLs", () => {
    expect(safeUrl("javascript:alert(1)", "https://www.tirvona.com")).toBeUndefined();
    expect(safeUrl("data:text/html,x", "https://www.tirvona.com")).toBeUndefined();
    expect(safeUrl("/logo.png", "https://www.tirvona.com")).toBe("https://www.tirvona.com/logo.png");
    expect(safeUrl("https://res.cloudinary.com/a.jpg", "https://www.tirvona.com")).toBe("https://res.cloudinary.com/a.jpg");
    expect(escapeHtml(`'"<>&`)).toBe("&#39;&quot;&lt;&gt;&amp;");
  });

  it("refuses a shell without an empty #root", () => {
    expect(() => renderDocument("<html><head></head><body></body></html>", page, [])).toThrow();
  });
});
