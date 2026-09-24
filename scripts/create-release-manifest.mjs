/**
 * Release manifest.
 *
 * Implements the minimum identity fields required by
 * docs/RELEASE_CONTRACT.md §5 and docs/TECHNICAL_DESIGN.md §14.
 *
 *   node scripts/create-release-manifest.mjs dist            # write the manifest
 *   node scripts/create-release-manifest.mjs dist --check    # verify it matches
 *
 * `--check` is what makes an immutable candidate verifiable: it recomputes every
 * artifact hash and the source SHA and fails if either drifted. Promotion must
 * use the exact approved artifact identity, so drift has to be detectable.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = resolve(root, process.argv[2] ?? "dist");
const check = process.argv.includes("--check");
const MANIFEST_NAME = "release-manifest.json";

if (!existsSync(target)) {
  console.error(`FAIL: ${relative(root, target)} does not exist. Run the build first.`);
  process.exit(1);
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

function walk(dir, accumulator = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, accumulator);
    else accumulator.push(path);
  }
  return accumulator;
}

function sourceSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function lockIdentity() {
  const lockPath = join(root, "package-lock.json");
  if (!existsSync(lockPath)) return "no-lockfile";
  return sha256(readFileSync(lockPath));
}

function catalogueVersion() {
  const contentPath = join(root, "src", "content", "index.ts");
  if (!existsSync(contentPath)) return "unknown";
  const source = readFileSync(contentPath, "utf8");
  const match = /CATALOGUE_SOURCE_REGISTER_VERSION\s*=\s*["'`]([^"'`]+)["'`]/.exec(source);
  return match ? match[1] : "unknown";
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const files = walk(target)
  .map((path) => relative(target, path).split("\\").join("/"))
  .filter((path) => path !== MANIFEST_NAME)
  .sort()
  .map((path) => {
    const buffer = readFileSync(join(target, path));
    return { path, bytes: buffer.length, sha256: sha256(buffer) };
  });

if (check) {
  const manifestPath = join(target, MANIFEST_NAME);
  if (!existsSync(manifestPath)) {
    console.error(`FAIL: ${MANIFEST_NAME} is missing; the candidate has no verifiable identity.`);
    process.exit(1);
  }
  const existing = JSON.parse(readFileSync(manifestPath, "utf8"));
  const problems = [];

  const currentSourceSha = sourceSha();
  if (existing.sourceSha !== currentSourceSha) {
    problems.push(
      `source SHA drifted: manifest has ${existing.sourceSha}, HEAD is ${currentSourceSha}`,
    );
  }

  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const recorded of existing.files ?? []) {
    const actual = byPath.get(recorded.path);
    if (!actual) {
      problems.push(`${recorded.path} is recorded in the manifest but missing from the artifact`);
      continue;
    }
    if (actual.sha256 !== recorded.sha256) {
      problems.push(`${recorded.path} content hash changed`);
    }
    byPath.delete(recorded.path);
  }
  for (const extra of byPath.keys()) {
    problems.push(`${extra} is in the artifact but not recorded in the manifest`);
  }

  if (problems.length > 0) {
    console.error("FAIL: release manifest does not match the artifact\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  console.log(
    `PASS: release manifest matches the artifact exactly (${files.length} files, source ${existing.sourceSha.slice(0, 12)}).`,
  );
  process.exit(0);
}

const manifest = {
  schemaVersion: 1,
  gameSlug: "planetary-survey",
  releaseVersion: packageJson.version,
  sourceSha: sourceSha(),
  buildTimestamp: process.env.PLANETARY_SURVEY_BUILD_TIME ?? new Date().toISOString(),
  contentVersion: catalogueVersion(),
  dependencyLockIdentity: lockIdentity(),
  entrypoint: "index.html",
  rendererBaseline: { required: "webgl2", enhancement: "webgpu", enhancementIsOptional: true },
  assetManifestVersion: "0.1.0",
  files,
};

mkdirSync(target, { recursive: true });
writeFileSync(join(target, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(
  `Wrote ${MANIFEST_NAME}: ${files.length} files, version ${manifest.releaseVersion}, source ${manifest.sourceSha.slice(0, 12)}, content ${manifest.contentVersion}.`,
);
