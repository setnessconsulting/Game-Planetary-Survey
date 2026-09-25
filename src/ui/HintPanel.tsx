/**
 * Progressive hints.
 *
 * The `hints` global-state surface: hints can be asked for during any step. They
 * are revealed one at a time from the mission's own authored text, they cost
 * nothing, and they never make a scientific choice — a hint points at what to look
 * at next, it does not pick the world, the instrument, or the claim
 * (docs/UX_USER_FLOW.md §4).
 */

import type { MissionHint } from "@/domain/catalog";
import { hintReveal } from "@/domain/hints";

import styles from "./Claim.module.css";

export interface HintPanelProps {
  readonly hints: readonly MissionHint[];
  readonly hintsUsed: number;
  readonly enabled: boolean;
  readonly onRequestHint: () => void;
}

export function HintPanel({ hints, hintsUsed, enabled, onRequestHint }: HintPanelProps) {
  const reveal = hintReveal(hints, hintsUsed);
  const canRequest = enabled && !reveal.exhausted && reveal.total > 0;

  if (!enabled || reveal.total === 0) {
    return null;
  }

  return (
    <section aria-labelledby="hints-heading" data-testid="hint-panel" className={styles.hints}>
      <h2 id="hints-heading">Hints</h2>
      <p className={styles.lede}>
        Hints point at what to look at next. They never choose an instrument, a world, or a
        claim for you, and using one never blocks progress.
      </p>

      <p className={styles.count} data-testid="hints-count" aria-live="polite">
        {reveal.revealed.length} of {reveal.total} hint{reveal.total === 1 ? "" : "s"} shown.
        {reveal.exhausted ? " No more hints for this mission." : ""}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          data-testid="request-hint"
          disabled={!canRequest}
          onClick={onRequestHint}
        >
          Request a hint
        </button>
      </div>

      {reveal.revealed.length > 0 ? (
        <ol className={styles.hintList} data-testid="hints-list">
          {reveal.revealed.map((hint) => (
            <li key={hint.order} data-hint-order={hint.order}>
              {hint.text}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
