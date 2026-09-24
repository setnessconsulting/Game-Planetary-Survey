/**
 * Nested-base production build.
 *
 * Builds the artifact at the exact prefix games-site serves it from:
 *
 *   /game-assets/planetary-survey/<version>/
 *
 * Why this exists rather than a one-line npm script: the version appears in the
 * deployment prefix AND in package.json, and duplicating it in a script string
 * guarantees it eventually drifts. Here the prefix is DERIVED from the package
 * version, so the artifact and the release identity can never disagree.
 * `scripts/create-release-manifest.mjs` reads the same package version, so the
 * manifest, the prefix, and the release contract all agree by construction.
 *
 * The default `npm run build` deliberately keeps the relative base (`./`) because a
 * relative base resolves correctly at any nesting depth. This script exists to prove
 * the version-pinned absolute prefix also works, which is what
 * `tests/host/nestedAssetBase.spec.ts` asserts.
 *
 * docs/RELEASE_CONTRACT.md §4, docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §8.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const base = `/game-assets/planetary-survey/${version}/`;

// Invoke Vite through its own entry point rather than a shell. `npx` and string
// interpolation both behave differently across cmd.exe, PowerShell, and Git Bash,
// and Git Bash additionally rewrites POSIX-looking arguments like `--base=/...`
// into Windows paths, which silently produces a broken index.html.
const vite = join(root, "node_modules", "vite", "bin", "vite.js");

console.log(`Building nested artifact at base ${base}`);

execFileSync(process.execPath, [vite, "build", `--base=${base}`], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PLANETARY_SURVEY_BASE: base },
});
