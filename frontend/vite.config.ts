import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (command === "build" && !env.VITE_API_URL?.trim()) {
    throw new Error("VITE_API_URL is required for production builds");
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // This catalogue is published as CommonJS. Pre-bundle it explicitly so
    // route navigation never requests a stale raw dependency from Vite.
    optimizeDeps: {
      include: ["india-state-district"],
    },
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:5000",
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: false,
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          manualChunks(moduleId) {
            if (!moduleId.includes("node_modules")) return;
            if (
              /node_modules[\\/]react(?:-dom|-router|-router-dom)?[\\/]/.test(
                moduleId,
              )
            )
              return "react";
            if (moduleId.includes("node_modules/leaflet")) return "maps";
            if (moduleId.includes("node_modules/framer-motion"))
              return "motion";
            if (
              ["axios", "@tanstack/react-query", "socket.io-client"].some(
                (dependency) => moduleId.includes(`node_modules/${dependency}`),
              )
            )
              return "network";
          },
        },
      },
    },
  };
});
