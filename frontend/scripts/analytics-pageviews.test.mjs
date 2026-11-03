// Page-view counting for GA4 and Google Ads, without a browser.
//
//   node --test scripts/analytics-pageviews.test.mjs
//
// Runs the real inline gtag snippet from index.html and the real
// src/lib/analytics.ts (Node strips its types), then replays the hits the way
// gtag.js sends them: a `config` call without `send_page_view: false` sends an
// automatic page_view, and every `event` hit goes to its `send_to` target.
// PageViewTracker in App.tsx calls trackPageView once per pathname/search
// change; the last test pins that wiring so the model here stays honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(root + p, "utf8");
const GA4 = "G-5S7XM8N389";
const ADS = "AW-18454245978";

const inlineGtagSnippet = (html) => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const snippet = scripts.find((s) => s.includes("gtag('config'"));
  assert.ok(snippet, "index.html has the inline gtag snippet");
  return snippet;
};

/** Loads a page: runs the snippet in a fresh window, returns helpers to navigate and count hits. */
async function loadPage(html, firstPath) {
  const window = { location: { href: `https://www.tirvona.com${firstPath}` } };
  window.window = window;
  vm.runInNewContext(inlineGtagSnippet(html), window);
  globalThis.window = window;
  globalThis.document = { title: "Tirvona" };
  // A fresh module instance per page load, as a real load would have.
  const analytics = await import(`../src/lib/analytics.ts?load=${Math.random()}`);

  let lastTracked = null;
  // PageViewTracker: effect keyed on pathname + search.
  const route = (path) => {
    if (path === lastTracked) return;
    lastTracked = path;
    window.location.href = `https://www.tirvona.com${path}`;
    analytics.trackPageView(path);
  };
  route(firstPath);

  const hits = () => {
    const out = [];
    for (const args of window.dataLayer) {
      const [command, target, params = {}] = args;
      if (command === "config" && params.send_page_view !== false) out.push({ to: target, name: "page_view", auto: true });
      if (command === "event") out.push({ to: params.send_to, name: target, params });
    }
    return out;
  };
  const count = (to, name = "page_view") => hits().filter((h) => h.to === to && h.name === name).length;
  return { route, count, hits, analytics, window };
}

const shell = read("index.html");

test("index.html stops gtag's automatic GA4 page_view (PageViewTracker sends it instead)", () => {
  assert.ok(shell.includes(`gtag('config', '${GA4}', { send_page_view: false });`));
  assert.ok(!shell.includes(`gtag('config', '${GA4}');`), "no config line that sends a second, automatic page_view");
});

test("index.html: one GA4 page_view per page load, one more per SPA navigation", async () => {
  const page = await loadPage(shell, "/ashrams");
  assert.equal(page.count(GA4), 1);
  page.route("/ashrams/haridwar");
  page.route("/temples");
  assert.equal(page.count(GA4), 3);
  // Re-renders and React replacing the server-rendered summary keep the same location: no new hits.
  page.route("/temples");
  assert.equal(page.count(GA4), 3);
  // A new query string is a new page for GA4, as before.
  page.route("/search?destination=haridwar");
  assert.equal(page.count(GA4), 4);
  const [first] = page.hits().filter((h) => h.to === GA4);
  assert.equal(first.params.page_path, "/ashrams");
  assert.equal(first.params.page_location, "https://www.tirvona.com/ashrams");
});

test("Google Ads: one page_view per page load and per navigation", async () => {
  assert.equal((shell.match(/googletagmanager\.com\/gtag\/js\?id=AW-18454245978/g) ?? []).length, 1);
  assert.equal((shell.match(/googletagmanager\.com\/gtag\/js\?id=G-5S7XM8N389/g) ?? []).length, 1);
  assert.ok(shell.includes(`gtag('config', '${ADS}', { send_page_view: false });`));
  const page = await loadPage(shell, "/");
  assert.equal(page.count(ADS), 1, "one Ads page_view per load (from trackPageView), none automatic");
  page.route("/ashrams");
  assert.equal(page.count(ADS), 2);
});

test("vercel.json CSP allows gtag.js and the exact inline gtag snippet", () => {
  // Hosts serve the file with LF line endings (git normalises it), so hash that form.
  const snippet = inlineGtagSnippet(shell.replace(/\r\n/g, "\n"));
  const hash = `'sha256-${createHash("sha256").update(snippet, "utf8").digest("base64")}'`;
  const csp = JSON.parse(read("vercel.json"))
    .headers.flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy").value;
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
  assert.ok(scriptSrc.includes("https://www.googletagmanager.com"));
  assert.ok(scriptSrc.includes(hash), `update the snippet hash in vercel.json to ${hash}`);
});

test("purchase is sent once to GA4 per booking", async () => {
  const page = await loadPage(shell, "/booking/confirmed");
  page.window.sessionStorage = { getItem: () => null, setItem: () => {} };
  const purchase = { booking_id: "b-1", booking_value: 1200 };
  page.analytics.trackPurchase(purchase);
  page.analytics.trackPurchase(purchase);
  assert.equal(page.count(GA4, "purchase"), 1);
});

test("PageViewTracker sends one page view per pathname/search change", () => {
  const app = read("src/App.tsx");
  const tracker = app.match(/const PageViewTracker[\s\S]*?\n};/)?.[0];
  assert.ok(tracker, "PageViewTracker exists in App.tsx");
  assert.equal((tracker.match(/trackPageView\(/g) ?? []).length, 1);
  assert.match(tracker, /\[location\.pathname, location\.search\]\)/);
  assert.equal((app.match(/<PageViewTracker \/>/g) ?? []).length, 1, "mounted once");
  assert.equal((app.match(/trackPageView\(/g) ?? []).length, 1, "no other caller in App.tsx");
});
