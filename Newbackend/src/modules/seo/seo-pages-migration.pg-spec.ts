/// <reference types="jest" />
/**
 * Migration 0014 (seo_pages) and its rollback, applied to the throwaway Postgres 17 started
 * by test/pg/global-setup.js — never the hosted database. Proves the SQL runs, the
 * uniqueness and lifecycle rules hold, the page types match the service's, and the
 * rollback leaves nothing behind. Run with `npm run test:pg -- seo-pages-migration`.
 */
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { createTestDatabase, type TestDatabase } from "../../database/pg/test-database";
import { SEO_PAGE_TYPES, SEO_PAGE_TYPES_WITHOUT_ENTITY } from "./domain/seo-publishing";

const DB_DIR = path.resolve(__dirname, "../../../database");
const UP = readFileSync(path.join(DB_DIR, "migrations", "0014_seo_pages.sql"), "utf8");
const DOWN = readFileSync(path.join(DB_DIR, "rollback", "0014_seo_pages.down.sql"), "utf8");

/** The generator names indexes by a hash of their definition, so read the names from the file. */
const uniqueIndexOn = (columns: string): string => {
  const match = UP.match(new RegExp(`CREATE UNIQUE INDEX "([^"]+)" ON "public"\\."seo_pages" USING btree \\(${columns}\\)`));
  if (!match) throw new Error(`no unique index on ${columns}`);
  return match[1];
};
const UQ_PATH = uniqueIndexOn('"path"');
const UQ_ENTITY = uniqueIndexOn('"page_type", "entity_id"');
const UQ_LEGACY = uniqueIndexOn('"legacy_wp_id"');

const NOW = "2026-10-30T00:00:00Z";
const row = (over: Record<string, unknown> = {}) => ({
  id: `p-${Math.random().toString(36).slice(2)}`,
  page_type: "temple",
  entity_id: "t-1",
  slug: "har-ki-pauri",
  path: "/temples/har-ki-pauri",
  canonical_url: "https://www.tirvona.com/temples/har-ki-pauri",
  ...over,
});

