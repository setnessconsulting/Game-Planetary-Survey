/**
 * Motion conformance (GAME-374).
 *
 * docs/DESIGN_SYSTEM.md §6. The tokens and the reduced-motion block were
 * already correct; what was missing was proof that anything *used* them. The
 * gap was concrete: `cameraModes.ts` declared its own `CAMERA_TRANSITION_MS =
 * 900` while `--ps-motion-camera` said 640 ms, so the product had two camera
 * durations and editing the token would have moved the DOM but not the camera.
 *
 * These tests defend three things:
 *  1. the renderer reads the token, so there is one camera duration;
 *  2. reduced motion collapses every duration, including the camera step, to
 *     1 ms rather than removing it;
 *  3. nothing hard-codes a duration, so the hierarchy cannot grow a second,
 *     contradictory source of truth.
 */

import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CAMERA_MOTION,
  MOTION_INVARIANTS,
  MOTION_TOKENS,
  cameraTransitionMs,
  type MotionTokenName,
} from "@/design/motion";
import { REDUCED_MOTION_OVERRIDES } from "@/design/tokens";

const root = resolve(__dirname, "..", "..");
const MOTION_NAMES: MotionTokenName[] = [
  "--ps-motion-fast",
  "--ps-motion-base",
  "--ps-motion-slow",
  "--ps-motion-camera",
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if ([".ts", ".tsx", ".css"].includes(extname(entry.name))) {
      out.push(path);
    }
  }
  return out;
}

/** Remove block and line comments so documentation is not scanned as code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("motion tokens", () => {
  it("declares all four steps of the hierarchy", () => {
    expect(Object.keys(MOTION_TOKENS).sort()).toEqual([...MOTION_NAMES].sort());
  });

  it("keeps the hierarchy strictly increasing, so each step is distinguishable", () => {
    const durations = MOTION_NAMES.map((name) => MOTION_TOKENS[name].durationMs);
    const sorted = [...durations].sort((a, b) => a - b);
    expect(durations).toEqual(sorted);
    expect(new Set(durations).size).toBe(durations.length);
  });

  it("collapses every duration to 1 ms under reduced motion, camera included", () => {
    for (const name of MOTION_NAMES) {
      expect(MOTION_TOKENS[name].reducedDurationMs, name).toBe(1);
    }
  });

  it("uses 1 ms rather than none, so transition events still fire", () => {
    // §6: a 1 ms transition "still fires the transition events an implementation
    // may rely on and still avoids a flash of unstyled final state".
    expect(MOTION_INVARIANTS.reducedMotionIsCollapsedNotRemoved).toBe(true);
    for (const name of MOTION_NAMES) {
      expect(REDUCED_MOTION_OVERRIDES[name], name).toBe("1ms");
    }
  });

  it("does not override the easing curve", () => {
    expect(MOTION_INVARIANTS.easingIsNotOverridden).toBe(true);
    expect(REDUCED_MOTION_OVERRIDES["--ps-ease"]).toBeUndefined();
  });

  it("states each token's purpose", () => {
    for (const name of MOTION_NAMES) {
      expect(MOTION_TOKENS[name].purpose.length, name).toBeGreaterThan(20);
    }
  });
});

describe("the renderer uses the motion tokens", () => {
  it("reads the camera duration from the token rather than its own literal", () => {
    const source = readFileSync(join(root, "src", "renderer", "cameraModes.ts"), "utf8");
    // The export must be derived, and no frame maths may hard-code a duration.
    expect(source).toContain('MOTION_TOKENS["--ps-motion-camera"].durationMs');
    expect(source).toContain("cameraTransitionMs(");
    expect(source).not.toMatch(/CAMERA_TRANSITION_MS\s*=\s*\d/);
  });

  it("resolves the same camera duration the stylesheet will use", () => {
    // Read the renderer's exported value out of the source rather than
    // importing it, because importing cameraModes would pull in Babylon and
    // make a token test depend on a 3D engine being loadable.
    const source = readFileSync(join(root, "src", "renderer", "cameraModes.ts"), "utf8");
    expect(source).toContain(
      'export const CAMERA_TRANSITION_MS = MOTION_TOKENS["--ps-motion-camera"].durationMs;',
    );
    // And the resolved number is the token's number, which is 640 ms today. The
    // 900 ms literal that used to live here is the regression being guarded.
    expect(CAMERA_MOTION.durationMs).toBe(cameraTransitionMs(false));
    expect(CAMERA_MOTION.durationMs).toBe(640);
  });

  it("returns the collapsed duration when reduced motion is requested", () => {
    expect(cameraTransitionMs(true)).toBe(1);
    expect(cameraTransitionMs(false)).toBe(CAMERA_MOTION.durationMs);
  });

  it("keeps the camera step inside the camera motion budget", () => {
    // docs/PERFORMANCE_AND_DEVICE_BUDGETS.md caps camera transitions at 1200 ms.
    // Following the token is stricter than the old 900 ms literal, not looser.
    expect(cameraTransitionMs(false)).toBeLessThanOrEqual(1200);
  });
});

describe("no second source of motion truth", () => {
  it("hard-codes no duration literal in any stylesheet or module", () => {
    // A literal like `transition: all 200ms` would bypass the token layer and
    // silently ignore the reduced-motion override. The token definitions
    // themselves are the one legitimate place a duration is written down, and
    // generated CSS is excluded, so both are skipped; comments are stripped so
    // that documentation of the hierarchy is not mistaken for a violation.
    const offenders: string[] = [];
    for (const file of sourceFiles(join(root, "src"))) {
      const relative = file.replace(root, "");
      if (relative.endsWith(join("styles", "tokens.css"))) continue; // generated
      if (relative.endsWith(join("design", "tokens.ts"))) continue; // the authority
      if (relative.endsWith(join("design", "motion.ts"))) continue; // reads the above
      const code = stripComments(readFileSync(file, "utf8"));
      for (const match of code.matchAll(/(\d+(?:\.\d+)?)ms\b/g)) {
        offenders.push(`${relative}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("routes every declared transition through a motion token", () => {
    const global = readFileSync(join(root, "src", "styles", "global.css"), "utf8");
    const transitions = [...global.matchAll(/transition\s*:\s*([^;]+);/g)].map((match) =>
      (match[1] ?? "").trim(),
    );
    expect(transitions.length).toBeGreaterThan(0);
    for (const declaration of transitions) {
      if (declaration === "none") continue;
      expect(declaration, `transition: ${declaration}`).toMatch(/var\(--ps-motion-/);
    }
  });
});

describe("no state requires a transition", () => {
  it("states the invariant the product is built to keep", () => {
    expect(MOTION_INVARIANTS.noStateRequiresATransition).toBe(true);
  });

  it("keeps the reduced-motion surface declared in the inventory", () => {
    // The `reduced-motion` surface is where A-8 is pinned per-surface; losing it
    // would drop the annotation even though the tokens still collapse.
    const surfaces = readFileSync(join(root, "src", "design", "surfaces.ts"), "utf8");
    expect(surfaces).toContain("reduced-motion");
  });
});
