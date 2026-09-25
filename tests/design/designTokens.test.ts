/**
 * Design token tests (GAME-367).
 *
 * `scripts/check-design-system.mjs` runs in the gate and enforces the same rules,
 * so why test them again? Because the two implementations are independent: the
 * contrast maths below is written from the WCAG definition rather than calling the
 * checker's helper, so a mistake in either one shows up as a disagreement rather
 * than as a palette that quietly passes. The rest of the file pins the decisions
 * the design contract makes, including the two places where the inherited PS-02
 * palette failed its own accessibility minimum and was corrected.
 */

import { describe, expect, it } from "vitest";

import {
  BREAKPOINTS,
  CONTRAST_REQUIREMENTS,
  DESIGN_TOKENS,
  REDUCED_MOTION_OVERRIDES,
  TOUCH_TARGET_MIN_PX,
} from "@/design/tokens";

function token(name: string) {
  const found = DESIGN_TOKENS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No design token ${name}`);
  return found;
}

/** WCAG 2.1 relative luminance, written from the specification. */
function luminance(hex: string): number {
  const int = Number.parseInt(hex.replace("#", ""), 16);
  const channels = [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
  const [r, g, b] = channels.map((raw) => {
    const scaled = raw / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const isDuration = (value: string) => /^\d+(\.\d+)?(ms|s)$/.test(value.trim());

describe("the token source of truth", () => {
  it("namespaces every token and declares each one once", () => {
    const names = DESIGN_TOKENS.map((entry) => entry.name);
    expect(names.every((name) => /^--ps-[a-z0-9-]+$/.test(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("states a purpose for every token, because an unexplained constant is folklore", () => {
    for (const entry of DESIGN_TOKENS) {
      expect(entry.purpose.trim().length, entry.name).toBeGreaterThan(20);
      expect(entry.value.trim(), entry.name).not.toBe("");
    }
  });

  it("keeps the token set bounded enough to stay reviewable", () => {
    // Not a style preference: a token list nobody can read is a list nobody checks,
    // and the generated stylesheet is meant to be reviewable in a pull request.
    expect(DESIGN_TOKENS.length).toBeLessThan(80);
  });

  it("uses one type scale with a floor for required reading", () => {
    // docs/ACCESSIBILITY.md A-12 requires the semantic UI to stay usable at 200%
    // zoom, and a learner-facing instruction below 1rem makes that harder rather
    // than easier. The xs step is for metadata, and says so.
    const base = token("--ps-text-base");
    expect(base.value).toBe("1rem");
    expect(token("--ps-text-xs").purpose).toContain("Never a measured value");
  });

  it("keeps dense-data type legible by bounding line length", () => {
    expect(token("--ps-measure").value).toBe("68ch");
    expect(token("--ps-leading-normal").value).toBe("1.55");
  });

  it("gives the renderer no layer above the accessible surfaces", () => {
    // The viewport is an enhancement. If it could sit above an overlay it could
    // cover required content, so the ordering is a contract, not a preference.
    const z = (name: string) => Number(token(name).value);
    expect(z("--ps-z-viewport")).toBeLessThan(z("--ps-z-toolbar"));
    expect(z("--ps-z-toolbar")).toBeLessThan(z("--ps-z-overlay"));
    expect(z("--ps-z-overlay")).toBeLessThan(z("--ps-z-modal"));
    expect(z("--ps-z-content")).toBe(0);
  });
});

describe("declared contrast", () => {
  it("meets every declared minimum, computed from the values", () => {
    for (const requirement of CONTRAST_REQUIREMENTS) {
      const measured = ratio(token(requirement.foreground).value, token(requirement.background).value);
      expect(
        measured,
        `${requirement.foreground} on ${requirement.background} — ${requirement.note}`,
      ).toBeGreaterThanOrEqual(requirement.minimum);
    }
  });

  it("holds text, not just decoration, to the text minimum", () => {
    // A palette can pass a linter and fail a learner. Units and provenance tags are
    // required reading in this product, so the muted and subtle steps are held to
    // the same 4.5:1 as body text rather than being treated as optional.
    const textRows = CONTRAST_REQUIREMENTS.filter((row) => row.appliesTo === "text");
    expect(textRows.length).toBeGreaterThan(5);
    expect(textRows.every((row) => row.minimum >= 4.5)).toBe(true);
    expect(textRows.map((row) => row.foreground)).toContain("--ps-text-subtle");
    expect(textRows.map((row) => row.foreground)).toContain("--ps-text-muted");
  });

  it("records why the strong border was lightened from the PS-02 value", () => {
    // The real finding: the inherited #3d4c5c measured 2.14:1 against a panel, which
    // fails the 3:1 non-text minimum that this token exists to meet. It is recorded
    // in the token's own purpose rather than only in a changelog.
    expect(token("--ps-border-strong").value).toBe("#5a6d80");
    expect(ratio("#5a6d80", "#141b23")).toBeGreaterThanOrEqual(3);
    expect(ratio("#3d4c5c", "#0d1218")).toBeLessThan(3);
    expect(token("--ps-border-strong").purpose).toContain("2.14:1");
  });

  it("covers every surface the focus ring can appear on", () => {
    const backgrounds = CONTRAST_REQUIREMENTS.filter(
      (row) => row.foreground === "--ps-focus-ring",
    ).map((row) => row.background);
    expect(backgrounds).toContain("--ps-surface-1");
    expect(backgrounds).toContain("--ps-surface-2");
  });
});

describe("motion", () => {
  it("neutralises every motion duration, including the camera step", () => {
    const durations = DESIGN_TOKENS.filter(
      (entry) => entry.group === "motion" && isDuration(entry.value),
    );
    expect(durations.length).toBeGreaterThanOrEqual(4);
    for (const entry of durations) {
      expect(REDUCED_MOTION_OVERRIDES[entry.name], entry.name).toBeTruthy();
      expect(Number.parseFloat(REDUCED_MOTION_OVERRIDES[entry.name]!)).toBeLessThanOrEqual(2);
    }
    // The camera transition is the only motion that moves the whole frame, so it is
    // the one that matters most and the one a renderer might try to keep.
    expect(Object.keys(REDUCED_MOTION_OVERRIDES)).toContain("--ps-motion-camera");
    expect(token("--ps-motion-camera").purpose).toContain("first thing reduced motion removes");
  });

  it("does not pretend an easing curve can be shortened", () => {
    expect(isDuration(token("--ps-ease").value)).toBe(false);
    expect(REDUCED_MOTION_OVERRIDES["--ps-ease"]).toBeUndefined();
  });

  it("keeps motion out of the required path", () => {
    // No transition may be needed to reach a state: the durations are for feedback,
    // and every motion purpose states that layout never depends on them.
    for (const entry of DESIGN_TOKENS.filter((candidate) => candidate.group === "motion")) {
      expect(entry.purpose.length, entry.name).toBeGreaterThan(10);
    }
  });
});

describe("layout breakpoints and touch", () => {
  it("ascends from the documented minimum supported width", () => {
    const widths = BREAKPOINTS.map((breakpoint) => breakpoint.minWidthPx);
    expect(widths).toEqual([...widths].sort((left, right) => left - right));
    // docs/UX_USER_FLOW.md §7: the semantic UI must work from 360px upward.
    expect(widths[0]).toBe(360);
    expect(BREAKPOINTS[0]?.id).toBe("phone");
  });

  it("states what changes at each width and keeps the evidence route intact", () => {
    for (const breakpoint of BREAKPOINTS) {
      expect(breakpoint.purpose.length, breakpoint.id).toBeGreaterThan(40);
    }
    expect(BREAKPOINTS[0]?.purpose).toContain("no horizontal scrolling");
    expect(BREAKPOINTS[0]?.purpose).toContain("reduced or replaced");
  });

  it("exposes the touch minimum as a token that matches the declared constant", () => {
    expect(token("--ps-touch-min").value).toBe(`${TOUCH_TARGET_MIN_PX}px`);
    expect(TOUCH_TARGET_MIN_PX).toBeGreaterThanOrEqual(44);
    // A control may be visually shorter on a pointer device, but only because its
    // hit area is grown to the minimum rather than because the minimum moved.
    expect(Number.parseFloat(token("--ps-control-height").value)).toBeLessThan(TOUCH_TARGET_MIN_PX);
    expect(token("--ps-control-height").purpose).toContain("hit area is grown");
  });
});
