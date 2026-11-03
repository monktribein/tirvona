/**
 * Turns a resolved SeoPage into the HTML a crawler or browser receives: the
 * built Vite index.html with route-specific head tags and a crawlable summary
 * of the page inside #root. React's createRoot replaces that summary when the
 * app mounts, so the interactive page is unchanged.
 *
 * Everything that came from the database is escaped here and nowhere else.
 */

export interface SeoBreadcrumb {
  name: string;
  path: string;
}

export interface SeoSection {
  heading: string;
  /** Plain text paragraphs. */
  paragraphs?: string[];
  /** Label/value facts rendered as a definition list. */
  facts?: Array<[string, string]>;
  /** Plain bullet items. */
  items?: string[];
  /** Internal links (site-relative paths only). */
  links?: Array<{ label: string; path: string }>;
}

export interface SeoPage {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  h1: string;
  intro?: string;
  image?: string;
  ogType?: string;
  breadcrumbs?: SeoBreadcrumb[];
  sections?: SeoSection[];
  jsonLd?: Array<Record<string, unknown>>;
  /** Element id for the JSON-LD script, matching the one the React page writes, so it is replaced, not duplicated. */
  jsonLdId?: string;
  /** Drop the server JSON-LD once React mounts, because the page renders its own. */
  clientJsonLd?: boolean;
  /** Published editorial additions (FAQPage, HowTo, Event). Kept after React mounts: no page renders them itself. */
  editorialJsonLd?: Array<Record<string, unknown>>;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: unknown): string =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/**
 * JSON for a <script type="application/ld+json"> body. `<`, `>`, `&` and the
 * JS line separators are written as \u escapes, so no value can close the
 * script element or open a comment.
 */
export const serializeJsonLd = (value: unknown): string =>
  JSON.stringify(value, (_key, v) => (v === undefined || v === null || v === "" ? undefined : v))
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp("\u2028", "g"), "\\u2028")
    .replace(new RegExp("\u2029", "g"), "\\u2029");

