/**
 * Motion contract (PS-10).
 *
 * docs/DESIGN_SYSTEM.md §6 defines a four-step duration hierarchy with a
 * reduced-motion override per duration, and states the rule that governs all
 * of it: "no transition is required for any state to be reached. Motion is
 * feedback, never structure."
 *
 * The tokens were already correct and the generated stylesheet already emitted
 * the override block. What was missing was anything connecting them to the
 * renderer, and that gap was real rather than theoretical: `cameraModes.ts`
 * carried its own `CAMERA_TRANSITION_MS = 900`, so the product had **two**
 * different camera-step durations — 900 ms in the viewport and 640 ms in CSS —
 * and neither was derived from the token. Changing `--ps-motion-camera` in
 * `tokens.ts` would have moved the DOM and left the camera exactly where it was.
 *
 * This module is the single place a duration is read from, so the renderer and
 * the stylesheet cannot disagree:
 *
 *   --ps-motion-fast     120ms  press, toggle, row focus
 *   --ps-motion-base     220ms  appears or changes in place
 *   --ps-motion-slow     420ms  larger spatial change
 *   --ps-motion-camera   640ms  camera and viewport transitions
 *
 * EASING IS NOT OVERRIDDEN UNDER REDUCED MOTION, and that is deliberate rather
 * than an oversight: shortening a curve is meaningless, which is exactly why
 * motion is expressed as a duration that can be collapsed instead of a literal
 * that has to be conditionally edited. See §6.
 *
 * Every duration here is presentation. None of them changes a measurement, a
 * claim outcome, or what a learner reads.
 */

import { DESIGN_TOKENS, REDUCED_MOTION_OVERRIDES } from "./tokens";

export type MotionTokenName =
  | "--ps-motion-fast"
  | "--ps-motion-base"
  | "--ps-motion-slow"
  | "--ps-motion-camera";

export interface MotionToken {
  readonly name: MotionTokenName;
  /** Authored duration in milliseconds. */
  readonly durationMs: number;
  /** Duration under `prefers-reduced-motion: reduce`, in milliseconds. */
  readonly reducedDurationMs: number;
  /** What this step is for, copied from the token's own stated purpose. */
  readonly purpose: string;
}

function parseMs(value: string): number {
  const match = /^(\d+(?:\.\d+)?)ms$/.exec(value.trim());
  if (!match || match[1] === undefined) {
    throw new Error(`Motion token value "${value}" is not a millisecond duration.`);
  }
  return Number(match[1]);
}

function motionToken(name: MotionTokenName): MotionToken {
  const definition = DESIGN_TOKENS.find((token) => token.name === name);
  if (!definition) {
    throw new Error(`Motion token ${name} is not declared in src/design/tokens.ts.`);
  }
  const override = REDUCED_MOTION_OVERRIDES[name];
  if (override === undefined) {
    // §6 is explicit that the camera step is included, because "a rule the
    // renderer can opt out of is not a rule". A missing override is a contract
    // break, not a default to fill in.
    throw new Error(
      `Motion token ${name} has no reduced-motion override. docs/DESIGN_SYSTEM.md §6 ` +
        "requires one per duration, including the camera step.",
    );
  }
  return {
    name,
    durationMs: parseMs(definition.value),
    reducedDurationMs: parseMs(override),
    purpose: definition.purpose,
  };
}

export const MOTION_TOKENS: Readonly<Record<MotionTokenName, MotionToken>> = {
  "--ps-motion-fast": motionToken("--ps-motion-fast"),
  "--ps-motion-base": motionToken("--ps-motion-base"),
  "--ps-motion-slow": motionToken("--ps-motion-slow"),
  "--ps-motion-camera": motionToken("--ps-motion-camera"),
};

export const CAMERA_MOTION: MotionToken = MOTION_TOKENS["--ps-motion-camera"];

/**
 * The camera transition duration, in milliseconds, for the current motion
 * preference.
 *
 * This is the function the renderer must use. Returning the authored value when
 * motion is allowed and the collapsed value when it is not is what makes
 * "reduced motion" a property of the product rather than a promise about its
 * stylesheet.
 */
export function cameraTransitionMs(reducedMotion: boolean): number {
  return reducedMotion ? CAMERA_MOTION.reducedDurationMs : CAMERA_MOTION.durationMs;
}

/**
 * The invariants a caller must not break, stated once so they can be asserted
 * rather than remembered.
 *
 * These are the rules a reviewer would otherwise have to infer by reading
 * DESIGN_SYSTEM.md §6 and hoping every implementer did.
 */
export const MOTION_INVARIANTS = {
  /**
   * A 1 ms transition, not `none`.
   *
   * §6: a 1 ms transition "still fires the transition events an implementation
   * may rely on and still avoids a flash of unstyled final state, while
   * removing every perceptible movement". Collapsing to `none` would trade a
   * guarantee for tidiness.
   */
  reducedMotionIsCollapsedNotRemoved: true,

  /**
   * No state is reachable only through a transition. Every phase, panel, and
   * value is present in the DOM and in the accessible equivalents whether or
   * not anything animates, so a learner who sees nothing move is not a learner
   * who is missing information.
   */
  noStateRequiresATransition: true,

  /**
   * Easing is deliberately not overridden. Shortening a curve is meaningless,
   * and overriding it would imply the curve was doing work the duration was
   * not already doing.
   */
  easingIsNotOverridden: true,
} as const;
