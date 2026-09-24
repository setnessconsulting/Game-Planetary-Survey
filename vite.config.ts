import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Planetary Survey ships as a self-contained static artifact beneath a nested
 * versioned base path on games-site:
 *
 *   /game-assets/planetary-survey/<version>/
 *
 * A relative base (`./`) resolves correctly at any nesting depth, so the default
 * build is host-agnostic. `PLANETARY_SURVEY_BASE` (or `--base`) may pin an
 * absolute prefix for a specific release prefix; `scripts/nested-host-server.mjs`
 * exercises the nested case end to end.
 *
 * See docs/RELEASE_CONTRACT.md and docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §8.
 */
const base = process.env.PLANETARY_SURVEY_BASE ?? "./";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    // Source maps are emitted so a real-GPU review can attribute cost; they are
    // not an asset the runtime downloads.
    sourcemap: true,
    // Do NOT module-preload the renderer. Vite would otherwise inject a
    // `<link rel="modulepreload">` for the Babylon chunk into index.html, which
    // makes it part of the initial eager load and breaks the "shell interactive
    // before the renderer loads" budget
    // (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.1-§3.2).
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dependency) => !dependency.includes("renderer")),
    },
    // The renderer is deliberately a separate lazy chunk: the React shell must
    // reach interactive state before Babylon loads.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@babylonjs")) {
            return "renderer-babylon";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "shell-react";
          }
          return undefined;
        },
      },
    },
    // Budgets in docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.2 allow a lazy
    // renderer chunk up to ~1.2 MiB gzip. Vite's default warning threshold is
    // smaller than that, so raise it and rely on `report:bundle` for the real
    // measurement instead of a noisy warning.
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5273,
    // Bind IPv4 explicitly so tooling that probes 127.0.0.1 reaches the server.
    host: "127.0.0.1",
  },
  preview: {
    port: 5274,
    host: "127.0.0.1",
  },
});
