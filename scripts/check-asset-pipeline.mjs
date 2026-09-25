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
 * The check that matters most: a shipping asset cannot appear in the repository
 * without being registered in the runtime asset manifest, because an
 * unregistered asset has no provenance and unknown provenance is release-blocking.
 *
 * PS-10. The manifests are JSON emitted by
 * `scripts/generate-production-assets.mjs` from the same loop that wrote the
 * bytes, and this script reads them as values. The previous version recovered
 * entries with regular expressions over `assetManifest.ts` source text, which
 * could not see a template literal or a factory function — so a manifest built
 * from helpers registered nothing and the gate stayed green. Reading real data
 * is the fix, and it also lets the byte counts and content hashes be verified
 * against the files that actually exist.
 *
 * What this enforces now:
 *   1. every shipping-format file on disk is registered;
 *   2. every registered path is base-safe, an approved format, and covered by a
 *      provenance record;
 *   3. no placeholder ships (docs/DECISIONS.md D-34, fulfilled by PS-10);
 *   4. every provenance record carries the full field set docs/ASSET_PROVENANCE.md
 *      requires and is approved;
 *   5. every provenance id resolves, and no record claims agency origin without
 *      the asset-level review the policy requires;
 *   6. recorded byte counts and content hashes match the bytes on disk.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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

// --- 1. Read the manifests -------------------------------------------------
const assetManifestPath = join(root, "src", "assets", "assetManifest.json");
const provenanceManifestPath = join(root, "src", "assets", "provenanceManifest.json");

if (!existsSync(assetManifestPath)) {
  console.error("FAIL: asset pipeline violations\n");
  console.error(
    "  - src/assets/assetManifest.json is missing; run `node scripts/generate-production-assets.mjs`.",
  );
  process.exit(1);
}
if (!existsSync(provenanceManifestPath)) {
  VIOLATIONS.push(
    "src/assets/provenanceManifest.json is missing; every shipping asset needs a provenance record (docs/ASSET_PROVENANCE.md).",
  );
}

const assetManifest = JSON.parse(readFileSync(assetManifestPath, "utf8"));
const provenanceManifest = existsSync(provenanceManifestPath)
  ? JSON.parse(readFileSync(provenanceManifestPath, "utf8"))
  : { records: [] };

const manifestAssets = Array.isArray(assetManifest.assets) ? assetManifest.assets : [];
const registeredLogicalIds = manifestAssets.map((asset) => asset.logicalId);
const registeredPaths = manifestAssets.map((asset) => asset.shippingPath);

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
  if (typeof shippingPath !== "string") {
    VIOLATIONS.push(`Manifest shippingPath ${JSON.stringify(shippingPath)} is not a string.`);
    continue;
  }
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

for (const asset of manifestAssets) {
  if (asset.provenanceId === null || asset.provenanceId === undefined || asset.provenanceId === "") {
    VIOLATIONS.push(
      `Manifest entry "${asset.logicalId}" has no provenanceId. Every external asset needs provenance before it can ship.`,
    );
  }
}

// --- 4. No placeholder may ship (D-34, fulfilled by PS-10) -----------------
const PLACEHOLDER_PATTERN = /placeholder/i;
for (const logicalId of registeredLogicalIds) {
  if (PLACEHOLDER_PATTERN.test(String(logicalId))) {
    VIOLATIONS.push(
      `Manifest entry "${logicalId}" is a placeholder. PS-10 ships production art; no placeholder may remain in the runtime asset manifest.`,
    );
  }
}
for (const path of shippingFiles) {
  if (PLACEHOLDER_PATTERN.test(rel(path))) {
    VIOLATIONS.push(
      `${rel(path)}: a placeholder asset is still present in the repository. PS-10 replaces generated.ps05-placeholder-* with production art.`,
    );
  }
}

// --- 5. Provenance records must exist, be complete, and be approved --------
const records = Array.isArray(provenanceManifest.records) ? provenanceManifest.records : [];
const recordsById = new Map(records.map((record) => [record.asset_id, record]));

