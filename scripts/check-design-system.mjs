/**
 * Design-system consistency check.
 *
 * The design contract is only worth what is enforced, so this script turns each
 * sentence of it into a failing assertion:
 *
 *  1. token hygiene — every token is namespaced, unique, and says why it exists;
 *  2. no orphan references — every `var(--ps-*)` in the stylesheets resolves, and
 *     nothing outside the generated file defines a `--ps-*` property;
 *  3. contrast — every declared pair's real WCAG ratio is computed and compared
 *     against its minimum, so a palette cannot pass by assertion;
 *  4. reduced motion — every motion token has an override, and every override is
 *     effectively instantaneous;
 *  5. breakpoints — ascending, starting at the minimum supported width;
 *  6. surface inventory — each surface states its states, its non-colour encoding,
 *     the text equivalent for what it shows visually, the semantic alternative for
 *     anything it does in 3D, and a touch target if it is interactive;
 *  7. loop coverage — the 11 steps in `src/ui/loopSteps.ts` are each owned by
 *     exactly one surface, so the inventory cannot drift from the shipped loop.
 *
 * Run with `npm run check:design`.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BREAKPOINTS,
  CONTRAST_REQUIREMENTS,
  DESIGN_TOKENS,
  REDUCED_MOTION_OVERRIDES,
  TOUCH_TARGET_MIN_PX,
} from "../src/design/tokens.ts";
import { SURFACES } from "../src/design/surfaces.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const VIOLATIONS = [];
const NOTES = [];

function fail(message) {
  VIOLATIONS.push(message);
}

function note(message) {
  NOTES.push(message);
}

// --------------------------------------------------------------------- helpers

function walk(dir, extensions) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, extensions));
    else if (extensions.some((extension) => entry.endsWith(extension))) out.push(full);
  }
  return out;
}

function tokenByName(name) {
  return DESIGN_TOKENS.find((token) => token.name === name);
}

/** Parse `#rrggbb` (the only colour form this system permits) into channels. */
function parseHex(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

/** WCAG 2.1 relative luminance. */
function relativeLuminance([r, g, b]) {
  const channel = (raw) => {
    const scaled = raw / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio between two opaque colours. */
function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// ----------------------------------------------------------------- 1. tokens

const seenNames = new Set();
for (const token of DESIGN_TOKENS) {
  if (!/^--ps-[a-z0-9-]+$/.test(token.name)) {
    fail(`token '${token.name}': names must be --ps-<kebab-case>`);
  }
  if (seenNames.has(token.name)) fail(`token '${token.name}': declared twice`);
  seenNames.add(token.name);
  if (!String(token.value).trim()) fail(`token '${token.name}': empty value`);
  if (!String(token.purpose ?? "").trim()) {
    fail(`token '${token.name}': every token must state its purpose`);
  }
}

// ------------------------------------------------------ 2. no orphan references

const cssFiles = walk(join(root, "src"), [".css"]);
const referenced = new Map();
for (const file of cssFiles) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/var\(\s*(--ps-[a-z0-9-]+)/g)) {
    if (!referenced.has(match[1])) referenced.set(match[1], new Set());
    referenced.get(match[1]).add(relative(root, file));
  }
  const fileRelative = relative(root, file).replace(/\\/g, "/");
  if (fileRelative !== "src/styles/tokens.css") {
    for (const match of text.matchAll(/^\s*(--ps-[a-z0-9-]+)\s*:/gm)) {
      fail(
        `${relative(root, file)}: defines '${match[1]}' outside the generated tokens file. ` +
          "Add it to src/design/tokens.ts and run `npm run build:tokens`.",
      );
    }
  }
}

for (const [name, files] of referenced) {
  if (!tokenByName(name)) {
    fail(`undefined token '${name}' referenced by ${[...files].join(", ")}`);
  }
}

/**
 * Encoding tokens are consumed in TypeScript, not through `var()`.
 *
 * A marker glyph reaches the DOM as a character in a component (`markerGlyph`),
 * and only its CSS-escaped form is emitted as a custom property. So an encoding
 * token is "referenced" when the module that owns the glyphs is imported from TSX,
 * which is the same discipline as a `var()` reference: one definition, read by both
 * consumers. Anything else in this group would be genuinely dead.
 */
const componentSources = walk(join(root, "src"), [".ts", ".tsx"]).filter(
  (file) => !relative(root, file).startsWith("src/design/"),
);
const markerGlyphsAreConsumed = componentSources.some((file) =>
  /markerGlyph|MARKER_ENCODINGS/.test(readFileSync(file, "utf8")),
);

const unused = DESIGN_TOKENS.filter((token) => {
  if (referenced.has(token.name)) return false;
  if (token.group === "layering") return false;
  if (token.group === "encoding") return !markerGlyphsAreConsumed;
  return true;
}).map((token) => token.name);
if (unused.length > 0) {
  // Advisories, not failures: a token may be defined for a surface that PS-05 or
  // PS-06 has not implemented yet, and forcing it out would push authors to inline
  // literals. Reported so the drift is visible.
  note(`${unused.length} token(s) defined but not yet referenced: ${unused.join(", ")}`);
}

// ----------------------------------------------------------------- 3. contrast

const contrastRows = [];
for (const requirement of CONTRAST_REQUIREMENTS) {
  const foreground = tokenByName(requirement.foreground);
  const background = tokenByName(requirement.background);
  if (!foreground || !background) {
    fail(
      `contrast requirement references an unknown token (${requirement.foreground} on ${requirement.background})`,
    );
    continue;
  }
  const fg = parseHex(foreground.value);
  const bg = parseHex(background.value);
  if (!fg || !bg) {
    fail(
      `contrast requirement ${requirement.foreground} on ${requirement.background}: ` +
        "both values must be opaque #rrggbb hex for the ratio to be computable",
    );
    continue;
  }
  const ratio = contrastRatio(fg, bg);
  const ok = ratio >= requirement.minimum;
  contrastRows.push({ ...requirement, ratio, ok });
  if (!ok) {
    fail(
      `contrast ${requirement.foreground} on ${requirement.background}: ` +
        `${ratio.toFixed(2)}:1 is below the required ${requirement.minimum}:1 (${requirement.appliesTo}). ` +
        requirement.note,
    );
  }
}

// ----------------------------------------------------------- 4. reduced motion

/** A duration a reduced-motion override can meaningfully neutralise. */
function isDuration(value) {
  return /^\d+(\.\d+)?(ms|s)$/.test(String(value).trim());
}

const motionTokens = DESIGN_TOKENS.filter((token) => token.group === "motion");
// Only durations need an override. An easing curve has no smaller version of
// itself: shortening a curve is meaningless, which is exactly why motion must be
// expressed as a duration token that can be collapsed rather than as a literal.
const motionDurations = motionTokens.filter((token) => isDuration(token.value));
for (const token of motionDurations) {
  if (!(token.name in REDUCED_MOTION_OVERRIDES)) {
    fail(
      `motion duration '${token.name}' has no reduced-motion override; every motion step must be ` +
        "neutralised under prefers-reduced-motion (docs/ACCESSIBILITY.md A-8)",
    );
  }
}
for (const token of motionTokens) {
  if (!isDuration(token.value) && token.name in REDUCED_MOTION_OVERRIDES) {
    fail(
      `'${token.name}' is not a duration but has a reduced-motion override; ` +
        "an easing curve cannot be neutralised by shortening it",
    );
  }
}
for (const [name, value] of Object.entries(REDUCED_MOTION_OVERRIDES)) {
  if (!tokenByName(name)) fail(`reduced-motion override '${name}' is not a declared token`);
  if (!/^\d+(\.\d+)?ms$/.test(value) || Number.parseFloat(value) > 2) {
    fail(`reduced-motion override '${name}' is '${value}'; it must be effectively instantaneous`);
  }
}

// -------------------------------------------------------------- 5. breakpoints

let previous = 0;
for (const breakpoint of BREAKPOINTS) {
  if (breakpoint.minWidthPx <= previous) {
    fail(`breakpoint '${breakpoint.id}' (${breakpoint.minWidthPx}px) is not above the previous one`);
  }
  previous = breakpoint.minWidthPx;
  if (!String(breakpoint.purpose ?? "").trim()) {
    fail(`breakpoint '${breakpoint.id}' must state what changes at that width`);
  }
}
const phone = BREAKPOINTS.find((breakpoint) => breakpoint.id === "phone");
if (!phone) fail("a 'phone' breakpoint is required: it is the narrowest supported layout");
else if (phone.minWidthPx !== 360) {
  fail(
    `the phone breakpoint is ${phone.minWidthPx}px; docs/UX_USER_FLOW.md §7 requires the semantic ` +
      "UI to work from 360px upward, so the two must agree",
  );
}

const touch = tokenByName("--ps-touch-min");
const touchPx = touch ? Number.parseFloat(touch.value) : Number.NaN;
if (!Number.isFinite(touchPx)) fail("--ps-touch-min must be a px value");
else if (touchPx < TOUCH_TARGET_MIN_PX) {
  fail(`--ps-touch-min is ${touch.value}; it must be at least ${TOUCH_TARGET_MIN_PX}px`);
}

// ------------------------------------------------------- 6. surface inventory

const seenSurfaceIds = new Set();
const claimedLoopSteps = new Map();

for (const surface of SURFACES) {
  const where = `surface '${surface.id}'`;
  if (seenSurfaceIds.has(surface.id)) fail(`${where}: declared twice`);
  seenSurfaceIds.add(surface.id);

  if (!String(surface.purpose ?? "").trim()) fail(`${where}: must state its purpose`);

  if (surface.kind === "loop-step") {
    if (!surface.loopStep) fail(`${where}: a loop-step surface must name its loop step`);
    else {
      if (claimedLoopSteps.has(surface.loopStep)) {
        fail(
          `${where}: loop step '${surface.loopStep}' is already owned by ` +
            `'${claimedLoopSteps.get(surface.loopStep)}'`,
        );
      }
      claimedLoopSteps.set(surface.loopStep, surface.id);
    }
  } else if (surface.loopStep !== null) {
    fail(`${where}: a global-state surface must not claim a loop step`);
  }

  if (!Array.isArray(surface.semantics) || surface.semantics.length === 0) {
    fail(`${where}: must name the roles, landmarks, or accessible names it exposes`);
  }
  if (surface.states.length < 2) {
    fail(`${where}: a surface with fewer than two states has no states to design`);
  }
  const stateIds = new Set();
  for (const state of surface.states) {
    if (stateIds.has(state.id)) fail(`${where}: state '${state.id}' declared twice`);
    stateIds.add(state.id);
    for (const field of ["label", "description", "nonColorSignal"]) {
      if (!String(state[field] ?? "").trim()) {
        fail(`${where}: state '${state.id}' has an empty ${field}`);
      }
    }
  }

  if (!String(surface.nonColorEncoding ?? "").trim()) {
    fail(`${where}: must state how required distinctions are carried without colour (A-9)`);
  }
  if (surface.showsVisualData && !String(surface.textualEquivalent ?? "").trim()) {
    fail(`${where}: shows visual data, so it must name its text or table equivalent (A-13)`);
  }
  if (!surface.showsVisualData && surface.textualEquivalent !== null) {
    fail(`${where}: declares a text equivalent but does not show visual data`);
  }
  if (surface.usesThreeDView && !String(surface.nonPrecisionAlternative ?? "").trim()) {
    fail(`${where}: uses the 3D view, so it must name the semantic route to the same action (A-14)`);
  }
  if (!surface.usesThreeDView && surface.nonPrecisionAlternative !== null) {
    fail(`${where}: declares a non-precision alternative but does not use the 3D view`);
  }
  if (surface.interactive && !String(surface.touchTarget ?? "").trim()) {
    fail(`${where}: interactive, so it must state how its controls meet the touch minimum (A-3)`);
  }
  if (!surface.interactive && surface.touchTarget !== null) {
    fail(`${where}: is not interactive but declares a touch target`);
  }
  if (!String(surface.keyboard ?? "").trim()) {
    fail(`${where}: must state its keyboard behaviour (A-1, A-7)`);
  }
  for (const name of surface.motionTokens) {
    const token = tokenByName(name);
    if (!token) fail(`${where}: motion token '${name}' is not declared`);
    else if (token.group !== "motion") {
      fail(`${where}: '${name}' is a ${token.group} token, not a motion token`);
    }
  }
  // `knownGap` means "what this spec does not have yet, and who owns it". It is
  // required for anything that is not implemented, so an unbuilt surface cannot be
  // read as a finished one, and forbidden for anything that is, so a stale note
  // cannot survive the implementation it described.
  if (surface.maturity === "implemented") {
    if (surface.knownGap !== null) {
      fail(`${where}: is implemented, so it must not still carry a known gap`);
    }
  } else if (!String(surface.knownGap ?? "").trim()) {
    fail(`${where}: maturity '${surface.maturity}' must name what is missing and who owns it`);
  }
}

// ----------------------------------------------------------- 7. loop coverage

const loopStepsSource = readFileSync(join(root, "src/ui/loopSteps.ts"), "utf8");
const union = /export type LoopStepId =([\s\S]*?);/.exec(loopStepsSource);
if (!union) {
  fail("could not read the LoopStepId union from src/ui/loopSteps.ts");
} else {
  const shipped = [...union[1].matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);
  if (shipped.length !== 11) {
    fail(`src/ui/loopSteps.ts declares ${shipped.length} loop steps; the frozen path has 11`);
  }
  for (const step of shipped) {
    const owner = SURFACES.find((surface) => surface.loopStep === step);
    if (!owner) fail(`loop step '${step}' has no surface in the design inventory`);
  }
  for (const [step, owner] of claimedLoopSteps) {
    if (!shipped.includes(step)) {
      fail(`surface '${owner}' claims loop step '${step}', which the shipped loop does not have`);
    }
  }
}

// ------------------------------------------------------------------- reporting

console.log("Design system check");
console.log(`  tokens:      ${DESIGN_TOKENS.length}`);
console.log(`  surfaces:    ${SURFACES.length} (${claimedLoopSteps.size} loop steps covered)`);
console.log(`  css refs:    ${referenced.size} distinct tokens referenced`);
console.log("  contrast:");
for (const row of contrastRows) {
  console.log(
    `    ${row.ok ? "PASS" : "FAIL"}  ${row.ratio.toFixed(2)}:1 ` +
      `(min ${row.minimum})  ${row.foreground} on ${row.background} — ${row.appliesTo}`,
  );
}
const contrastNote =
  `${contrastRows.length} contrast pairs meet their minimum`;
console.log(`  reduced:     ${motionDurations.length} motion durations neutralised`);
for (const advisory of NOTES) console.log(`  note: ${advisory}`);

if (VIOLATIONS.length > 0) {
  console.error("");
  for (const violation of VIOLATIONS) console.error(`FAIL: ${violation}`);
  console.error(`\n${VIOLATIONS.length} design-system problem(s).`);
  process.exit(1);
}

console.log(
  `\nPASS: design system is consistent — ${DESIGN_TOKENS.length} tokens all carry a purpose, ` +
    `${contrastNote}, ${motionDurations.length} motion durations are neutralised under reduced ` +
    `motion, and ${SURFACES.length} surfaces cover the ${claimedLoopSteps.size}-step loop with a ` +
    "stated non-colour encoding.",
);
