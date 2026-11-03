import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { renderDocument, assertUsableShell } from "../domain/seo-html";
import { ROBOTS_INDEX, ROBOTS_PRIVATE } from "../domain/seo-route-policy";
import { FOOTER_LINKS, SeoPagesService } from "./seo-pages.service";

export interface SeoRenderResult {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Rendered pages are reused for this long; approved-content edits show up within it, or at once after an invalidation. */
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 1_000;
/** How often the shell file's modification time is re-checked, so a frontend deploy is picked up. */
const SHELL_RECHECK_MS = 5_000;

/**
 * Renders the HTML document for a public URL. The output depends only on the
 * path — never on cookies, headers or the signed-in user — so cached copies can
 * be served to anyone.
 */
@Injectable()
export class SeoRenderService {
  private readonly logger = new Logger(SeoRenderService.name);
  private readonly cache = new Map<string, { expires: number; result: SeoRenderResult }>();
  private shell: { html: string; mtimeMs: number; checkedAt: number } | null = null;

  constructor(private readonly pages: SeoPagesService) {}

  /** The built Vite index.html: SEO_SHELL_PATH, else ../frontend/dist/index.html next to the API. */
  shellPath(): string {
    return process.env.SEO_SHELL_PATH || path.resolve(process.cwd(), "..", "frontend", "dist", "index.html");
  }

  async render(pathname: string, search = ""): Promise<SeoRenderResult> {
    const cached = this.cache.get(pathname);
    if (cached && cached.expires > Date.now()) return this.withSearch(cached.result, search);

    const shell = await this.loadShell();
    const resolution = await this.pages.resolve(pathname);
    let result: SeoRenderResult;
    if (resolution.status === 301) {
      result = {
        status: 301,
        headers: { Location: resolution.location, "Cache-Control": "public, max-age=3600" },
        body: "",
      };
    } else {
      const { page } = resolution;
      const headers: Record<string, string> = {
        "Content-Type": "text/html; charset=utf-8",
        // index.html references hashed bundles, so browsers must revalidate it after every deploy.
        "Cache-Control": page.robots === ROBOTS_PRIVATE ? "private, no-store" : "no-cache",
      };
      if (page.robots !== ROBOTS_INDEX) headers["X-Robots-Tag"] = page.robots;
      result = { status: resolution.status, headers, body: renderDocument(shell, page, FOOTER_LINKS) };
    }

    this.remember(pathname, result);
    return this.withSearch(result, search);
  }

  /** Drops cached pages: the given paths, or everything. Returns how many were dropped. */
  invalidate(paths?: string[]): number {
    if (!paths?.length) {
      const size = this.cache.size;
      this.cache.clear();
      return size;
    }
    let dropped = 0;
    for (const p of paths) if (this.cache.delete(p)) dropped++;
    return dropped;
  }

  /** Redirects keep the visitor's query string (utm tags, filters). */
  private withSearch(result: SeoRenderResult, search: string): SeoRenderResult {
    if (result.status !== 301 || !search) return result;
    return { ...result, headers: { ...result.headers, Location: `${result.headers.Location}${search}` } };
  }

  private remember(pathname: string, result: SeoRenderResult): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(pathname, { expires: Date.now() + CACHE_TTL_MS, result });
  }

  private async loadShell(): Promise<string> {
    const now = Date.now();
    if (this.shell && now - this.shell.checkedAt < SHELL_RECHECK_MS) return this.shell.html;
    const file = this.shellPath();
    const stat = await fs.stat(file);
    if (this.shell && this.shell.mtimeMs === stat.mtimeMs) {
      this.shell.checkedAt = now;
      return this.shell.html;
    }
    const html = await fs.readFile(file, "utf8");
    assertUsableShell(html);
    if (this.shell) {
      this.logger.log("Frontend shell changed; clearing rendered pages");
      this.cache.clear();
    }
    this.shell = { html, mtimeMs: stat.mtimeMs, checkedAt: now };
    return html;
  }
}