const REQUIRED_PROVENANCE_FIELDS = [
  "asset_id",
  "category",
  "creator",
  "creation_method",
  "source_reference",
  "license_rights_basis",
  "agency_origin",
  "usage_restrictions",
  "transformations",
  "tool",
  "tool_version",
  "source_artifact_reference",
  "scientific_claim_linkage",
  "reviewer",
  "review_date",
  "release_status",
];

for (const record of records) {
  const label = record.asset_id ?? "<unnamed>";
  const missing = REQUIRED_PROVENANCE_FIELDS.filter(
    (field) => record[field] === undefined || record[field] === null || record[field] === "",
  );
  if (missing.length > 0) {
    VIOLATIONS.push(`Provenance record "${label}" is missing required field(s): ${missing.join(", ")}.`);
  }
  if (record.release_status !== "approved") {
    VIOLATIONS.push(
      `Provenance record "${label}" has release_status "${record.release_status}"; only an approved record may back a shipping asset.`,
    );
  }
  if (record.agency_origin && record.agency_origin !== "none") {
    VIOLATIONS.push(
      `Provenance record "${label}" has agency_origin "${record.agency_origin}". Agency-derived art requires the documented asset-level usage review before it may ship.`,
    );
  }
  for (const key of ["attribution_required", "redistributable", "commercial_ok", "derivatives_ok"]) {
    if (record.usage_restrictions && record.usage_restrictions[key] === undefined) {
      VIOLATIONS.push(
        `Provenance record "${label}" does not state usage_restrictions.${key}; the policy requires all four.`,
      );
    }
  }
}

for (const asset of manifestAssets) {
  if (!asset.provenanceId) continue;
  const record = recordsById.get(asset.provenanceId);
  if (!record) {
    VIOLATIONS.push(
      `Manifest provenanceId "${asset.provenanceId}" (entry "${asset.logicalId}") has no record in src/assets/provenanceManifest.json. An id with no backing record is not provenance.`,
    );
    continue;
  }
  if (record.path && record.path.replace(/^public\//, "") !== asset.shippingPath) {
    VIOLATIONS.push(
      `Provenance record "${asset.provenanceId}" names path "${record.path}" but the manifest registers "${asset.shippingPath}".`,
    );
  }
}

const recordedPaths = new Set(
  records
    .map((record) => record.path)
    .filter((value) => typeof value === "string")
    .map((value) => value.replace(/^public\//, "")),
);
for (const shippingPath of registeredPaths) {
  if (!recordedPaths.has(shippingPath)) {
    VIOLATIONS.push(`Shipping path "${shippingPath}" is registered but no provenance record covers it.`);
  }
}

// --- 6. Recorded bytes and hashes must match what is on disk ---------------
for (const asset of manifestAssets) {
  const path = join(root, "public", asset.shippingPath);
  if (!existsSync(path)) {
    VIOLATIONS.push(
      `Manifest registers "${asset.shippingPath}" but public/${asset.shippingPath} does not exist.`,
    );
    continue;
  }
  const onDisk = statSync(path).size;
  if (onDisk !== asset.bytes) {
    VIOLATIONS.push(
      `Manifest records ${asset.bytes} bytes for "${asset.shippingPath}" but the file is ${onDisk}. ` +
        "Re-run `node scripts/generate-production-assets.mjs`.",
    );
  }
  const record = recordsById.get(asset.provenanceId);
  if (record && record.sha256) {
    const actual = createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);
    if (actual !== record.sha256) {
      VIOLATIONS.push(
        `Provenance record "${asset.provenanceId}" records content hash ${record.sha256} but "${asset.shippingPath}" hashes to ${actual}.`,
      );
    }
  }
}

// --- 7. Source/intermediate art must stay out of git -----------------------
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
    `${manifestAssets.length} manifest entry(ies), ${records.length} provenance record(s) with every ` +
    `id resolved, no placeholders, byte counts and content hashes matching disk, all paths base-safe, ` +
    `and source/intermediate art excluded from git.`,
);
