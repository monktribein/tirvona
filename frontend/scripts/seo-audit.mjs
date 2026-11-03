// Rendered-page SEO audit: initial server HTML and the hydrated page in headless Chrome,
// at mobile (390px) and desktop (1366px) widths.
//
//   SEO_AUDIT_BASE=https://staging.example node scripts/seo-audit.mjs [path ...]
//   CHROME_PATH=/path/to/chrome   (default: the usual Chrome install location)
//
// Fails (exit 1) when a public page does not have exactly one visible, non-empty H1
// before and after hydration, skips heading levels, has empty headings, hidden H1/H2
// text, images without an alt attribute, horizontal overflow, a CSP violation, or
// a canonical that is not absolute. Writes seo-audit.json next to the working dir.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = (process.env.SEO_AUDIT_BASE || "http://localhost:8080").replace(/\/+$/, "");
const CHROME = process.env.CHROME_PATH ||
  (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "google-chrome");
const DEFAULT_ROUTES = [
  "/", "/ashrams", "/temples", "/pandits", "/marketplace", "/marketplace/categories", "/food", "/events", "/circuits",
  "/pilgrimage-circuits", "/blog", "/ashrams/vrindavan", "/stays-near-banke-bihari-vrindavan", "/stays-near-prem-mandir-vrindavan",
  "/stays-near-iskcon-vrindavan", "/budget-stays-in-vrindavan", "/family-stays-in-vrindavan", "/about", "/faq", "/contact",
  "/help", "/press", "/partner", "/services", "/local", "/travel-guides", "/local-guides", "/transport", "/shops", "/puja-items",
  "/books", "/handicrafts", "/religious-products", "/parking", "/aarti", "/live-pooja", "/offers", "/volunteer", "/terms",
  "/privacy", "/refund-policy", "/cancellation-policy", "/cookie-policy", "/stay-policies", "/govt-guidelines",
];
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1366, height: 900, mobile: false },
];

const serverHeadings = (html) =>
  [...(html.split('<div id="root">')[1] ?? "").matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .map((m) => ({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "").trim() }));

// Runs in the page. Dialog headings (closed assistant panel, modals) are not page outline.
const COLLECT = `(() => {
  const shown = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === "none" || s.visibility === "hidden") return false; }
    return true; };
  const animated = (el) => getComputedStyle(el).opacity === "0" && !!el.closest("[style*=opacity]");
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter((h) => !h.closest("[role=dialog],dialog,[aria-modal=true]") && !(h.closest("[aria-hidden=true]") && !shown(h)))
    .map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 100), visible: shown(h) || animated(h) }));
  const imgs = [...document.querySelectorAll("img")].map((i) => ({ src: (i.currentSrc || i.src).slice(0, 100), alt: i.getAttribute("alt") }));
  return { headings, imgs, overflow: document.documentElement.scrollWidth > innerWidth + 1, scrollWidth: document.documentElement.scrollWidth,
    canonical: document.querySelector("link[rel=canonical]")?.getAttribute("href") ?? null };
})()`;

async function connect(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const target = list.find((t) => t.type === "page");
      if (target) return target.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Chrome did not start (${CHROME})`);
}

const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "seo-audit-"))}`, `--remote-debugging-port=${port}`, "about:blank"], { stdio: "ignore" });
const ws = new WebSocket(await connect(port));
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else events.push(d);
});
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

const results = [];
const failures = [];
for (const route of ROUTES) {
  const res = await fetch(BASE + route, { redirect: "manual" });
  const html = await res.text();
  const server = serverHeadings(html);
  const row = { route, status: res.status, serverH1: server.filter((h) => h.level === 1).length, views: {} };
  const fail = (msg) => failures.push(`${route}: ${msg}`);
  if (res.status !== 200) fail(`HTTP ${res.status}`);
  if (row.serverH1 !== 1) fail(`server HTML has ${row.serverH1} H1`);
  for (const vp of VIEWPORTS) {
    await send("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
    events.length = 0;
    await send("Page.navigate", { url: BASE + route });
    await sleep(Number(process.env.SEO_AUDIT_WAIT_MS || 4500));
    const v = (await send("Runtime.evaluate", { expression: COLLECT, returnByValue: true })).result?.result?.value;
    if (!v) { fail(`${vp.name}: page did not evaluate`); continue; }
    const csp = events.filter((e) => e.method === "Log.entryAdded" && /Content Security Policy/i.test(e.params.entry.text)).length;
    row.views[vp.name] = { ...v, csp };
    const h1 = v.headings.filter((h) => h.level === 1);
    if (h1.length !== 1 || !h1[0].visible || !h1[0].text) fail(`${vp.name}: ${h1.length} H1 (${h1.map((h) => `${h.text}${h.visible ? "" : " [hidden]"}`).join(", ")})`);
    const jumps = v.headings.filter((h, i) => i > 0 && h.level > v.headings[i - 1].level + 1);
    if (jumps.length) fail(`${vp.name}: heading level skipped before "${jumps[0].text}" (h${jumps[0].level})`);
    const empty = v.headings.filter((h) => !h.text).length;
    if (empty) fail(`${vp.name}: ${empty} empty heading(s)`);
    const hidden = v.headings.filter((h) => h.level <= 2 && !h.visible).map((h) => h.text);
    if (hidden.length) fail(`${vp.name}: hidden heading(s) ${JSON.stringify(hidden)}`);
    const noAlt = v.imgs.filter((i) => i.alt === null);
    if (noAlt.length) fail(`${vp.name}: ${noAlt.length} <img> without alt (${noAlt[0].src})`);
    if (v.overflow) fail(`${vp.name}: horizontal overflow (${v.scrollWidth}px)`);
    if (csp) fail(`${vp.name}: ${csp} CSP violation(s)`);
    if (v.canonical && !/^https:\/\/www\.tirvona\.com\//.test(v.canonical)) fail(`${vp.name}: canonical ${v.canonical}`);
  }
  results.push(row);
  process.stdout.write(failures.some((f) => f.startsWith(`${route}:`)) ? "x" : ".");
}
ws.close();
chrome.kill();
writeFileSync("seo-audit.json", JSON.stringify({ base: BASE, results, failures }, null, 1));
console.log(`\n${ROUTES.length} routes × ${VIEWPORTS.length} viewports, ${failures.length} failure(s)`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
