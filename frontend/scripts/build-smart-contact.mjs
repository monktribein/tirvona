/**
 * Builds the SmarID Smart Contact page and folds its output into this app's
 * `dist/c/`, so a single deployment serves both.
 *
 * Why co-deploy rather than run SmarID as its own service: printed QR codes
 * encode `https://www.tirvona.com/c/{slug}` and that URL is permanent, so the
 * page has to answer on the main host no matter what. Publishing it under the
 * same origin means no cross-service proxy, no second CORS origin, and one TLS
 * certificate — and it leaves the door open to injecting per-profile Open
 * Graph tags at the edge later, which a proxied third-party origin would not.
 *
 * The two codebases stay entirely separate; only the built assets meet.
 *
 * Failure here is deliberately non-fatal. Some hosts check out only the
 * project's root directory, in which case `../SmarID` does not exist — and a
 * missing contact page must never take the whole marketing site down with it.
 * The script warns loudly and exits 0 instead.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..");
const smarIdRoot = resolve(frontendRoot, "..", "SmarID");
const target = resolve(frontendRoot, "dist", "c");

const warn = (message) => {
  process.stdout.write(`\n[smart-contact] ${message}\n`);
};

if (!existsSync(resolve(smarIdRoot, "package.json"))) {
  warn(
    "SKIPPED — ../SmarID not found in this checkout.\n" +
      "  The main site will build, but https://<host>/c/{slug} will fall\n" +
      "  through to the SPA and render the homepage.\n" +
      "  On Vercel: enable 'Include source files outside of the Root\n" +
      "  Directory'. On Render: build from the repository root.",
  );
  process.exit(0);
}

/**
 * Windows needs `shell: true`; Linux (where this actually deploys) must not
 * have it.
 *
 * Node 20+ refuses to execFile a `.cmd` without a shell and throws EINVAL, so
 * the shell is unavoidable for npm on Windows. It emits DEP0190 about
 * unescaped arguments, which is harmless here — every argument below is a
 * hardcoded literal, never anything derived from input.
 */
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const run = (args, cwd) =>
  execFileSync(npm, args, { cwd, stdio: "inherit", shell: isWindows });

try {
  // `npm ci` when there is a lockfile and no node_modules; the host installs
  // dependencies for this app only, so SmarID's are almost never present.
  if (!existsSync(resolve(smarIdRoot, "node_modules"))) {
    const hasLock = existsSync(resolve(smarIdRoot, "package-lock.json"));
    run([hasLock ? "ci" : "install"], smarIdRoot);
  }
  run(["run", "build"], smarIdRoot);

  const source = resolve(smarIdRoot, "dist");
  if (!existsSync(source)) {
    warn("SKIPPED — SmarID built but produced no dist/.");
    process.exit(0);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  warn(`OK — Smart Contact page published at /c/ (from ${source})`);
} catch (error) {
  warn(
    `SKIPPED — SmarID build failed: ${error.message}\n` +
      "  The main site still built. /c/{slug} will render the homepage until\n" +
      "  this is fixed.",
  );
  process.exit(0);
}
