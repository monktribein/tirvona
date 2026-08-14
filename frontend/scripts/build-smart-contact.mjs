import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(here, "..");
const smarIdRoot = resolve(frontendRoot, "..", "SmarID");
const distRoot = resolve(frontendRoot, "dist");
const pageTarget = resolve(distRoot, "smart-contact.html");
const assetTarget = resolve(distRoot, "sc-assets");

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
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const run = (args, cwd) =>
  execFileSync(npm, args, { cwd, stdio: "inherit", shell: isWindows });

try {
  if (!existsSync(resolve(smarIdRoot, "node_modules"))) {
    const hasLock = existsSync(resolve(smarIdRoot, "package-lock.json"));
    run([hasLock ? "ci" : "install"], smarIdRoot);
  }
  run(["run", "build"], smarIdRoot);

  const source = resolve(smarIdRoot, "dist");
  if (!existsSync(resolve(source, "index.html"))) {
    warn("SKIPPED — SmarID built but produced no dist/.");
    process.exit(0);
  };
  mkdirSync(distRoot, { recursive: true });
  copyFileSync(resolve(source, "index.html"), pageTarget);

  rmSync(assetTarget, { recursive: true, force: true });
  cpSync(resolve(source, "sc-assets"), assetTarget, { recursive: true });

  warn("OK — Smart Contact page published at the site root (/{slug})");
} catch (error) {
  warn(
    `SKIPPED — SmarID build failed: ${error.message}\n` +
      "  The main site still built. /c/{slug} will render the homepage until\n" +
      "  this is fixed.",
  );
  process.exit(0);
}
