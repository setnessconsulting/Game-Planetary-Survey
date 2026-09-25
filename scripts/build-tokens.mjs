/**
 * Generate `src/styles/tokens.css` from `src/design/tokens.ts`.
 *
 * The direction is the point: the token list is the specification, with a purpose
 * written beside every value, and the stylesheet is a build artefact of it. Hand
 * editing the CSS would put two sources of truth in the repository and make the
 * purpose notes decorative.
 *
 * Node 24 loads a dependency-free `.ts` file directly (type stripping), which is
 * why `src/design/tokens.ts` imports nothing at all.
 *
 *     node scripts/build-tokens.mjs            # rewrite the stylesheet
 *     node scripts/build-tokens.mjs --check    # fail if it is out of date
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DESIGN_TOKENS, REDUCED_MOTION_OVERRIDES } from "../src/design/tokens.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const cssPath = resolve(root, "src/styles/tokens.css");

const BANNER = `/**
 * Design tokens — GENERATED FILE, DO NOT EDIT.
 *
 * Source of truth: \`src/design/tokens.ts\`, where every token carries the reason it
 * exists. Regenerate with \`npm run build:tokens\`; \`npm run check:tokens\` fails the
 * build when this file and that source disagree, so hand edits here are lost on
 * purpose rather than silently winning.
 *
 * Ownership: PS-DESIGN (GAME-367), superseding the PS-02 foundation tokens. See
 * \`docs/DESIGN_SYSTEM.md\`.
 */`;

const HEADER_COMMENT = `/**
 * Declared contrast requirements for these values live in \`src/design/tokens.ts\`
 * (\`CONTRAST_REQUIREMENTS\`), and \`npm run check:design\` computes the real WCAG
 * ratios for each pair rather than trusting the palette.
 */`;

/** Every token that must reach CSS. Breakpoints are deliberately not emitted. */
export function renderTokensCss(tokens = DESIGN_TOKENS, reduced = REDUCED_MOTION_OVERRIDES) {
  const lines = [BANNER, "", ":root {", "  color-scheme: dark;"];

  let currentGroup = null;
  for (const token of tokens) {
    if (token.group !== currentGroup) {
      currentGroup = token.group;
      lines.push("", `  /* ${currentGroup} */`);
    }
    lines.push(`  /* ${token.purpose} */`);
    lines.push(`  ${token.name}: ${token.value};`);
  }

  lines.push("}", "", "/**");
  lines.push(" * Reduced motion: every motion token is neutralised, not removed.");
  lines.push(" *");
  lines.push(" * A 1ms transition still fires the transition events a renderer may rely on");
  lines.push(" * and still avoids a flash of un-styled final state, while removing every");
  lines.push(" * perceptible movement. The camera token is included because a rule the");
  lines.push(" * renderer can opt out of is not a rule (docs/ACCESSIBILITY.md A-8).");
  lines.push(" */");
  lines.push("@media (prefers-reduced-motion: reduce) {");
  lines.push("  :root {");
  for (const [name, value] of Object.entries(reduced)) {
    lines.push(`    ${name}: ${value};`);
  }
  lines.push("  }");
  lines.push("}");
  lines.push("");
  lines.push(HEADER_COMMENT);
  lines.push("");

  return lines.join("\n");
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const expected = renderTokensCss();

  let actual;
  try {
    actual = readFileSync(cssPath, "utf8");
  } catch {
    actual = undefined;
  }

  if (checkOnly) {
    if (actual === expected) {
      console.log(`PASS: src/styles/tokens.css matches src/design/tokens.ts (${DESIGN_TOKENS.length} tokens).`);
      return 0;
    }
    if (actual === undefined) {
      console.error("FAIL: src/styles/tokens.css is missing; run `npm run build:tokens`.");
      return 1;
    }
    const expectedLines = expected.split("\n");
    const actualLines = actual.split("\n");
    const firstDiff = expectedLines.findIndex((line, index) => line !== actualLines[index]);
    console.error(
      "FAIL: src/styles/tokens.css does not match src/design/tokens.ts. " +
        "Run `npm run build:tokens` (do not hand edit the stylesheet).",
    );
    if (firstDiff >= 0) {
      console.error(`  first difference at line ${firstDiff + 1}`);
      console.error(`  expected: ${expectedLines[firstDiff]}`);
      console.error(`  actual:   ${actualLines[firstDiff] ?? "<missing>"}`);
    }
    return 1;
  }

  writeFileSync(cssPath, expected, "utf8");
  console.log(`Wrote src/styles/tokens.css: ${DESIGN_TOKENS.length} tokens.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
