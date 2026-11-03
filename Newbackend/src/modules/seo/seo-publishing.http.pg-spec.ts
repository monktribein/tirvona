/// <reference types="jest" />
/**
 * SEO publishing end to end: the real SeoPublishingController/Service, migration-shaped
 * seo_pages table, renderer, public meta lookup and sitemap, on the throwaway Postgres 17
 * started by test/pg/global-setup.js — never the hosted database. Users are passed in an
 * x-test-user header (as in the HR harness); the service does every permission check.
 * Run with `npm run test:pg -- seo-publishing`.
 */
import "reflect-metadata";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  Global,
  Injectable,
  Module,
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { OrmModule, getModelToken } from "../../database/orm-nest";
import { DRIVER_URI } from "../../database/database";
import { enablePostgresDriver } from "../../database/pg/pg-driver";
import { REGISTRY } from "../../database/pg/registry.generated";
import { createTestDatabase, type TestDatabase } from "../../database/pg/test-database";
import { environment } from "../../config/environment";
import { TransactionService } from "../../common/database/transaction.service";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { SitemapController } from "../../common/sitemap.controller";
import { AshramSchema } from "../ashrams/infrastructure/persistence/ashram.schemas";
import { TempleSchema } from "../temples/infrastructure/persistence/temple.schemas";
import { SeoModule } from "./seo.module";

const SHELL = readFileSync(path.resolve(__dirname, "../../../../frontend/index.html"), "utf8");
const between = (html: string, re: RegExp): string[] => [...html.matchAll(re)].map((m) => m[1]);
const titleOf = (html: string) => between(html, /<title>([\s\S]*?)<\/title>/g)[0];
const descriptionOf = (html: string) => between(html, /<meta name="description" content="([^"]*)"/g)[0];
const robotsOf = (html: string) => between(html, /<meta name="robots" content="([^"]+)"/g)[0];
const h1Of = (html: string) => between(html, /<h1>([\s\S]*?)<\/h1>/g);
const editorialJsonLdOf = (html: string) =>
  between(html, /<script type="application\/ld\+json" data-seo-ssr="true" data-seo-editorial="true">([\s\S]*?)<\/script>/g).map((s) => JSON.parse(s));

@Injectable()
class TestAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const header = req.headers["x-test-user"];
    if (!header) throw new UnauthorizedException("Authentication required");
    req.user = JSON.parse(String(header));
    return true;
  }
}

const user = (n: number, role: string, permissions: string[] = []) => ({
  id: `64b0000000000000000000${String(n).padStart(2, "0")}`,
  _id: `64b0000000000000000000${String(n).padStart(2, "0")}`,
  role,
  permissions,
});
const ADMIN = user(1, "super_admin");
const WRITER = user(2, "content_manager", ["seo.pages.edit"]);
const CHECKER = user(3, "content_manager", ["seo.pages.verify"]);
const LEAD = user(4, "content_manager", ["seo.pages.approve", "seo.pages.publish", "seo.pages.retire"]);
const SOLO = user(5, "content_manager", ["seo.pages.edit", "seo.pages.verify", "seo.pages.approve"]);
const NOBODY = user(6, "customer");

const FAQ = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [{ "@type": "Question", name: "When is the evening aarti?", acceptedAnswer: { "@type": "Answer", text: "Around sunset every day." } }],
};

