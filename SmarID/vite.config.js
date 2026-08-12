import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The public Smart Contact page.
 *
 * Served from the site root: a profile is `https://www.tirvona.com/{slug}`,
 * with no path segment in front of it. The build is copied next to the main
 * SPA's output as `smart-contact.html`, and the host falls back to it for any
 * path that is not one of the SPA's own pages — see
 * `frontend/scripts/build-smart-contact.mjs` and the rewrite lists in
 * `frontend/vercel.json` / `render.yaml`.
 *
 * Port 5175 keeps it clear of the platform SPA (5173) and the lead field app
 * (5174), so all three can run at once during development.
 */
export default defineConfig({
  // Profiles are served from the site root (`/ram-bhrose`), so assets resolve
  // from the root too.
  base: "/",
  plugins: [react()],
  server: {
    port: 5175,
  },
  build: {
    // NOT the default "assets". This build is copied alongside the main SPA's
    // output, and both would otherwise write into `dist/assets` — merging two
    // apps' files into one directory. A separate folder keeps them apart.
    assetsDir: "sc-assets",
    // Spec §39 asks for a page that loads in under 2s on mobile data. There is
    // one route and no vendor split worth making — a single request beats two
    // round trips on a slow connection.
    cssCodeSplit: false,
    reportCompressedSize: true,
  },
});
