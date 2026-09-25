/**
 * Claim scoring.
 *
 * GAME-372 asks for "partial credit" that can tell a **correct claim with weak
 * evidence** apart from an **incorrect claim with useful evidence**. This module
 * does exactly that, and deliberately nothing more:
 *
 *  - the outcome is a **word** (`ClaimScoreLevel`), never a number;
 *  - "credit" is a set of **named credits**, never points, a percentage, a
 *    multiplier, or a time bonus;
 *  - there is no speed, no streak, no rank, and no leaderboard field anywhere in
 *    the type (docs/PRD.md §9, §11; docs/UX_USER_FLOW.md §4).
 *
 * The distinction the story asks for needs a second question that `evaluateClaim`
 * does not answer. `evaluateClaim` judges the claim **as cited** — that is the
 * anti-guessing rule and it must stay exactly as it is. Scoring additionally asks:
 * does the stated relation follow from the learner's **own notebook**, whether or
 * not they cited it? When it does but the citation is incomplete, the learner has
 * the right answer and a citation problem: that is `right-answer-uncited`, and the
 * fix is to cite, not to re-measure. When the citation is complete and the values
 * still point the other way, the learner reasoned well enough to be checked out
 * and got the relation wrong: that is `reasoning-mismatch`.
 *
 * This is still not "correctness over evidence": a `right-answer-uncited` claim
 * does **not** count as supported, cannot complete a mission's claim target, and
 * the caller is told so through `citationRecommended`. Scoring adds feedback; it
 * never loosens the anti-guessing rule.
 */

import {
  claimBasisMagnitude,
  claimRelationHolds,
  evaluateClaim,
  type Claim,
  type ClaimDimensions,
  type ClaimEvaluation,
} from "./claims";
import type { EvidenceRecord } from "./evidence";
import { canonicalMagnitude } from "./quantities";

export type ClaimScoreLevel =
  /** The cited evidence supports the claim. */
  | "supported"
  /** The relation follows from the notebook, but the claim does not cite it. */
  | "right-answer-uncited"
  /** The evidence is checkable and the relation does not follow from the values. */
  | "reasoning-mismatch"
  /** There is not enough in the notebook to check the claim at all. */
  | "uncheckable";

/** Named credits, in a stable order. Never points, never a percentage. */
export type ClaimCredit =
  | "evidence-cited-for-both-worlds"
  | "relation-follows-from-the-values"
  | "units-and-significant-figures"
  | "proportional-basis-grounded";

export interface ClaimScore {
  readonly level: ClaimScoreLevel;
  /** The same four dimensions the debrief reports, carried through unchanged. */
  readonly dimensions: ClaimDimensions;
  readonly credits: readonly ClaimCredit[];
  /** True when the claim is checkable but not yet fully cited. */
  readonly citationRecommended: boolean;
  /** Learner-facing explanation. Investigative in tone, never punitive. */
  readonly explanation: string;
}

/**
 * The magnitude of a world's own notebook value for a claim's attribute.
 *
 * Uses the learner's captured record whether or not it is cited, because the
 * question here is "does the relation follow from what this learner measured".
 * `undefined` means the notebook cannot answer it.
 */
function notebookMagnitude(
  records: readonly EvidenceRecord[],
  bodyId: string,
  attributeId: Claim["attributeId"],
  proportional: boolean,
): number | undefined {
  const record = records.find(
    (candidate) => candidate.bodyId === bodyId && candidate.attributeId === attributeId,
  );
  if (!record) return undefined;
  if (!proportional) return canonicalMagnitude(record.reading);
  const radius = records.find(
    (candidate) => candidate.bodyId === bodyId && candidate.attributeId === "meanRadius",
  );
  const value = claimBasisMagnitude(record, radius);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Score a claim.
 *
 * Pure: pass `evaluation` when the caller already has one (the mission snapshot
 * records it on submit) so the verdict and the score cannot disagree.
 */
export function scoreClaim(
  claim: Claim,
  records: readonly EvidenceRecord[],
  evaluation?: ClaimEvaluation,
): ClaimScore {
  const evaluated = evaluation ?? evaluateClaim(claim, records);
  const proportional = claim.basis === "proportionOfRadius";

  const subjectValue = notebookMagnitude(records, claim.subject, claim.attributeId, proportional);
  const objectValue = notebookMagnitude(records, claim.object, claim.attributeId, proportional);
  const relationCheckable = subjectValue !== undefined && objectValue !== undefined;
  const relationHolds =
    relationCheckable && claimRelationHolds(claim.relation, subjectValue, objectValue);
  const fullyCited = evaluated.dimensions.citationCoverage;

  const level: ClaimScoreLevel = fullyCited
    ? relationHolds
      ? "supported"
      : "reasoning-mismatch"
    : relationHolds
      ? "right-answer-uncited"
      : relationCheckable
        ? "reasoning-mismatch"
        : "uncheckable";

  const credits: ClaimCredit[] = [];
  if (fullyCited) credits.push("evidence-cited-for-both-worlds");
  if (relationHolds) credits.push("relation-follows-from-the-values");
  if (evaluated.dimensions.unitAndPrecisionCare) credits.push("units-and-significant-figures");
  if (proportional && fullyCited) credits.push("proportional-basis-grounded");

  return {
    level,
    dimensions: evaluated.dimensions,
    credits,
    citationRecommended: !fullyCited,
    explanation: explanationFor(level),
  };
}

function explanationFor(level: ClaimScoreLevel): string {
  switch (level) {
    case "supported":
      return (
        "The cited evidence supports this claim, and the measurements are attached " +
        "to it, so this conclusion counts."
      );
    case "right-answer-uncited":
      return (
        "The relation you stated does follow from your own measurements — but the " +
        "claim does not yet cite the observations that show it. Attach both worlds' " +
        "readings and submit again. Being right is not the same as being supported."
      );
    case "reasoning-mismatch":
      return (
        "The claim can be checked, and the values it rests on point the other way. " +
        "That is useful: re-read the two readings, check the units, and adjust the " +
        "relation or the evidence you cite."
      );
    case "uncheckable":
      return (
        "There is not enough in the notebook to check this claim yet. Measure both " +
        "worlds, keep the observations, then cite them."
      );
    default: {
      const unreachable: never = level;
      return unreachable;
    }
  }
}