describe("SEO publishing workflow (real Postgres)", () => {
  let db: TestDatabase;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const as = (u: object) => ({ "x-test-user": JSON.stringify(u) });
  const render = (p: string) => http().get("/api/seo/render").set("X-Seo-Path", p);
  const create = (u: object, body: object) => http().post("/api/seo/pages").set(as(u)).send(body);
  const act = (u: object, id: string, action: string, body: object) => http().post(`/api/seo/pages/${id}/${action}`).set(as(u)).send(body);
  const sitemapLocs = async () => between((await http().get("/sitemap.xml").expect(200)).text, /<loc>([^<]+)<\/loc>/g);

  /** Runs a page through review and publication with separate people, returning the published row. */
  const publishAs = async (id: string, version: number) => {
    let v = version;
    v = (await act(WRITER, id, "submit", { version: v }).expect(201)).body.data.page.version;
    v = (await act(CHECKER, id, "verify", { version: v }).expect(201)).body.data.page.version;
    v = (await act(LEAD, id, "approve", { version: v }).expect(201)).body.data.page.version;
    return (await act(LEAD, id, "publish", { version: v }).expect(201)).body.data.page;
  };

  beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "seo-pub-shell-"));
    const shellFile = path.join(dir, "index.html");
    writeFileSync(shellFile, SHELL);
    process.env.SEO_SHELL_PATH = shellFile;

    db = await createTestDatabase(REGISTRY.tables);
    enablePostgresDriver({ pool: db.pool, registry: REGISTRY, ttlSweep: false });

    @Global()
    @Module({ providers: [TransactionService], exports: [TransactionService] })
    class TestCommonModule {}

    @Module({
      imports: [OrmModule.forFeature([{ name: "Ashram", schema: AshramSchema }, { name: "Temple", schema: TempleSchema }])],
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
      providers: [{ provide: APP_GUARD, useClass: TestAuthGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["robots.txt", "sitemap.xml"] });
    // Same pipe as main.ts.
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, stopAtFirstError: false }));
    await app.init();

    const seed = (name: string, doc: Record<string, unknown>) => new (app.get(getModelToken(name)))(doc).save({ validateBeforeSave: false });
    const temple = (slug: string, name: string, status = "published") =>
      seed("Temple", { name, slug, shortDescription: `${name} in Haridwar.`, address: { city: "Haridwar", state: "Uttarakhand" }, status });
    await temple("har-ki-pauri", "Har Ki Pauri");
    await temple("mansa-devi", "Mansa Devi");
    await temple("chandi-devi", "Chandi Devi");
    await temple("maya-devi", "Maya Devi");
    await temple("bharat-mata", "Bharat Mata Mandir");
    await temple("draft-mandir", "Draft Mandir", "draft");
  });

  afterAll(async () => {
    await app?.close();
    await db?.drop();
    delete process.env.SEO_SHELL_PATH;
  });

  it("is closed to anonymous callers and to users without an SEO permission", async () => {
    await http().get("/api/seo/pages").expect(401);
    await http().get("/api/seo/pages").set(as(NOBODY)).expect(403);
    await create(NOBODY, { path: "/temples/har-ki-pauri" }).expect(403);
    // A verifier can read the queue but cannot create.
    await http().get("/api/seo/pages").set(as(CHECKER)).expect(200);
    await create(CHECKER, { path: "/temples/har-ki-pauri" }).expect(403);
  });

  it("creates drafts only for public, canonical, indexable pages, with clean text", async () => {
    for (const [p, why] of [
      ["/temples/draft-mandir", /no public temple/i],
      ["/temples/nope", /no public temple/i],
      ["/login", /not a public page/i],
      ["/Temples/har-ki-pauri", /lowercase/i],
      ["/temples/har-ki-pauri/", /lowercase/i],
    ] as const) {
      const res = await create(WRITER, { path: p }).expect(400);
      expect(JSON.stringify(res.body)).toMatch(why);
    }
    await create(WRITER, { path: "/temples/har-ki-pauri", seoTitle: "Har Ki Pauri <b>ghat</b>" }).expect(400);
    await create(WRITER, { path: "/temples/har-ki-pauri", seoTitle: "x".repeat(71) }).expect(400);
    await create(WRITER, { path: "/temples/har-ki-pauri", schemaJson: { ...FAQ, aggregateRating: { ratingValue: 5 } } }).expect(400);
    await create(WRITER, { path: "/temples/har-ki-pauri", schemaJson: { "@type": "Product", name: "x" } }).expect(400);
    await create(WRITER, { path: "/temples/har-ki-pauri", contentJson: { intro: "Hello" } }).expect(400);
    await create(WRITER, { path: "/temples/har-ki-pauri", unknownField: 1 }).expect(400);

    const res = await create(WRITER, {
      path: "/temples/har-ki-pauri",
      seoTitle: "Har Ki Pauri Haridwar: Ganga Aarti Timings & Guide",
      metaDescription: "Evening Ganga aarti timings at Har Ki Pauri, how to reach the ghat, where to stand and nearby stays in Haridwar.",
      h1: "Har Ki Pauri, Haridwar",
      schemaJson: FAQ,
    }).expect(201);
    const page = res.body.data.page;
    expect(page).toMatchObject({
      pageType: "temple",
      slug: "har-ki-pauri",
      canonicalUrl: "https://www.tirvona.com/temples/har-ki-pauri",
      publicationStatus: "draft",
      indexingStatus: "index",
      version: 1,
      createdBy: WRITER.id,
    });
    expect(page.entityId).toMatch(/^[a-f0-9]{24}$/);
    await create(WRITER, { path: "/temples/har-ki-pauri" }).expect(409);

    // A fixed page can be marked as a landing page; its copy is allowed there.
    const landing = await create(WRITER, { path: "/stays-near-prem-mandir-vrindavan", pageType: "landing", contentJson: { intro: "Stays close to Prem Mandir.", faq: [{ question: "Is parking available?", answer: "At most stays, yes." }] } }).expect(201);
    expect(landing.body.data.page).toMatchObject({ pageType: "landing", entityId: null });
    await create(WRITER, { path: "/about", contentJson: { intro: "x", script: "y" } }).expect(400);
  });

  it("keeps drafts invisible: the public page and meta lookup are unchanged", async () => {
    const html = (await render("/temples/har-ki-pauri").expect(200)).text;
    expect(titleOf(html)).not.toContain("Ganga Aarti Timings");
    expect(editorialJsonLdOf(html)).toEqual([]);
    await http().get("/api/seo/meta").query({ path: "/temples/har-ki-pauri" }).expect(404);
  });

  it("runs four-eyes review: writer submits, checker verifies, lead approves and publishes", async () => {
    const list = (await http().get("/api/seo/pages").set(as(WRITER)).expect(200)).body.data;
    const row = list.rows.find((r: any) => r.path === "/temples/har-ki-pauri");
    expect(list.capabilities).toEqual({ edit: true, verify: false, approve: false, publish: false, retire: false });

    await act(CHECKER, row.id, "approve", { version: 1 }).expect(403);
    const submitted = (await act(WRITER, row.id, "submit", { version: 1 }).expect(201)).body.data.page;
    expect(submitted).toMatchObject({ publicationStatus: "in_review", version: 2 });
    await act(WRITER, row.id, "verify", { version: 2 }).expect(403);
    const early = await act(LEAD, row.id, "approve", { version: 2 }).expect(400);
    expect(JSON.stringify(early.body)).toMatch(/verify the facts/i);
    const verified = (await act(CHECKER, row.id, "verify", { version: 2 }).expect(201)).body.data.page;
    expect(verified).toMatchObject({ verifiedBy: CHECKER.id, version: 3 });
    const approved = (await act(LEAD, row.id, "approve", { version: 3 }).expect(201)).body.data.page;
    expect(approved).toMatchObject({ publicationStatus: "approved", approvedBy: LEAD.id });
    await act(LEAD, row.id, "publish", { version: 3 }).expect(409); // stale version
    const published = (await act(LEAD, row.id, "publish", { version: 4 }).expect(201)).body.data.page;
    expect(published).toMatchObject({ publicationStatus: "published", version: 5 });
    expect(published.publishedAt).toBeTruthy();

    const html = (await render("/temples/har-ki-pauri").expect(200)).text;
    expect(titleOf(html)).toBe("Har Ki Pauri Haridwar: Ganga Aarti Timings &amp; Guide");
    expect(descriptionOf(html)).toContain("Evening Ganga aarti timings");
    expect(h1Of(html)).toEqual(["Har Ki Pauri, Haridwar"]);
    expect(robotsOf(html)).toBe("index,follow");
    expect(editorialJsonLdOf(html)).toEqual([FAQ]);

    const meta = (await http().get("/api/seo/meta").query({ path: "/temples/har-ki-pauri" }).expect(200)).body.data;
    expect(meta).toEqual({
      path: "/temples/har-ki-pauri",
      canonicalUrl: "https://www.tirvona.com/temples/har-ki-pauri",
      title: "Har Ki Pauri Haridwar: Ganga Aarti Timings & Guide",
      description: expect.stringContaining("Evening Ganga aarti"),
      h1: "Har Ki Pauri, Haridwar",
      robots: "index,follow",
      schema: FAQ,
    });
    expect(JSON.stringify(meta)).not.toMatch(/verifiedBy|approvedBy|pending|createdBy/);
  });

  it("stops the last editor from verifying or approving, but lets a super admin run every step", async () => {
    const draft = (await create(SOLO, { path: "/temples/mansa-devi", seoTitle: "Mansa Devi Temple Haridwar: Ropeway, Timings and Tips" }).expect(201)).body.data.page;
    await act(SOLO, draft.id, "submit", { version: 1 }).expect(201);
    const blocked = await act(SOLO, draft.id, "verify", { version: 2 }).expect(403);
    expect(JSON.stringify(blocked.body)).toMatch(/someone else/i);

    const own = (await create(ADMIN, { path: "/temples/chandi-devi", h1: "Chandi Devi Temple" }).expect(201)).body.data.page;
    let v = own.version;
    for (const step of ["submit", "verify", "approve", "publish"]) v = (await act(ADMIN, own.id, step, { version: v }).expect(201)).body.data.page.version;
    expect(h1Of((await render("/temples/chandi-devi").expect(200)).text)).toEqual(["Chandi Devi Temple"]);
  });

  it("keeps the live version online while an edit of a published page is reviewed", async () => {
    const list = (await http().get("/api/seo/pages").set(as(LEAD)).query({ status: "published" }).expect(200)).body.data.rows;
    const row = list.find((r: any) => r.path === "/temples/har-ki-pauri");
    const edited = (
      await http().patch(`/api/seo/pages/${row.id}`).set(as(WRITER)).send({ version: row.version, seoTitle: "Har Ki Pauri Ghat Haridwar: Evening Aarti Guide" }).expect(200)
    ).body.data.page;
    expect(edited).toMatchObject({ publicationStatus: "published", stage: "draft", seoTitle: "Har Ki Pauri Haridwar: Ganga Aarti Timings & Guide" });
    expect(edited.pending).toMatchObject({ seoTitle: "Har Ki Pauri Ghat Haridwar: Evening Aarti Guide", stage: "draft", editedBy: WRITER.id });
    // Still live with the old title.
    expect(titleOf((await render("/temples/har-ki-pauri").expect(200)).text)).toContain("Ganga Aarti Timings");

    const queue = (await http().get("/api/seo/pages").set(as(LEAD)).query({ queue: "review" }).expect(200)).body.data.rows;
    expect(queue.map((r: any) => r.path)).not.toContain("/temples/har-ki-pauri"); // a draft revision is not in review yet

    const published = await publishAs(row.id, edited.version);
    expect(published).toMatchObject({ seoTitle: "Har Ki Pauri Ghat Haridwar: Evening Aarti Guide", pending: null, stage: "published" });
    expect(titleOf((await render("/temples/har-ki-pauri").expect(200)).text)).toBe("Har Ki Pauri Ghat Haridwar: Evening Aarti Guide");
  });

  it("refuses a title or description already live on another page", async () => {
    const res = await create(WRITER, { path: "/temples/maya-devi", seoTitle: "har ki pauri ghat haridwar: evening aarti guide" }).expect(409);
    expect(JSON.stringify(res.body)).toContain("/temples/har-ki-pauri");
  });

  it("de-indexes a page marked noindex: robots tag, X-Robots-Tag and sitemap agree", async () => {
    expect(await sitemapLocs()).toContain("https://www.tirvona.com/temples/maya-devi");
    const draft = (await create(WRITER, { path: "/temples/maya-devi", indexingStatus: "noindex" }).expect(201)).body.data.page;
    await publishAs(draft.id, draft.version);
    const res = await render("/temples/maya-devi").expect(200);
    expect(robotsOf(res.text)).toBe("noindex,follow");
    expect(res.headers["x-robots-tag"]).toBe("noindex,follow");
    expect(await sitemapLocs()).not.toContain("https://www.tirvona.com/temples/maya-devi");
  });

  it("retires pages with a 301 to a live page or a 410, and drops them from the sitemap", async () => {
    const rows = (await http().get("/api/seo/pages").set(as(LEAD)).expect(200)).body.data.rows;
    const chandi = rows.find((r: any) => r.path === "/temples/chandi-devi");
    await act(LEAD, chandi.id, "retire", { version: chandi.version, redirectTo: "/temples/chandi-devi" }).expect(400);
    await act(LEAD, chandi.id, "retire", { version: chandi.version, redirectTo: "/temples/draft-mandir" }).expect(400);
    await act(LEAD, chandi.id, "retire", { version: chandi.version, redirectTo: "https://evil.example.com/" }).expect(400);
    await act(WRITER, chandi.id, "retire", { version: chandi.version }).expect(403);
    const retired = (await act(LEAD, chandi.id, "retire", { version: chandi.version, redirectTo: "/temples/mansa-devi" }).expect(201)).body.data.page;
    expect(retired).toMatchObject({ publicationStatus: "retired", redirectTo: "/temples/mansa-devi" });
    const moved = await render("/temples/chandi-devi").expect(301);
    expect(moved.headers.location).toBe("/temples/mansa-devi");
    const gone = await http().get("/api/seo/meta").query({ path: "/temples/chandi-devi" }).expect(410);
    expect(gone.body.redirectTo).toBe("/temples/mansa-devi");
    await http().patch(`/api/seo/pages/${chandi.id}`).set(as(WRITER)).send({ version: retired.version, h1: "x" }).expect(409);

    const maya = rows.find((r: any) => r.path === "/temples/maya-devi");
    await act(LEAD, maya.id, "retire", { version: maya.version }).expect(201);
    const removed = await render("/temples/maya-devi").expect(410);
    expect(robotsOf(removed.text)).toBe("noindex,follow");
    expect(h1Of(removed.text)).toEqual(["This page has been removed"]);
    const locs = await sitemapLocs();
    expect(locs).not.toContain("https://www.tirvona.com/temples/chandi-devi");
    expect(locs).not.toContain("https://www.tirvona.com/temples/maya-devi");
    expect(locs).toContain("https://www.tirvona.com/temples/har-ki-pauri");
  });

  it("sends a page back with a required comment and keeps a history of every step", async () => {
    const draft = (await create(WRITER, { path: "/temples/bharat-mata", seoTitle: "Bharat Mata Mandir Haridwar: Eight Floors of History" }).expect(201)).body.data.page;
    const inReview = (await act(WRITER, draft.id, "submit", { version: draft.version }).expect(201)).body.data.page;
    await act(LEAD, draft.id, "reject", { version: inReview.version }).expect(400);
    const back = (await act(LEAD, draft.id, "reject", { version: inReview.version, comment: "Add the opening hours." }).expect(201)).body.data.page;
    expect(back).toMatchObject({ publicationStatus: "draft", reviewedBy: LEAD.id, verifiedAt: null });

    const detail = (await http().get(`/api/seo/pages/${draft.id}`).set(as(CHECKER)).expect(200)).body.data;
    expect(detail.history.map((h: any) => h.action)).toEqual(["SEO_PAGE_REJECTED", "SEO_PAGE_SUBMITTED", "SEO_PAGE_CREATED"]);
    expect(detail.history[0]).toMatchObject({ userId: LEAD.id, comment: "Add the opening hours." });
    await http().get("/api/seo/pages/not-an-id").set(as(CHECKER)).expect(404);
    await http().post(`/api/seo/pages/${draft.id}/delete`).set(as(ADMIN)).send({ version: back.version }).expect(404);
  });
});
