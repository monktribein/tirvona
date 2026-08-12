/**
 * Fails the build if a page exists in the SPA but not in the host's rewrite
 * lists.
 *
 * Smart Contact profiles are served from the site root, so `/ram-bhrose` and
 * `/parking` are indistinguishable to a static host. The only way to tell them
 * apart is an explicit list of the SPA's own pages, with the contact page as
 * the fallback for everything else.
 *
 * That list is a standing hazard: add a route to `App.tsx`, forget to add it
 * here, and the new page quietly serves "Contact not found" in production —
 * with a green build and no error anywhere. This script converts that silent
 * failure into a loud one at build time, which is the whole reason the
 * root-level URL scheme is safe to run at all.
 *
 * Fix when it fires: add the segment to `rewrites` in `frontend/vercel.json`
 * and to `routes` in `render.yaml`.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..");

/** Top-level path segments the SPA declares routes for. */
const spaSegments = () => {
  const source = readFileSync(resolve(frontendRoot, "src", "App.tsx"), "utf8");
  const segments = new Set();
  for (const match of source.matchAll(/path="\/([^"*:]*)/g)) {
    const segment = match[1].split("/")[0].trim();
    if (segment) segments.add(segment);
  }
  return segments;
};

/** Segments named in the alternation groups of vercel.json's rewrites. */
const configuredSegments = () => {
  const config = JSON.parse(
    readFileSync(resolve(frontendRoot, "vercel.json"), "utf8"),
  );
  const segments = new Set();
  for (const rule of config.rewrites ?? []) {
    if (rule.destination !== "/index.html") continue;
    for (const group of rule.source.matchAll(/\(([^)]*)\)/g)) {
      for (const name of group[1].split("|")) {
        const clean = name.trim();
        if (clean && /^[a-z0-9-]+$/i.test(clean)) segments.add(clean);
      }
    }
  }
  return segments;
};

const declared = spaSegments();
const configured = configuredSegments();
const missing = [...declared].filter((s) => !configured.has(s)).sort();

if (missing.length) {
  process.stderr.write(
    "\n[spa-routes] BUILD STOPPED — these SPA pages are missing from the\n" +
      "host rewrite lists, and would serve the Smart Contact page instead:\n\n" +
      missing.map((s) => `    /${s}`).join("\n") +
      "\n\nAdd them to the alternation group in:\n" +
      "    frontend/vercel.json  -> rewrites[].source\n" +
      "    render.yaml           -> tirvona-web routes\n\n" +
      "This check exists because the failure it prevents is silent in\n" +
      "production: the page would 'work', just show the wrong content.\n\n",
  );
  process.exit(1);
}

// Stale entries are harmless — a listed page that no longer exists simply
// routes to the SPA, which 404s it as before — so they are reported, not
// fatal.
const stale = [...configured].filter((s) => !declared.has(s)).sort();
if (stale.length) {
  process.stdout.write(
    `\n[spa-routes] note: ${stale.length} listed page(s) no longer in App.tsx ` +
      `(harmless): ${stale.join(", ")}\n`,
  );
}

process.stdout.write(
  `[spa-routes] OK — ${declared.size} SPA pages all covered by the rewrite lists\n`,
);