/** Only absolute http(s) URLs or site-relative paths are ever written into href/src/content. */
export const safeUrl = (value: unknown, origin: string): string | undefined => {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  if (raw.startsWith("/") && !raw.startsWith("//")) return `${origin}${raw}`;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

/** Site-relative link targets only: anything else is dropped. */
const safePath = (value: string): string | undefined =>
  value.startsWith("/") && !value.startsWith("//") && !/[\s"'<>\\]/.test(value) ? value : undefined;

const HEAD_TAGS_TO_REPLACE: RegExp[] = [
  /<title>[\s\S]*?<\/title>\s*/gi,
  /<meta\s+name=["']description["'][^>]*>\s*/gi,
  /<meta\s+name=["']robots["'][^>]*>\s*/gi,
  /<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi,
  /<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi,
  /<link\s+rel=["']canonical["'][^>]*>\s*/gi,
];

const ROOT_PLACEHOLDER = /<div id="root">\s*<\/div>/;

export class SeoShellError extends Error {}

/** Throws SeoShellError when the shell is not the expected Vite index.html. */
export const assertUsableShell = (shell: string): void => {
  if (!shell.includes("</head>") || !ROOT_PLACEHOLDER.test(shell)) {
    throw new SeoShellError("index.html is missing </head> or an empty #root");
  }
};

export const renderHead = (page: SeoPage): string => {
  const tags = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    `<meta name="robots" content="${escapeHtml(page.robots)}" />`,
    `<link rel="canonical" href="${escapeHtml(page.canonicalUrl)}" />`,
    `<meta property="og:site_name" content="Tirvona" />`,
    `<meta property="og:type" content="${escapeHtml(page.ogType ?? "website")}" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    `<meta property="og:url" content="${escapeHtml(page.canonicalUrl)}" />`,
    `<meta name="twitter:card" content="${page.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
  ];
  if (page.image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(page.image)}" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(page.image)}" />`);
  }
  if (page.jsonLd?.length) {
    const id = page.jsonLdId ? ` id="${escapeHtml(page.jsonLdId)}"` : "";
    const clientFlag = page.clientJsonLd ? ` data-seo-client-replaces="true"` : "";
    tags.push(
      `<script type="application/ld+json" data-seo-ssr="true"${id}${clientFlag}>${serializeJsonLd(
        page.jsonLd.length === 1 ? page.jsonLd[0] : page.jsonLd,
      )}</script>`,
    );
  }
  if (page.editorialJsonLd?.length) {
    tags.push(
      `<script type="application/ld+json" data-seo-ssr="true" data-seo-editorial="true">${serializeJsonLd(
        page.editorialJsonLd.length === 1 ? page.editorialJsonLd[0] : page.editorialJsonLd,
      )}</script>`,
    );
  }
  return tags.map((tag) => `    ${tag}`).join("\n");
};

export const renderBody = (page: SeoPage, footerLinks: Array<{ label: string; path: string }>): string => {
  const out: string[] = ['<div data-seo-ssr="true">'];
  const crumbs = (page.breadcrumbs ?? []).filter((c) => safePath(c.path));
  if (crumbs.length > 1) {
    out.push('<nav aria-label="Breadcrumb"><ol>');
    crumbs.forEach((crumb, index) => {
      out.push(
        index === crumbs.length - 1
          ? `<li aria-current="page">${escapeHtml(crumb.name)}</li>`
          : `<li><a href="${escapeHtml(crumb.path)}">${escapeHtml(crumb.name)}</a></li>`,
      );
    });
    out.push("</ol></nav>");
  }
  out.push("<main><article>");
  out.push(`<h1>${escapeHtml(page.h1)}</h1>`);
  if (page.image) out.push(`<img src="${escapeHtml(page.image)}" alt="${escapeHtml(page.h1)}" />`);
  if (page.intro) out.push(`<p>${escapeHtml(page.intro)}</p>`);
  for (const section of page.sections ?? []) {
    const links = (section.links ?? []).filter((l) => safePath(l.path) && l.label);
    const facts = (section.facts ?? []).filter(([, v]) => String(v ?? "").trim());
    const items = (section.items ?? []).filter((i) => String(i ?? "").trim());
    const paragraphs = (section.paragraphs ?? []).filter((p) => String(p ?? "").trim());
    if (!links.length && !facts.length && !items.length && !paragraphs.length) continue;
    out.push(`<section><h2>${escapeHtml(section.heading)}</h2>`);
    paragraphs.forEach((p) => out.push(`<p>${escapeHtml(p)}</p>`));
    if (facts.length) {
      out.push("<dl>");
      facts.forEach(([k, v]) => out.push(`<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`));
      out.push("</dl>");
    }
    if (items.length) out.push(`<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`);
    if (links.length) {
      out.push(
        `<ul>${links
          .map((l) => `<li><a href="${escapeHtml(l.path)}">${escapeHtml(l.label)}</a></li>`)
          .join("")}</ul>`,
      );
    }
    out.push("</section>");
  }
  out.push("</article></main>");
  out.push(
    `<footer><nav aria-label="Tirvona"><ul>${footerLinks
      .map((l) => `<li><a href="${escapeHtml(l.path)}">${escapeHtml(l.label)}</a></li>`)
      .join("")}</ul></nav></footer>`,
  );
  out.push("</div>");
  return out.join("");
};

/** Injects the head tags and body summary into the Vite shell. */
export const renderDocument = (
  shell: string,
  page: SeoPage,
  footerLinks: Array<{ label: string; path: string }>,
): string => {
  assertUsableShell(shell);
  let html = shell;
  for (const re of HEAD_TAGS_TO_REPLACE) html = html.replace(re, "");
  html = html.replace("</head>", `${renderHead(page)}\n  </head>`);
  // A replacer function, so `$` sequences in page content are never treated as patterns.
  const body = renderBody(page, footerLinks);
  return html.replace(ROOT_PLACEHOLDER, () => `<div id="root">${body}</div>`);
};
