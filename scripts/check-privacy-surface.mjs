/**
 * Privacy and runtime-surface enforcement.
 *
 * Encodes docs/PRIVACY_AND_PERSISTENCE.md §2-§3 as mechanical rules. Planetary
 * Survey is used by minors in school settings, and v1 is local-first: no remote
 * service is required to play, and no learner data leaves the device.
 *
 * What this guards:
 *  - the runtime dependency set stays on an explicit allowlist (a new dependency
 *    that phones home or inflates the trust surface fails loudly);
 *  - no network or persistence API appears anywhere in src/ without a deliberate
 *    decision recorded here;
 *  - no analytics/telemetry/error-reporting SDK marker appears in src/;
 *  - absolute URLs are permitted ONLY in src/content/, where they are source
 *    citations for the per-field source register (docs/SCIENCE_MODEL.md §5.2) and
 *    not network calls.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const srcRoot = join(root, "src");

const VIOLATIONS = [];

/**
 * Approved runtime dependencies, and why each one exists.
 * Adding one requires updating this list deliberately, in the same change.
 */
const APPROVED_RUNTIME_DEPENDENCIES = new Map([
  ["@babylonjs/core", "3D renderer required by the architecture (docs/TECHNOLOGY_DECISIONS.md §6)"],
  ["@babylonjs/loaders", "glTF/GLB runtime asset loading (docs/TECHNICAL_DESIGN.md §8)"],
  ["react", "semantic application shell (docs/TECHNICAL_DESIGN.md §4)"],
  ["react-dom", "DOM renderer for the shell"],
]);

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const runtimeDependencies = Object.keys(packageJson.dependencies ?? {});

for (const name of runtimeDependencies) {
  if (!APPROVED_RUNTIME_DEPENDENCIES.has(name)) {
    VIOLATIONS.push(
      `package.json: unapproved runtime dependency "${name}". Adding one is a deliberate trust-surface decision.`,
    );
  }
}

const NETWORK_AND_STORAGE_RULES = [
  [/\bfetch\s*\(/, "uses fetch()"],
  [/\bXMLHttpRequest\b/, "uses XMLHttpRequest"],
  [/\bWebSocket\b/, "uses WebSocket"],
  [/\bEventSource\b/, "uses EventSource"],
  [/\bsendBeacon\b/, "uses navigator.sendBeacon"],
  [/\blocalStorage\b/, "uses localStorage (persistence must go through one reviewed adapter)"],
  [/\bsessionStorage\b/, "uses sessionStorage (persistence must go through one reviewed adapter)"],
  [/\bindexedDB\b/, "uses indexedDB"],
  [
    /from\s+["'][^"']*(?:gtag|segment|mixpanel|posthog|amplitude|plausible|sentry|datadog|fullstory|newrelic|roarr)[^"']*["']/i,
    "imports an analytics/telemetry SDK",
  ],
  // Analytics globals, matched only in call/member position so ordinary English
  // (for example the word "segment" describing a path) is not a false positive.
  [/\b(?:gtag|dataLayer|mixpanel|posthog|plausible|Sentry|datadogRum|newrelic)\s*[(.]/, "uses an analytics/telemetry global"],
  [/\bnew\s+Image\s*\(\s*\)/, "may craft a tracking pixel"],
];

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

for (const path of filesUnder(srcRoot)) {
  const source = readFileSync(path, "utf8");
  const relativePath = rel(path);

  for (const [pattern, label] of NETWORK_AND_STORAGE_RULES) {
    if (pattern.test(source)) {
      VIOLATIONS.push(`${relativePath}: ${label}`);
    }
  }

  // Absolute URLs are source citations, and only content/ may hold them.
  if (/["']https?:\/\//.test(source) && !relativePath.startsWith("src/content/")) {
    VIOLATIONS.push(
      `${relativePath}: contains an absolute URL. Only src/content/ may hold source citations.`,
    );
  }
}

if (VIOLATIONS.length > 0) {
  console.error("FAIL: runtime privacy surface violations\n");
  for (const violation of VIOLATIONS) console.error(`  - ${violation}`);
  console.error(`\n${VIOLATIONS.length} violation(s).`);
  process.exit(1);
}

console.log(
  `PASS: ${runtimeDependencies.length} approved runtime dependencies; no network, persistence, ` +
    "analytics, or telemetry surface in src/. No remote service is required to play.",
);
