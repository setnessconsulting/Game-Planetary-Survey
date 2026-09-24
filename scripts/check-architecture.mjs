/**
 * Architecture boundary enforcement.
 *
 * Encodes docs/TECHNICAL_DESIGN.md §2.1 and §4 as mechanical rules, so the
 * boundaries are testable rather than aspirational. This script is run by
 * `npm run check:architecture`, by `npm run verify`, and by CI — the same script
 * locally and in the cloud.
 *
 * Rules:
 *  1. src/domain is a LEAF module: no React, no Babylon, no other layer, no
 *     browser/DOM API, no ambient time, no ambient randomness, no network.
 *  2. Only src/renderer may call `runRenderLoop` (React must not own the frame
 *     loop).
 *  3. Only src/renderer may import @babylonjs/* (the UI talks to the seam).
 *  4. No source file may import games-site internals or reach outside src/.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const srcRoot = join(root, "src");

const VIOLATIONS = [];

function filesUnder(dir, extensions = [".ts", ".tsx"]) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path, extensions);
    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

const rel = (path) => relative(root, path).split("\\").join("/");

/**
 * Domain purity rules.
 *
 * Patterns rather than an import parser, so the check also catches the indirect
 * escape hatches (globals, ambient time, ambient randomness) that would break
 * deterministic replay and golden fixtures.
 */
const DOMAIN_RULES = [
  [/from\s+["']react(?:-dom)?(?:\/|["'])/, "imports React"],
  [/from\s+["']@babylonjs\//, "imports Babylon"],
  [/from\s+["']@\/(?:ui|renderer|audio|content|assets|platform|styles)(?:\/|["'])/, "imports an upward layer"],
  [/from\s+["'](?:\.\.\/)+(?:ui|renderer|audio|content|assets|platform|styles)(?:\/|["'])/, "imports an upward layer"],
  [/\bwindow\s*(?:\.|\[)/, "reads `window`"],
  [/\btypeof\s+window\b/, "probes `window`"],
  [/\bdocument\s*(?:\.|\[)/, "reads `document`"],
  [/\btypeof\s+document\b/, "probes `document`"],
  [/\bnavigator\s*(?:\.|\[)/, "reads `navigator`"],
  [/\blocalStorage\b/, "uses localStorage"],
  [/\bsessionStorage\b/, "uses sessionStorage"],
  [/\bindexedDB\b/, "uses indexedDB"],
  [/\bXMLHttpRequest\b/, "uses XMLHttpRequest"],
  [/\bWebSocket\b/, "uses WebSocket"],
  [/\brequestAnimationFrame\s*\(/, "drives a frame loop"],
  [/\bMath\.random\s*\(/, "uses ambient randomness (breaks deterministic replay)"],
  [/\bDate\.now\s*\(/, "uses ambient time (breaks deterministic replay)"],
  [/\bnew\s+Date\s*\(/, "uses ambient time (breaks deterministic replay)"],
  [/\bperformance\s*\.\s*now\s*\(/, "uses ambient time"],
  [/\bimport\.meta\b/, "reads bundler metadata"],
  [/\bfetch\s*\(/, "performs network I/O"],
];

const domainFiles = filesUnder(join(srcRoot, "domain"));
for (const path of domainFiles) {
  const source = readFileSync(path, "utf8");
  for (const [pattern, label] of DOMAIN_RULES) {
    if (pattern.test(source)) {
      VIOLATIONS.push(`${rel(path)}: domain ${label}`);
    }
  }
}

// Rule 2: the frame loop has exactly one owner.
for (const path of filesUnder(srcRoot)) {
  if (rel(path).startsWith("src/renderer/")) continue;
  const source = readFileSync(path, "utf8");
  if (/runRenderLoop\s*\(/.test(source)) {
    VIOLATIONS.push(
      `${rel(path)}: calls runRenderLoop outside src/renderer (React must not own the 3D frame loop)`,
    );
  }
}

// Rule 3: Babylon is reached only through the renderer seam.
for (const path of filesUnder(srcRoot)) {
  if (rel(path).startsWith("src/renderer/")) continue;
  const source = readFileSync(path, "utf8");
  if (/["']@babylonjs\//.test(source)) {
    const typeOnly = /^\s*import\s+type\s+[^;]*@babylonjs\//m.test(source);
    if (!typeOnly) {
      VIOLATIONS.push(`${rel(path)}: imports @babylonjs outside src/renderer`);
    }
  }
}

// Rule 4: no reaching outside the repository's own source, and no host coupling.
// Only real import specifiers count here: mentioning games-site in a doc comment
// is legitimate, importing its internals is not.
for (const path of filesUnder(srcRoot)) {
  const source = readFileSync(path, "utf8");
  if (/from\s+["'][^"']*games-site/.test(source) || /require\(\s*["'][^"']*games-site/.test(source)) {
    VIOLATIONS.push(`${rel(path)}: imports games-site internals (the game must not be coupled to its host)`);
  }
  if (/from\s+["'](?:\.\.\/){3,}/.test(source)) {
    VIOLATIONS.push(`${rel(path)}: import escapes src/`);
  }
}

// The domain layer must be TypeScript, never JSX/TSX: JSX means a UI concern.
for (const path of filesUnder(join(srcRoot, "domain"), [".tsx", ".jsx"])) {
  VIOLATIONS.push(`${rel(path)}: domain must not contain JSX files`);
}

if (VIOLATIONS.length > 0) {
  console.error("FAIL: architecture boundary violations\n");
  for (const violation of VIOLATIONS) console.error(`  - ${violation}`);
  console.error(`\n${VIOLATIONS.length} violation(s).`);
  process.exit(1);
}

console.log(
  `PASS: architecture boundaries hold across ${domainFiles.length} domain module(s): ` +
    "domain is framework/browser/network/time/randomness free, the frame loop lives only in src/renderer, " +
    "Babylon is reached only through the renderer seam, and no host coupling exists.",
);
