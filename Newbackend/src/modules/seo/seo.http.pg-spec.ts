/// <reference types="jest" />
/**
 * Server-rendered SEO pages and sitemap.xml end to end: the real SeoController,
 * SitemapController, catalog queries and Postgres storage driver against the
 * throwaway Postgres 17 started by test/pg/global-setup.js — never the hosted
 * database. The frontend shell is the real frontend/index.html copied to a
 * temp file. Run with `npm run test:pg -- seo.http`.
 */
import "reflect-metadata";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Global, Module, ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import helmet from "helmet";
import { OrmModule, getModelToken } from "../../database/orm-nest";
import { DRIVER_URI } from "../../database/database";
import { enablePostgresDriver } from "../../database/pg/pg-driver";
import { REGISTRY } from "../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../database/pg/test-database";
import { environment } from "../../config/environment";
import { TransactionService } from "../../common/database/transaction.service";
import { SitemapController } from "../../common/sitemap.controller";
import { AshramSchema } from "../ashrams/infrastructure/persistence/ashram.schemas";
import { TempleSchema } from "../temples/infrastructure/persistence/temple.schemas";
import { MARKETPLACE_MODELS } from "../marketplace/infrastructure/marketplace.schemas";
import { EventFestivalSchema } from "../events/infrastructure/persistence/event.schemas";
import { PilgrimageCircuitSchema } from "../pilgrimage/infrastructure/persistence/pilgrimage.schemas";
import { CONTENT_MODELS } from "../content/infrastructure/persistence/content.schemas";
import { ProviderProfileSchema } from "../providers/infrastructure/provider.schemas";
import { EVENT_MODEL } from "../events/domain/event.constants";
import { PILGRIMAGE_MODEL } from "../pilgrimage/domain/pilgrimage.constants";
import { AartiSessionSchema } from "../aarti/infrastructure/persistence/aarti-catalogue.schemas";
import { ParkingLocationSchema } from "../parking/infrastructure/persistence/parking-catalogue.schemas";
import { COMMUNITY_MODELS } from "../community/infrastructure/persistence/community.schemas";
import { AARTI_MODEL } from "../aarti/domain/aarti.constants";
import { PARKING_MODEL } from "../parking/domain/parking.constants";
import { SeoModule } from "./seo.module";
import { SeoRenderService } from "./application/seo-render.service";

const SHELL = readFileSync(path.resolve(__dirname, "../../../../frontend/index.html"), "utf8");

/** Text between the first <tag ...> and </tag>. */
const between = (html: string, re: RegExp): string[] => [...html.matchAll(re)].map((m) => m[1]);
const titleOf = (html: string) => between(html, /<title>([\s\S]*?)<\/title>/g);
const canonicalOf = (html: string) => between(html, /<link rel="canonical" href="([^"]+)"/g);
const robotsOf = (html: string) => between(html, /<meta name="robots" content="([^"]+)"/g);
const h1Of = (html: string) => between(html, /<h1>([\s\S]*?)<\/h1>/g);
const jsonLdOf = (html: string) =>
  between(html, /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g).map((s) => JSON.parse(s));

