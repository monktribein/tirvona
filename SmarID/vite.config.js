import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The public Smart Contact page.
 *
 * `base: "/c/"` matters: the app is mounted under that path in production
 * (spec §5), so asset URLs have to be emitted relative to it or a scan lands
 * on a page that 404s its own JavaScript.
 *
 * Port 5175 keeps it clear of the platform SPA (5173) and the lead field app
 * (5174), so all three can run at once during development.
 */
export default defineConfig({
  base: "/c/",
  plugins: [react()],
  server: {
    port: 5175,
  },
  build: {
    // Spec §39 asks for a page that loads in under 2s on mobile data. There is
    // one route and no vendor split worth making — a single request beats two
    // round trips on a slow connection.
    cssCodeSplit: false,
    reportCompressedSize: true,
  },
});
