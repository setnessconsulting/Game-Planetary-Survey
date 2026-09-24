/**
 * Bundle-size report and budget enforcement.
 *
 * Makes the budgets in docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3 mechanically
 * enforceable, and guards the architecture decision that the React shell reaches
 * interactive state BEFORE Babylon loads.
 *
 * The lazy-chunk guard is the important one: if a future change adds a static
 * import of Babylon (or lets Vite module-preload it), the renderer silently
 * rejoins the initial eager payload and the shell budget is spent on the engine.
 * This check fails loudly instead.
 */

import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");

const KiB = 1024;

/** Budgets, from docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3. */
const BUDGETS = {
  eagerJsGzipKiB: 250,
  eagerCssAndHtmlGzipKiB: 60,
  lazyRendererChunkGzipKiB: 1.2 * 1024,
};

if (!existsSync(dist)) {
  console.error("FAIL: dist/ does not exist. Run `npm run build` first.");
  process.exit(1);
}

function walk(dir, accumulator = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, accumulator);
    else accumulator.push(path);
  }
  return accumulator;
}

const indexHtml = readFileSync(join(dist, "index.html"), "utf8");
const eagerReferences = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) =>
  match[1].replace(/^\.\//, ""),
);

const allFiles = walk(dist)
  .map((path) => relative(dist, path).split("\\").join("/"))
  .filter((path) => !path.endsWith(".map") && path !== "release-manifest.json");

const rows = allFiles.map((path) => {
  const absolute = join(dist, path);
  const bytes = statSync(absolute).size;
  const buffer = readFileSync(absolute);
  return {
    path,
    rawKiB: bytes / KiB,
    gzipKiB: gzipSync(buffer).length / KiB,
    eager: eagerReferences.includes(path) || path === "index.html",
  };
});

const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);

const eagerJs = rows.filter((row) => row.eager && row.path.endsWith(".js"));
const eagerCss = rows.filter((row) => row.eager && row.path.endsWith(".css"));
const html = rows.filter((row) => row.path === "index.html");
const lazy = rows.filter((row) => !row.eager);

const eagerJsGzip = sum(eagerJs, "gzipKiB");
const eagerCssGzip = sum(eagerCss, "gzipKiB") + sum(html, "gzipKiB");
const rendererChunks = rows.filter((row) => /babylon/.test(row.path));

const failures = [];

if (eagerJsGzip > BUDGETS.eagerJsGzipKiB) {
  failures.push(
    `Eager JS is ${eagerJsGzip.toFixed(1)} KiB gzip, over the ${BUDGETS.eagerJsGzipKiB} KiB budget.`,
  );
}
if (eagerCssGzip > BUDGETS.eagerCssAndHtmlGzipKiB) {
  failures.push(
    `Eager CSS + HTML is ${eagerCssGzip.toFixed(1)} KiB gzip, over the ${BUDGETS.eagerCssAndHtmlGzipKiB} KiB budget.`,
  );
}

const largestRenderer = rendererChunks.reduce((max, row) => Math.max(max, row.gzipKiB), 0);
if (largestRenderer > BUDGETS.lazyRendererChunkGzipKiB) {
  failures.push(
    `Renderer chunk is ${largestRenderer.toFixed(1)} KiB gzip, over the ${BUDGETS.lazyRendererChunkGzipKiB.toFixed(1)} KiB budget.`,
  );
}

// --- The lazy-chunk guard --------------------------------------------------
const eagerRenderer = rows.filter((row) => row.eager && /babylon|renderer/.test(row.path));
if (eagerRenderer.length > 0) {
  failures.push(
    `The renderer is part of the initial eager payload: ${eagerRenderer.map((row) => row.path).join(", ")}. ` +
      "The React shell must become interactive before Babylon loads " +
      "(docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §3.1-§3.2).",
  );
}
if (rendererChunks.length === 0) {
  failures.push(
    "No renderer chunk was emitted at all. The lazy renderer seam is missing from the build.",
  );
}

// --- Report ---------------------------------------------------------------
const report = {
  generatedFrom: "scripts/report-bundle-size.mjs",
  budgets: BUDGETS,
  totals: {
    eagerJsGzipKiB: Number(eagerJsGzip.toFixed(2)),
    eagerCssAndHtmlGzipKiB: Number(eagerCssGzip.toFixed(2)),
    lazyGzipKiB: Number(sum(lazy, "gzipKiB").toFixed(2)),
  },
  assets: rows
    .map((row) => ({
      path: row.path,
      rawKiB: Number(row.rawKiB.toFixed(2)),
      gzipKiB: Number(row.gzipKiB.toFixed(2)),
      eager: row.eager,
    }))
    .sort((left, right) => right.gzipKiB - left.gzipKiB),
  failures,
};

const reportsDir = join(root, "reports");
mkdirSync(reportsDir, { recursive: true });
writeFileSync(join(reportsDir, "bundle-size.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("Bundle size (gzip) — eager vs lazy");
for (const row of report.assets) {
  console.log(
    `  ${row.eager ? "eager" : "lazy "}  ${row.gzipKiB.toFixed(1).padStart(8)} KiB  ${row.path}`,
  );
}
console.log(
  `\n  eager JS            ${eagerJsGzip.toFixed(1)} / ${BUDGETS.eagerJsGzipKiB} KiB\n` +
    `  eager CSS + HTML    ${eagerCssGzip.toFixed(1)} / ${BUDGETS.eagerCssAndHtmlGzipKiB} KiB\n` +
    `  largest lazy renderer chunk ${largestRenderer.toFixed(1)} / ${BUDGETS.lazyRendererChunkGzipKiB.toFixed(1)} KiB`,
);

if (failures.length > 0) {
  console.error("\nFAIL: bundle budgets\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nPASS: bundle budgets hold and the renderer stays out of the initial eager payload.");