describe("seo_pages migration 0014 (throwaway Postgres)", () => {
  let db: TestDatabase;
  const insert = (r: Record<string, unknown>) => {
    const cols = Object.keys(r);
    return db.pool.query(
      `INSERT INTO public.seo_pages (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")})`,
      cols.map((c) => r[c]),
    );
  };
  const rejects = async (r: Record<string, unknown>, constraint: string) => {
    await expect(insert(r)).rejects.toThrow(constraint);
  };

  beforeAll(async () => {
    db = await createTestDatabase([]);
    await db.pool.query(UP);
  });

  afterAll(async () => {
    await db?.drop();
  });

  it("creates a draft, indexable row with defaults", async () => {
    await insert(row({ id: "first" }));
    const { rows } = await db.pool.query(`SELECT publication_status, indexing_status, version FROM public.seo_pages WHERE id = 'first'`);
    expect(rows[0]).toEqual({ publication_status: "draft", indexing_status: "index", version: 1 });
  });

  it("enforces one row per path, per entity and per legacy WordPress id", async () => {
    await rejects(row({ entity_id: "t-2" }), UQ_PATH);
    await rejects(row({ path: "/temples/other", canonical_url: "https://www.tirvona.com/temples/other", slug: "other" }), UQ_ENTITY);
    await insert(row({ entity_id: "t-3", slug: "a", path: "/temples/a", canonical_url: "https://www.tirvona.com/temples/a", legacy_wp_id: "wp-9" }));
    await rejects(row({ entity_id: "t-4", slug: "b", path: "/temples/b", canonical_url: "https://www.tirvona.com/temples/b", legacy_wp_id: "wp-9" }), UQ_LEGACY);
  });

  it("rejects off-site or inconsistent canonicals and malformed paths", async () => {
    await rejects(row({ entity_id: "x1", canonical_url: "https://evil.example.com/temples/har-ki-pauri" }), "seo_pages_ck_canonical");
    for (const bad of ["/Temples/x", "/temples/x/", "/temples//x", "/temples/x?a=1", "temples/x"]) {
      await rejects(row({ entity_id: `x-${bad}`, path: bad, canonical_url: `https://www.tirvona.com${bad}` }), "seo_pages_ck_path");
    }
  });

  it("requires an entity for entity pages and none for static pages", async () => {
    await rejects(row({ entity_id: null, path: "/temples/y", canonical_url: "https://www.tirvona.com/temples/y" }), "seo_pages_ck_entity");
    await rejects(row({ page_type: "static", slug: "about", path: "/about", canonical_url: "https://www.tirvona.com/about" }), "seo_pages_ck_entity");
    await insert(row({ page_type: "static", entity_id: null, slug: "about", path: "/about", canonical_url: "https://www.tirvona.com/about" }));
    await rejects(row({ page_type: "wordpress", entity_id: "z" }), "seo_pages_ck_page_type");
    // Names from before the route policy settled on its current kinds.
    await rejects(row({ page_type: "provider", entity_id: "z", path: "/pandit/z", canonical_url: "https://www.tirvona.com/pandit/z", slug: "z" }), "seo_pages_ck_page_type");
  });

  it("accepts every page type the service uses, with or without an entity as the service expects", async () => {
    for (const [i, type] of SEO_PAGE_TYPES.entries()) {
      const p = `/kinds/k${i}`;
      const needsEntity = !SEO_PAGE_TYPES_WITHOUT_ENTITY.includes(type);
      await insert(row({ page_type: type, entity_id: needsEntity ? `e-${i}` : null, slug: `k${i}`, path: p, canonical_url: `https://www.tirvona.com${p}` }));
    }
    const { rows } = await db.pool.query(`SELECT count(*)::int AS n FROM public.seo_pages WHERE path LIKE '/kinds/%'`);
    expect(rows[0].n).toBe(SEO_PAGE_TYPES.length);
  });

  it("enforces length limits and JSON shapes", async () => {
    const base = { entity_id: "len", slug: "len", path: "/temples/len", canonical_url: "https://www.tirvona.com/temples/len" };
    await rejects(row({ ...base, seo_title: "x".repeat(71) }), "seo_pages_ck_lengths");
    await rejects(row({ ...base, meta_description: "" }), "seo_pages_ck_lengths");
    await rejects(row({ ...base, content_json: JSON.stringify([1]) }), "seo_pages_ck_json");
    await rejects(row({ ...base, schema_json: JSON.stringify("x") }), "seo_pages_ck_json");
    await rejects(row({ ...base, pending: JSON.stringify([1]) }), "seo_pages_ck_json");
  });

  it("never lets an unverified or unapproved page be approved or published", async () => {
    const base = { entity_id: "life", slug: "life", path: "/temples/life", canonical_url: "https://www.tirvona.com/temples/life" };
    await rejects(row({ ...base, publication_status: "published", published_at: NOW, approved_by: "u1" }), "seo_pages_ck_lifecycle");
    await rejects(row({ ...base, publication_status: "approved", verified_at: NOW }), "seo_pages_ck_lifecycle");
    await rejects(row({ ...base, publication_status: "published", verified_at: NOW, approved_by: "u1" }), "seo_pages_ck_lifecycle");
    await rejects(row({ ...base, publication_status: "retired" }), "seo_pages_ck_lifecycle");
    await rejects(row({ ...base, publication_status: "retired", retired_at: NOW, redirect_to: "https://evil.example.com/" }), "seo_pages_ck_lifecycle");
    await rejects(row({ ...base, redirect_to: "/temples" }), "seo_pages_ck_lifecycle");
    await insert(row({ ...base, publication_status: "published", verified_at: NOW, approved_by: "u1", published_at: NOW }));
    await insert(row({ entity_id: "old", slug: "old", path: "/temples/old", canonical_url: "https://www.tirvona.com/temples/old", publication_status: "retired", retired_at: NOW, redirect_to: "/temples" }));
  });

  it("rolls back cleanly and can be applied again", async () => {
    await db.pool.query(`CREATE TABLE public.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    await db.pool.query(`INSERT INTO public.schema_migrations (name) VALUES ('0014_seo_pages.sql')`);
    await db.pool.query(DOWN);
    const { rows } = await db.pool.query(`SELECT to_regclass('public.seo_pages') AS t, (SELECT count(*)::int FROM public.schema_migrations) AS n`);
    expect(rows[0]).toEqual({ t: null, n: 0 });
    await db.pool.query(UP);
    await insert(row({ id: "again" }));
  });
});