describe("SEO rendering and sitemap (real Postgres)", () => {
  let db: TestDatabase;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const page = (p: string) => http().get("/api/seo/render").set("X-Seo-Path", p);

  beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "seo-shell-"));
    const shellFile = path.join(dir, "index.html");
    writeFileSync(shellFile, SHELL);
    process.env.SEO_SHELL_PATH = shellFile;

    db = await createTestDatabase(REGISTRY.tables);
    enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

    @Global()
    @Module({ providers: [TransactionService], exports: [TransactionService] })
    class TestCommonModule {}

    @Module({
      imports: [
        OrmModule.forFeature([
          { name: "Ashram", schema: AshramSchema },
          { name: "Temple", schema: TempleSchema },
          ...MARKETPLACE_MODELS,
          { name: EVENT_MODEL.Event, schema: EventFestivalSchema },
          { name: PILGRIMAGE_MODEL.Circuit, schema: PilgrimageCircuitSchema },
          ...CONTENT_MODELS,
          { name: "ProviderProfile", schema: ProviderProfileSchema },
          { name: AARTI_MODEL.Session, schema: AartiSessionSchema },
          { name: PARKING_MODEL.Location, schema: ParkingLocationSchema },
          ...COMMUNITY_MODELS.filter((m) => m.name === "VolunteerJob"),
        ]),
      ],
      exports: [OrmModule],
    })
    class ModelsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [environment] }),
        OrmModule.forRoot(DRIVER_URI),
        TestCommonModule,
        ModelsModule,
        SeoModule,
      ],
      controllers: [SitemapController],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same global middleware as main.ts, so header behaviour matches production.
    app.use(helmet());
    app.setGlobalPrefix("api", { exclude: ["robots.txt", "sitemap.xml"] });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    const model = (name: string) => app.get(getModelToken(name));
    // Seed rows carry only the fields SEO reads; schema validation would demand unrelated ones.
    const seed = (name: string, doc: Record<string, unknown>) => new (model(name))(doc).save({ validateBeforeSave: false });
    await seed("Ashram", {
      name: "Shanti Kunj <Ashram>",
      slug: "shanti-kunj",
      citySlug: "haridwar",
      description: "A quiet ashram on the banks of the Ganga with simple rooms & daily satsang.",
      address: { city: "Haridwar", state: "Uttarakhand", coordinates: { type: "Point", coordinates: [78.16, 29.95] } },
      amenities: ["hot_water", "parking"],
      images: ["https://res.cloudinary.com/demo/shanti.jpg"],
      status: "approved",
      ownerId: "64b000000000000000000001",
      documents: [{ secret: "aadhaar-should-never-leak" }],
    });
    await seed("Ashram", {
      name: "Pending Dham",
      slug: "pending-dham",
      citySlug: "haridwar",
      description: "Not yet approved.",
      address: { city: "Haridwar" },
      status: "pending",
    });
    await seed("Ashram", {
      name: "Ganga Niwas",
      slug: "ganga-niwas",
      citySlug: "haridwar",
      description: "Rooms near the ghats.",
      address: { city: "Haridwar" },
      status: "approved",
    });
    await seed("Temple", {
      name: "Har Ki Pauri",
      slug: "har-ki-pauri",
      shortDescription: "The most sacred ghat in Haridwar.",
      description: "Evening Ganga aarti is held every day.",
      address: { city: "Haridwar", state: "Uttarakhand" },
      status: "published",
      seo: { canonicalUrl: "https://evil.example.com/steal" },
      timings: [{ dayOfWeek: "Monday", timeSlots: [{ title: "Aarti", startTime: "18:00", endTime: "19:00" }] }],
    });
    await seed("Temple", { name: "Draft Mandir", slug: "draft-mandir", status: "draft" });
    await seed(EVENT_MODEL.Event, {
      name: "Kartik Purnima Snan",
      slug: "kartik-purnima-snan",
      description: "Holy dip at the ghats.",
      venue: { name: "Har Ki Pauri", city: "Haridwar", state: "Uttarakhand" },
      startDate: "2026-11-24",
      endDate: "2026-11-24",
      status: "approved",
      viewCount: 7,
    });
    await seed(PILGRIMAGE_MODEL.Circuit, {
      name: "Char Dham Yatra",
      slug: "char-dham-yatra",
      summary: "Yamunotri, Gangotri, Kedarnath and Badrinath.",
      durationDays: 10,
      status: "approved",
      viewCount: 3,
    });
    await seed("BlogPost", {
      title: "How to plan a Kumbh visit",
      slug: "plan-kumbh-visit",
      excerpt: "Dates, stays and safety tips for Kumbh.",
      content: "<p>Plan early.</p><script>alert(1)</script>",
      status: "published",
      views: 10,
    });
    await seed("BlogPost", { title: "Draft post", slug: "draft-post", status: "draft" });
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
    delete process.env.SEO_SHELL_PATH;
  });

  it("renders a stay with its own title, canonical, single H1, escaped content and LodgingBusiness JSON-LD", async () => {
    const res = await page("/ashrams/haridwar/shanti-kunj").expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    const html = res.text;
    expect(titleOf(html)).toEqual(["Shanti Kunj &lt;Ashram&gt; in Haridwar · Tirvona"]);
    expect(canonicalOf(html)).toEqual(["https://www.tirvona.com/ashrams/haridwar/shanti-kunj"]);
    expect(robotsOf(html)).toEqual(["index,follow"]);
    expect(h1Of(html)).toEqual(["Shanti Kunj &lt;Ashram&gt;"]);
    expect(html).not.toContain("<Ashram>");
    expect(html).toContain("daily satsang");
    expect(html).toContain("Hot Water");
    // The shell's homepage tags are replaced, not duplicated.
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/name="description"/g)).toHaveLength(1);
    // The Vite entry script is kept so React still mounts.
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    const [ld] = jsonLdOf(html);
    expect(ld[0]["@type"]).toBe("LodgingBusiness");
    expect(ld[0].geo).toEqual({ "@type": "GeoCoordinates", longitude: 78.16, latitude: 29.95 });
    expect(ld[1]["@type"]).toBe("BreadcrumbList");
    // Private fields never reach page source.
    expect(html).not.toContain("aadhaar-should-never-leak");
    expect(html).not.toContain("64b000000000000000000001");
  });

  it("sends the page without helmet's API headers, which would block gtag, the API and payments", async () => {
    for (const p of ["/", "/ashrams/haridwar/shanti-kunj", "/about/nonsense", "/profile"]) {
      const res = await page(p);
      for (const header of ["content-security-policy", "cross-origin-opener-policy", "referrer-policy", "strict-transport-security", "x-frame-options"]) {
        expect({ p, header, value: res.headers[header] }).toEqual({ p, header, value: undefined });
      }
    }
    // JSON API routes keep helmet's protection.
    const api = await http().post("/api/seo/cache/invalidate").send({});
    expect(api.headers["content-security-policy"]).toContain("default-src 'self'");
  });

  it("covers home, marketplace, destination, food and pandit templates, and retired URLs", async () => {
    const model = (name: string) => app.get(getModelToken(name));
    const save = (name: string, doc: Record<string, unknown>) => new (model(name))(doc).save({ validateBeforeSave: false });
    const store = await save("MpVendor", { storeName: "Braj Crafts", slug: "braj-crafts", userId: "64b0000000000000000000a1", status: "active", address: { city: "Vrindavan" } });
    await save("MpVendor", { storeName: "Empty Shop", slug: "empty-shop", userId: "64b0000000000000000000a2", status: "active" });
    const cat = await save("MpCategory", { name: "Puja Items", slug: "puja-items-cat", scope: "vendor_marketplace", status: "active" });
    await save("MpProduct", {
      name: "Brass Diya", slug: "brass-diya", description: "Hand-made brass diya.", price: 499, stock: 5,
      status: "active", approvalStatus: "approved", listingStatus: "active", vendorId: store._id, categoryId: cat._id,
    });
    await save("MpProduct", { name: "Hidden Lamp", slug: "hidden-lamp", status: "active", approvalStatus: "pending", listingStatus: "active", vendorId: store._id });

    // Home keeps the shell's verification tags and analytics exactly once.
    const home = (await page("/").expect(200)).text;
    expect(canonicalOf(home)).toEqual(["https://www.tirvona.com/"]);
    expect(h1Of(home)).toHaveLength(1);
    expect(jsonLdOf(home)[0].map((x: any) => x["@type"])).toEqual(expect.arrayContaining(["Organization", "WebSite"]));
    expect(home.match(/gtag\('config', 'G-5S7XM8N389'/g)).toHaveLength(1);
    expect(home.match(/gtag\('config', 'AW-18454245978', \{ send_page_view: false \}\)/g)).toHaveLength(1);

    const product = (await page("/marketplace/products/brass-diya").expect(200)).text;
    expect(canonicalOf(product)).toEqual(["https://www.tirvona.com/marketplace/products/brass-diya"]);
    expect(h1Of(product)).toEqual(["Brass Diya"]);
    expect(jsonLdOf(product)[0][0]["@type"]).toBe("Product");
    await page("/marketplace/products/hidden-lamp").expect(404);
    expect((await page("/marketplace/product/brass-diya").expect(301)).headers.location).toBe("/marketplace/products/brass-diya");

    const category = (await page("/marketplace/category/puja-items-cat").expect(200)).text;
    expect(robotsOf(category)).toEqual(["index,follow"]);
    expect(category).toContain('href="/marketplace/products/brass-diya"');
    expect(category).not.toContain("hidden-lamp");
    expect(robotsOf((await page("/marketplace/store/braj-crafts").expect(200)).text)).toEqual(["index,follow"]);
    // A store with nothing to sell is reachable but kept out of the index.
    expect(robotsOf((await page("/marketplace/store/empty-shop").expect(200)).text)).toEqual(["noindex,follow"]);

    const destination = (await page("/destination/haridwar").expect(200)).text;
    expect(canonicalOf(destination)).toEqual(["https://www.tirvona.com/destination/haridwar"]);
    expect(destination).toContain('href="/ashrams/haridwar/shanti-kunj"');
    // An alias: rendered, with one canonical.
    expect(canonicalOf((await page("/destinations/haridwar").expect(200)).text)).toEqual(["https://www.tirvona.com/destination/haridwar"]);
    await page("/destination/atlantis").expect(404);

    for (const hub of ["/food", "/pandits", "/marketplace", "/temples", "/events", "/circuits", "/pilgrimage-circuits", "/blog"]) {
      const res = await page(hub);
      expect({ hub, status: res.status }).toEqual({ hub, status: res.status === 301 ? 301 : 200 });
      if (res.status === 200) expect({ hub, h1: h1Of(res.text).length }).toEqual({ hub, h1: 1 });
    }
    expect(canonicalOf((await page("/restaurants").expect(200)).text)).toEqual(["https://www.tirvona.com/food"]);
    await page("/pandit/no-such-pandit").expect(404);
    expect(canonicalOf((await page("/pandit").expect(200)).text)).toEqual(["https://www.tirvona.com/pandits"]);

    // Internal links between a stay, the temples in its city and the destination page.
    const stay = (await page("/ashrams/haridwar/shanti-kunj").expect(200)).text;
    expect(stay).toContain('href="/temples/har-ki-pauri"');
    expect(stay).toContain('href="/destination/haridwar"');
    expect(stay).not.toContain("draft-mandir");
    const temple = (await page("/temples/har-ki-pauri").expect(200)).text;
    expect(temple).toContain('href="/ashrams/haridwar/shanti-kunj"');
    expect(temple).not.toContain("pending-dham");
    expect(between(temple, /<h2>([\s\S]*?)<\/h2>/g)).toContain("Stays in Haridwar");
    // Section headings describe their section instead of repeating a generic word or the H1.
    expect(between((await page("/ashrams/haridwar").expect(200)).text, /<h2>([\s\S]*?)<\/h2>/g)).toEqual(["Properties in Haridwar"]);
    expect(between(product, /<h2>([\s\S]*?)<\/h2>/g)).toEqual(["Description", "Details", "Store and category"]);

    // Retired / moved URLs.
    expect((await page("/Stays-near-prem-mandir-vrindavan").expect(301)).headers.location).toBe("/stays-near-prem-mandir-vrindavan");
    expect((await page("/temples/").expect(301)).headers.location).toBe("/temples");
  });

  it("gives every public template one H1 and a clean H2/H3 outline in the initial HTML", async () => {
    const paths = [
      "/", "/ashrams", "/ashrams/haridwar", "/ashrams/haridwar/shanti-kunj", "/temples", "/temples/har-ki-pauri",
      "/pandits", "/marketplace", "/marketplace/categories", "/marketplace/products/brass-diya", "/marketplace/category/puja-items-cat",
      "/marketplace/store/braj-crafts", "/food", "/events", "/events/kartik-purnima-snan", "/circuits", "/circuits/char-dham-yatra",
      "/destination/haridwar", "/blog", "/blog/plan-kumbh-visit", "/ashrams/vrindavan", "/stays-near-banke-bihari-vrindavan",
      "/stays-near-prem-mandir-vrindavan", "/stays-near-iskcon-vrindavan", "/budget-stays-in-vrindavan", "/family-stays-in-vrindavan",
      "/about", "/faq", "/contact", "/parking", "/aarti", "/services", "/offers", "/terms", "/privacy",
    ];
    for (const p of paths) {
      const res = await page(p);
      if (res.status !== 200) continue; // records seeded only by the template test above
      const body = res.text.split('<div id="root">')[1] ?? "";
      const headings = [...body.matchAll(/<h([1-6])>([\s\S]*?)<\/h\1>/g)].map((m) => ({ level: Number(m[1]), text: m[2].trim() }));
      const h1s = headings.filter((h) => h.level === 1);
      expect({ p, h1: h1s.length, nonEmpty: h1s.every((h) => h.text.length > 0) }).toEqual({ p, h1: 1, nonEmpty: true });
      expect({ p, first: headings[0]?.level }).toEqual({ p, first: 1 });
      expect({ p, empty: headings.filter((h) => !h.text).length }).toEqual({ p, empty: 0 });
      const jumps = headings.filter((h, i) => i > 0 && h.level > headings[i - 1].level + 1);
      expect({ p, jumps }).toEqual({ p, jumps: [] });
      // An H2 never repeats the H1 word for word.
      expect({ p, dup: headings.filter((h) => h.level === 2 && h.text === h1s[0].text) }).toEqual({ p, dup: [] });
    }
  });

  it("renders aarti, parking, volunteer job and video pages and lists them in the sitemap", async () => {
    const model = (name: string) => app.get(getModelToken(name));
    const save = (name: string, doc: Record<string, unknown>) => new (model(name))(doc).save({ validateBeforeSave: false });
    await save(AARTI_MODEL.Session, {
      name: "Ganga Aarti", slug: "ganga-aarti", deity: "Ganga", description: "Evening aarti on the ghat.",
      venue: { name: "Har Ki Pauri", city: "Haridwar", state: "Uttarakhand" }, startTime: "18:30", durationMinutes: 45,
      daysOfWeek: [0, 6], status: "approved",
    });
    await save(AARTI_MODEL.Session, { name: "Draft Aarti", slug: "draft-aarti", status: "pending" });
    await save(PARKING_MODEL.Location, {
      name: "Har Ki Pauri Parking", slug: "har-ki-pauri-parking", description: "Covered parking 300 m from the ghat.",
      address: { line1: "Upper Road", city: "Haridwar", state: "Uttarakhand" }, latitude: 29.95, longitude: 78.16, status: "active",
    });
    await save(PARKING_MODEL.Location, { name: "Closed Lot", slug: "closed-lot", status: "inactive" });
    const job = await save("VolunteerJob", {
      title: "Kitchen Seva Volunteer", ashramName: "Shanti Kunj", city: "haridwar", state: "uttarakhand", type: "volunteer",
      responsibilities: ["Help cook the community meal", "Serve prasad"], accommodation: true, food: true, status: "open",
    });
    const closed = await save("VolunteerJob", { title: "Old Role", ashramName: "Shanti Kunj", city: "haridwar", status: "closed" });
    await save("BlogPost", { title: "Ganga Aarti Explained", slug: "ganga-aarti-video", excerpt: "A short film.", contentType: "video", status: "published" });

    const aarti = (await page("/aarti/ganga-aarti").expect(200)).text;
    expect(titleOf(aarti)).toEqual(["Ganga Aarti at Har Ki Pauri, Haridwar · Tirvona"]);
    expect(canonicalOf(aarti)).toEqual(["https://www.tirvona.com/aarti/ganga-aarti"]);
    expect(h1Of(aarti)).toEqual(["Ganga Aarti"]);
    expect(aarti).toContain("Sunday, Saturday");
    await page("/aarti/draft-aarti").expect(404);

    const parking = (await page("/parking/har-ki-pauri-parking").expect(200)).text;
    expect(h1Of(parking)).toEqual(["Har Ki Pauri Parking"]);
    const parkingLd = jsonLdOf(parking)[0];
    expect(parkingLd[0]["@type"]).toBe("ParkingFacility");
    expect(parkingLd[0].geo).toEqual({ "@type": "GeoCoordinates", latitude: 29.95, longitude: 78.16 });
    await page("/parking/closed-lot").expect(404);
    // Private parking screens are still private, not entity pages.
    expect(robotsOf((await page("/parking/my-bookings").expect(200)).text)).toEqual(["noindex,nofollow"]);

    const jobPath = `/volunteer/${job._id}`;
    const jobHtml = (await page(jobPath).expect(200)).text;
    expect(h1Of(jobHtml)).toEqual(["Kitchen Seva Volunteer"]);
    expect(jobHtml).toContain("Help cook the community meal. Serve prasad.");
    const jobLd = jsonLdOf(jobHtml)[0][0];
    expect(jobLd).toMatchObject({ "@type": "JobPosting", employmentType: "VOLUNTEER", hiringOrganization: { name: "Shanti Kunj" } });
    expect((await page(`/volunteer/job/${job._id}`).expect(301)).headers.location).toBe(jobPath);
    await page(`/volunteer/${closed._id}`).expect(404);

    const video = (await page("/video/ganga-aarti-video").expect(200)).text;
    expect(canonicalOf(video)).toEqual(["https://www.tirvona.com/video/ganga-aarti-video"]);
    expect((await page("/blog/ganga-aarti-video").expect(301)).headers.location).toBe("/video/ganga-aarti-video");
    expect((await page("/video/plan-kumbh-visit").expect(301)).headers.location).toBe("/blog/plan-kumbh-visit");

    // Hubs are cached for 5 minutes; an earlier test rendered /aarti before these rows existed.
    app.get(SeoRenderService).invalidate(["/aarti"]);
    const hub = (await page("/aarti").expect(200)).text;
    expect(hub).toContain('href="/aarti/ganga-aarti"');
    expect(hub).not.toContain("draft-aarti");

    const xml = (await http().get("/sitemap.xml").expect(200)).text;
    const locs = between(xml, /<loc>([^<]+)<\/loc>/g);
    for (const p of ["/aarti/ganga-aarti", "/parking/har-ki-pauri-parking", jobPath, "/video/ganga-aarti-video"]) expect(locs).toContain(`https://www.tirvona.com${p}`);
    for (const p of ["/aarti/draft-aarti", "/parking/closed-lot", `/volunteer/${closed._id}`, "/blog/ganga-aarti-video"]) expect(locs).not.toContain(`https://www.tirvona.com${p}`);
  });

  it("publishes no geo for a stay still on the schema default pin", async () => {
    const html = (await page("/ashrams/haridwar/ganga-niwas").expect(200)).text;
    expect(jsonLdOf(html)[0][0].geo).toBeUndefined();
    expect(html).not.toContain("28.613");
  });

  it("returns real 404s for missing and unapproved records, and for unknown paths", async () => {
    for (const p of ["/ashrams/haridwar/pending-dham", "/ashrams/haridwar/nope", "/temples/draft-mandir", "/blog/draft-post", "/about/nonsense", "/events/missing"]) {
      const res = await page(p);
      expect({ p, status: res.status }).toEqual({ p, status: 404 });
      expect(robotsOf(res.text)).toEqual(["noindex,follow"]);
      expect(res.headers["x-robots-tag"]).toBe("noindex,follow");
      expect(res.text).not.toContain("Pending Dham");
    }
  });

  it("301s legacy and non-canonical URLs, keeping the query string", async () => {
    const ashram = await app.get(getModelToken("Ashram")).findOne({ slug: "shanti-kunj" }).lean();
    await page(`/ashram/${ashram._id}?utm_source=x`)
      .expect(301)
      .expect("Location", "/ashrams/haridwar/shanti-kunj?utm_source=x");
    await page("/ashrams/rishikesh/shanti-kunj").expect(301).expect("Location", "/ashrams/haridwar/shanti-kunj");
    await page("/Stays-near-prem-mandir-vrindavan").expect(301).expect("Location", "/stays-near-prem-mandir-vrindavan");
    await page("/temples/").expect(301).expect("Location", "/temples");
    await page("/events/Kartik-Purnima-Snan").expect(301).expect("Location", "/events/kartik-purnima-snan");
  });

  it("ignores an off-site canonical stored on a temple and mirrors the client JSON-LD id", async () => {
    const html = (await page("/temples/har-ki-pauri").expect(200)).text;
    expect(canonicalOf(html)).toEqual(["https://www.tirvona.com/temples/har-ki-pauri"]);
    expect(html).not.toContain("evil.example.com");
    expect(html).toContain('id="temple-jsonld"');
    expect(h1Of(html)).toEqual(["Har Ki Pauri"]);
    expect(html).toContain("Monday: Aarti 18:00–19:00");
    const [ld] = jsonLdOf(html);
    expect(ld[0]["@type"]).toEqual(["PlaceOfWorship", "TouristAttraction"]);
  });

  it("renders events, circuits and blog posts without counting a view", async () => {
    const event = await page("/events/kartik-purnima-snan").expect(200);
    expect(titleOf(event.text)).toEqual(["Kartik Purnima Snan in Haridwar · Tirvona"]);
    expect(jsonLdOf(event.text)[0][0]).toMatchObject({ "@type": "Event", startDate: "2026-11-24T00:00:00.000Z" });

    const circuit = await page("/pilgrimage-circuits/char-dham-yatra").expect(200);
    // The alias renders, but declares /circuits/:slug canonical.
    expect(canonicalOf(circuit.text)).toEqual(["https://www.tirvona.com/circuits/char-dham-yatra"]);

    const blog = await page("/blog/plan-kumbh-visit").expect(200);
    expect(blog.text).not.toContain("<script>alert(1)</script>");
    expect(jsonLdOf(blog.text)[0][0]["@type"]).toBe("BlogPosting");

    const model = (name: string) => app.get(getModelToken(name));
    expect((await model(EVENT_MODEL.Event).findOne({ slug: "kartik-purnima-snan" }).lean()).viewCount).toBe(7);
    expect((await model(PILGRIMAGE_MODEL.Circuit).findOne({ slug: "char-dham-yatra" }).lean()).viewCount).toBe(3);
    expect((await model("BlogPost").findOne({ slug: "plan-kumbh-visit" }).lean()).views).toBe(10);
  });

  it("lists only public records on hub pages and gives aliases one canonical", async () => {
    const hub = (await page("/ashrams").expect(200)).text;
    expect(hub).toContain('href="/ashrams/haridwar/shanti-kunj"');
    expect(hub).not.toContain("pending-dham");
    expect(h1Of(hub)).toHaveLength(1);

    const alias = (await page("/stays").expect(200)).text;
    expect(canonicalOf(alias)).toEqual(["https://www.tirvona.com/ashrams"]);

    const city = (await page("/ashrams/haridwar").expect(200)).text;
    expect(titleOf(city)).toEqual(["Stays in Haridwar · Tirvona"]);
    await page("/ashrams/atlantis").expect(404);

    const home = (await page("/").expect(200)).text;
    const types = jsonLdOf(home)[0].map((x: any) => x["@type"]);
    expect(types).toEqual(["Organization", "WebSite"]);
  });

  it("marks private and utility pages noindex and never caches private ones publicly", async () => {
    const dash = await page("/profile/bookings").expect(200);
    expect(robotsOf(dash.text)).toEqual(["noindex,nofollow"]);
    expect(dash.headers["cache-control"]).toBe("private, no-store");
    for (const p of ["/provider/dashboard", "/vendor/orders", "/restaurant/dashboard", "/pandit/dashboard", "/wallet", "/parking/my-bookings"]) {
      expect(robotsOf((await page(p).expect(200)).text)).toEqual(["noindex,nofollow"]);
    }
    const login = await page("/login").expect(200);
    expect(robotsOf(login.text)).toEqual(["noindex,follow"]);
    const book = await page("/ashrams/haridwar/shanti-kunj/book").expect(200);
    expect(robotsOf(book.text)).toEqual(["noindex,follow"]);
  });

  it("rejects malformed paths and falls back with 503 when the shell is missing", async () => {
    await http().get("/api/seo/render").set("X-Seo-Path", "//evil.com").expect(400);
    await http().get("/api/seo/render").set("X-Seo-Path", "/a\\b").expect(400);
    await http().get("/api/seo/render").set("X-Seo-Path", "no-slash").expect(400);
    const renderer = app.get(SeoRenderService);
    const saved = process.env.SEO_SHELL_PATH;
    process.env.SEO_SHELL_PATH = path.join(tmpdir(), "does-not-exist", "index.html");
    (renderer as any).shell = null;
    renderer.invalidate();
    await page("/about").expect(503);
    process.env.SEO_SHELL_PATH = saved;
    (renderer as any).shell = null;
    await page("/about").expect(200);
  });

  it("keeps the invalidation endpoint closed to anonymous callers", async () => {
    // No auth guard is installed in this harness, so assert the role metadata instead of a 401.
    const { SeoController } = await import("./presentation/seo.controller");
    const roles = Reflect.getMetadata("roles", SeoController.prototype.invalidate);
    expect(roles).toEqual(["super_admin"]);
  });

  it("serves one sitemap of canonical, indexable URLs with real lastmod values", async () => {
    const res = await http().get("/sitemap.xml").expect(200);
    expect(res.headers["content-type"]).toMatch(/application\/xml/);
    const xml = res.text;
    const locs = between(xml, /<loc>([^<]+)<\/loc>/g);
    expect(new Set(locs).size).toBe(locs.length);
    expect(locs).toContain("https://www.tirvona.com/ashrams/haridwar/shanti-kunj");
    expect(locs).toContain("https://www.tirvona.com/ashrams/haridwar");
    expect(locs).toContain("https://www.tirvona.com/temples/har-ki-pauri");
    expect(locs).toContain("https://www.tirvona.com/events/kartik-purnima-snan");
    expect(locs).toContain("https://www.tirvona.com/circuits/char-dham-yatra");
    expect(locs).toContain("https://www.tirvona.com/blog/plan-kumbh-visit");
    expect(locs).toContain("https://www.tirvona.com/stays-near-prem-mandir-vrindavan");
    for (const banned of ["pending-dham", "draft-mandir", "draft-post", "/Stays-near", "/stays-in-vrindavan", "/login", "/profile", "/shanti-kunj/book", "/pilgrimage-circuits/"]) {
      expect(locs.filter((l) => l.includes(banned))).toEqual([]);
    }
    // Static pages carry no invented lastmod; records carry their own updatedAt.
    expect(xml).toMatch(/<loc>https:\/\/www\.tirvona\.com\/about<\/loc>\n {2}<\/url>/);
    expect(xml).toMatch(/<loc>https:\/\/www\.tirvona\.com\/blog\/plan-kumbh-visit<\/loc>\n {4}<lastmod>\d{4}-\d{2}-\d{2}T/);
  });
});
