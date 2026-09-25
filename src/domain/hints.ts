/**
 * Progressive hints.
 *
 * GAME-372: hints are "progressive and evidence-oriented, never reveal the answer
 * immediately". The authored text lives in `src/content/` (validated for order and
 * non-emptiness by `validateMissionDefinition`); the *policy* lives here: hints are
 * revealed one at a time, in authored order, as the learner asks for them.
 *
 * A hint is text. It has no side effects and no authority: `requestHint` in
 * `mission.ts` increments `hintsUsed` and changes nothing else, so a hint can never
 * choose a target, pick an instrument, or state the claim
 * (docs/UX_USER_FLOW.md §4).
 */

import type { MissionHint } from "./catalog";

export interface HintReveal {
  /** How many hints the mission authored. */
  readonly total: number;
  /** The hints revealed so far, in authored order. */
  readonly revealed: readonly MissionHint[];
  /** The most recently revealed hint, for a live region. */
  readonly latest: MissionHint | null;
  /** How many hints are still unrevealed. */
  readonly remaining: number;
  readonly exhausted: boolean;
}

/**
 * The hints revealed after `hintsUsed` requests.
 *
 * Sorts defensively so content authoring order cannot change the reveal sequence,
 * and clamps so a corrupted count cannot index out of range. Requesting more hints
 * than were authored yields every hint and `exhausted: true` rather than an error.
 */
export function hintReveal(
  hints: readonly MissionHint[],
  hintsUsed: number,
): HintReveal {
  const ordered = [...hints].sort((left, right) => left.order - right.order);
  const total = ordered.length;
  const requested = Number.isFinite(hintsUsed) ? Math.trunc(hintsUsed) : 0;
  const count = Math.min(Math.max(requested, 0), total);
  const revealed = ordered.slice(0, count);

  return {
    total,
    revealed,
    latest: revealed[revealed.length - 1] ?? null,
    remaining: total - count,
    exhausted: count >= total,
  };
}
