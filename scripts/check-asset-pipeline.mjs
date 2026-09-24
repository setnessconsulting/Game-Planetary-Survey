/**
 * Asset pipeline enforcement.
 *
 * Encodes docs/TECHNICAL_DESIGN.md §8 and docs/ASSET_PROVENANCE.md.
 *
 * The pipeline has three deliberately separate stages:
 *
 *   source art / external DCC   -> tracked, never shipped as-is
 *   intermediate / derived      -> regenerable, excluded from the shipping build
 *   shipping optimized          -> what the browser downloads
 *
 * The check that matters most right now: a shipping asset cannot appear in the
 * repository without being registered in the runtime asset manifest, because an
 * unregistered asset has no provenance and unknown provenance is release-blocking.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

const VIOLATIONS = [];

/** Formats that may ship to a browser. */
const SHIPPING_EXTENSIONS = new Set([
  ".glb",
  ".gltf",
  ".ktx2",
  ".basis",
  ".png",
  ".webp",
  ".jpg",
  ".jpeg",
  ".hdr",
  ".exr",
  ".ogg",
  ".mp3",
  ".wav",
]);

/** Directories that are build output, dependencies, or test artifacts. */
const IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
  "blob-report",
  ".vite",
  // Source art is intentionally NOT scanned for shipping format: it is where
  // unoptimized working files are allowed to live. Its exclusion is enforced by
  // .gitignore instead.
  "art",
]);

function walk(dir, accumulator = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      walk(join(dir, entry.name), accumulator);
    } else {
      accumulator.push(join(dir, entry.name));
    }
  }
  return accumulator;
}

const rel = (path) => relative(root, path).split("\\").join("/");

// --- 1. Read the runtime asset manifest ------------------------------------
const manifestPath = join(root, "src", "assets", "assetManifest.ts");
if (!existsSync(manifestPath)) {
  VIOLATIONS.push("src/assets/assetManifest.ts is missing; the runtime asset contract is required.");
}
const manifestSource = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";
const registeredLogicalIds = [...manifestSource.matchAll(/logicalId:\s*["'`]([^"'`]+)["'`]/g)].map(
  (match) => match[1],
);
const registeredPaths = [...manifestSource.matchAll(/shippingPath:\s*["'`]([^"'`]+)["'`]/g)].map(
  (match) => match[1],
);

// --- 2. Every shipping-format file in the repository must be registered -----
const repositoryFiles = walk(root);
const shippingFiles = repositoryFiles.filter((path) =>
  SHIPPING_EXTENSIONS.has(extname(path).toLowerCase()),
);

for (const path of shippingFiles) {
  const relativePath = rel(path);
  const registered = registeredPaths.some(
    (shippingPath) =>
      relativePath === shippingPath ||
      relativePath.endsWith(`/${shippingPath}`) ||
      relativePath === `public/${shippingPath}`,
  );
  if (!registered) {
    VIOLATIONS.push(
      `${relativePath}: shipping-format asset is not registered in the runtime asset manifest. ` +
        "An unregistered asset has no provenance, and unknown provenance is release-blocking.",
    );
  }
}

if (shippingFiles.length > 0 && registeredLogicalIds.length === 0) {
  VIOLATIONS.push(
    `${shippingFiles.length} shipping asset(s) exist but the manifest registers none.`,
  );
}

// --- 3. Declared shipping paths must be safe and provenance-complete --------
for (const shippingPath of registeredPaths) {
  if (shippingPath.startsWith("/") || shippingPath.includes("\\") || shippingPath.includes("..")) {
    VIOLATIONS.push(
      `Manifest shippingPath "${shippingPath}" is unsafe: it must be relative, forward-slashed, and must not escape the version base.`,
    );
    continue;
  }
  if (shippingPath.includes("art/source") || shippingPath.includes("intermediate")) {
    VIOLATIONS.push(
      `Manifest shippingPath "${shippingPath}" points at source/intermediate art. Only optimized shipping bytes may be referenced.`,
    );
  }
  if (!SHIPPING_EXTENSIONS.has(extname(shippingPath).toLowerCase())) {
    VIOLATIONS.push(
      `Manifest shippingPath "${shippingPath}" is not an approved shipping format.`,
    );
  }
}

const entriesMissingProvenance = [
  ...manifestSource.matchAll(/logicalId:\s*["'`]([^"'`]+)["'`][\s\S]{0,600}?provenanceId:\s*null/g),
].map((match) => match[1]);
for (const logicalId of entriesMissingProvenance) {
  VIOLATIONS.push(
    `Manifest entry "${logicalId}" has no provenanceId. Every external asset needs provenance before it can ship.`,
  );
}

// --- 4. Source/intermediate art must stay out of git -----------------------
const gitignorePath = join(root, ".gitignore");
const gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
for (const required of ["art/source", "art/intermediate"]) {
  if (!gitignore.includes(required)) {
    VIOLATIONS.push(
      `.gitignore does not exclude "${required}" (source/intermediate art must not be committed as shipping bytes).`,
    );
  }
}

if (VIOLATIONS.length > 0) {
  console.error("FAIL: asset pipeline violations\n");
  for (const violation of VIOLATIONS) console.error(`  - ${violation}`);
  console.error(`\n${VIOLATIONS.length} violation(s).`);
  process.exit(1);
}

console.log(
  `PASS: asset pipeline is consistent — ${shippingFiles.length} shipping-format file(s) on disk, ` +
    `${registeredLogicalIds.length} manifest entry(ies), all paths base-safe, and source/intermediate art excluded from git.`,
);
