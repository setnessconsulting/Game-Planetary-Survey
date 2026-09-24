/**
 * Claims and claim evaluation.
 *
 * The single most important property in this file is the **anti-guessing rule**:
 * a claim that happens to be factually correct but is not supported by cited
 * evidence is NOT "supported". It is "insufficient-evidence"
 * (docs/SCIENCE_MODEL.md §4, docs/PRD.md §11).
 *
 * This is what keeps Planetary Survey from degenerating into a fact quiz, and it
 * is a tested, release-blocking behaviour (docs/ACCEPTANCE_EVIDENCE_MATRIX.md,
 * GAME-372 / PS-08 owns the full engine; PS-02 establishes the contract).
 *
 * Debrief reports separate dimensions rather than one opaque correctness score
 * (docs/UX_USER_FLOW.md step 10).
 */

import { ATTRIBUTES, type AttributeId } from "./attributes";
import type { BodyId } from "./bodies";
import { citedRecords, type EvidenceRecord } from "./evidence";
import { canonicalMagnitude, type Quantity } from "./quantities";
import { hashToSeed, seedToken } from "./random";

export type ClaimRelation = "largerThan" | "smallerThan" | "sameAs";

export interface Claim {
  readonly id: string;
  readonly attributeId: AttributeId;
  readonly subject: BodyId;
  readonly relation: ClaimRelation;
  readonly object: BodyId;
  readonly citedEvidenceIds: readonly string[];
}

export interface ClaimDraft {
  readonly attributeId: AttributeId;
  readonly subject: BodyId;
  readonly relation: ClaimRelation;
  readonly object: BodyId;
  readonly citedEvidenceIds: readonly string[];
}

/** Relative difference below which two values are treated as "about the same". */
export const SAME_AS_RELATIVE_TOLERANCE = 0.01;

/**
 * Give a claim a deterministic identity derived from its content, so a replay or
 * a golden fixture produces the same id.
 */
export function createClaim(draft: ClaimDraft): Claim {
  const cited = [...draft.citedEvidenceIds].sort().join(",");
  const id = seedToken(
    hashToSeed(
      [draft.attributeId, draft.subject, draft.relation, draft.object, cited].join("|"),
    ),
  );
  return { ...draft, id };
}

export type ClaimVerdict = "supported" | "contradicted" | "insufficient-evidence";

export interface ClaimDimensions {
  /** Did the learner cite evidence for both worlds being compared? */
  readonly citationCoverage: boolean;
  /** Is the cited evidence about the attribute the claim is about? */
  readonly evidenceAdequacy: boolean;
  /** Do the cited readings carry units and source-backed precision? */
  readonly unitAndPrecisionCare: boolean;
  /** Does the stated relation follow from the cited values? */
  readonly reasoningConsistency: boolean;
}

export interface ClaimEvaluation {
  readonly verdict: ClaimVerdict;
  readonly dimensions: ClaimDimensions;
  /** Specific, actionable problems with the citation, if any. */
  readonly citationProblems: readonly string[];
  readonly comparedValues: readonly { readonly bodyId: BodyId; readonly value: Quantity }[];
  /** Learner-facing explanation. Investigative in tone, never punitive. */
  readonly explanation: string;
}

/**
 * Evaluate a claim against the notebook.
 *
 * Pure: the same claim and the same records always produce the same evaluation.
 */
export function evaluateClaim(
  claim: Claim,
  records: readonly EvidenceRecord[],
): ClaimEvaluation {
  const definition = ATTRIBUTES[claim.attributeId];
  const cited = citedRecords(records, claim.citedEvidenceIds);
  const citationProblems: string[] = [];

  const knownIds = new Set(records.map((record) => record.id));
  const unknown = claim.citedEvidenceIds.filter((id) => !knownIds.has(id));
  if (unknown.length > 0) {
    citationProblems.push(
      `${unknown.length} cited observation${unknown.length === 1 ? " is" : "s are"} not in the notebook.`,
    );
  }

  const subjectRecord = cited.find(
    (record) => record.bodyId === claim.subject && record.attributeId === claim.attributeId,
  );
  const objectRecord = cited.find(
    (record) => record.bodyId === claim.object && record.attributeId === claim.attributeId,
  );

  if (!subjectRecord) {
    citationProblems.push(`No cited ${definition.label.toLowerCase()} measurement for the first world.`);
  }
  if (!objectRecord) {
    citationProblems.push(`No cited ${definition.label.toLowerCase()} measurement for the second world.`);
  }

  const citationCoverage = Boolean(subjectRecord && objectRecord);
  const unitAndPrecisionCare =
    citationCoverage &&
    (subjectRecord?.significantDigits ?? 0) >= 1 &&
    (objectRecord?.significantDigits ?? 0) >= 1;

  // ANTI-GUESSING RULE: without cited evidence for both worlds the claim cannot
  // be checked at all, no matter how plausible it looks.
  if (!subjectRecord || !objectRecord) {
    return {
      verdict: "insufficient-evidence",
      dimensions: {
        citationCoverage,
        evidenceAdequacy: false,
        unitAndPrecisionCare,
        reasoningConsistency: false,
      },
      citationProblems,
      comparedValues: cited.map((record) => ({ bodyId: record.bodyId, value: record.reading })),
      explanation:
        "This claim cannot be checked yet: a claim counts when the evidence behind it is cited. " +
        "Capture and cite a measurement for both worlds, then submit again. " +
        "Being right is not the same as being supported.",
    };
  }

  const subjectValue = canonicalMagnitude(subjectRecord.reading);
  const objectValue = canonicalMagnitude(objectRecord.reading);
  const larger = Math.max(Math.abs(subjectValue), Math.abs(objectValue));
  const relativeDifference = larger === 0 ? 0 : Math.abs(subjectValue - objectValue) / larger;

  const relationHolds =
    claim.relation === "largerThan"
      ? subjectValue > objectValue
      : claim.relation === "smallerThan"
        ? subjectValue < objectValue
        : relativeDifference <= SAME_AS_RELATIVE_TOLERANCE;

  const dimensions: ClaimDimensions = {
    citationCoverage,
    evidenceAdequacy: true,
    unitAndPrecisionCare,
    reasoningConsistency: relationHolds,
  };

  const comparedValues = [
    { bodyId: claim.subject, value: subjectRecord.reading },
    { bodyId: claim.object, value: objectRecord.reading },
  ];

  if (relationHolds) {
    return {
      verdict: "supported",
      dimensions,
      citationProblems,
      comparedValues,
      explanation: `The cited ${definition.label.toLowerCase()} measurements support this claim, and the evidence is attached to it.`,
    };
  }

  return {
    verdict: "contradicted",
    dimensions,
    citationProblems,
    comparedValues,
    explanation:
      "The cited measurements point the other way. That is useful: re-read the two values, " +
      "check the units, and revise the claim or collect a measurement you have not used yet.",
  };
}

/** Human-readable relation, used by the UI and by debrief text. */
export function describeClaimRelation(relation: ClaimRelation): string {
  switch (relation) {
    case "largerThan":
      return "is larger than";
    case "smallerThan":
      return "is smaller than";
    case "sameAs":
      return "is about the same as";
    default: {
      const unreachable: never = relation;
      return unreachable;
    }
  }
}
