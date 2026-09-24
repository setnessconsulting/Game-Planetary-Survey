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

/**
 * What a claim compares.
 *
 * `magnitude` compares the measured values directly. `proportionOfRadius`
 * compares each value as a fraction of its own body's mean radius, which is the
 * MS-ESS1-3 LO-3 insight: a 13 km feature means something different on a
 * 1737 km world than on a 6052 km one.
 *
 * The two bases are different scientific statements, so a claim carries the one
 * it was made under. A proportional claim additionally requires the radius of both
 * worlds to be cited, because without them the proportion cannot be checked at
 * all.
 */
export type ClaimBasis = "magnitude" | "proportionOfRadius";

export interface Claim {
  readonly id: string;
  readonly attributeId: AttributeId;
  readonly basis: ClaimBasis;
  readonly subject: BodyId;
  readonly relation: ClaimRelation;
  readonly object: BodyId;
  readonly citedEvidenceIds: readonly string[];
}

export interface ClaimDraft {
  readonly attributeId: AttributeId;
  /** Defaults to `magnitude` so an ordinary comparison needs no extra ceremony. */
  readonly basis?: ClaimBasis;
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
  const basis = draft.basis ?? "magnitude";
  const cited = [...draft.citedEvidenceIds].sort().join(",");
  const id = seedToken(
    hashToSeed(
      [draft.attributeId, basis, draft.subject, draft.relation, draft.object, cited].join("|"),
    ),
  );
  return {
    id,
    attributeId: draft.attributeId,
    basis,
    subject: draft.subject,
    relation: draft.relation,
    object: draft.object,
    citedEvidenceIds: draft.citedEvidenceIds,
  };
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

  // A proportion of radius only means something for a size measurement. A
  // temperature divided by a radius is a number without a meaning, so it is
  // refused rather than computed.
  const proportional = claim.basis === "proportionOfRadius";
  const basisIsMeaningful = !proportional || definition.kind === "length";
  if (!basisIsMeaningful) {
    citationProblems.push(
      `${definition.label} is not a size, so it has no proportion of radius to compare. Compare two of these directly instead.`,
    );
  }

  // A proportional claim is a claim about a ratio, so it needs the denominator as
  // well as the numerator. Without the radii there is no proportion to check, and
  // accepting the claim on the raw values would silently grade the wrong insight.
  let subjectRadius: EvidenceRecord | undefined;
  let objectRadius: EvidenceRecord | undefined;
  if (proportional && basisIsMeaningful) {
    subjectRadius = cited.find(
      (record) => record.bodyId === claim.subject && record.attributeId === "meanRadius",
    );
    objectRadius = cited.find(
      (record) => record.bodyId === claim.object && record.attributeId === "meanRadius",
    );
    if (!subjectRadius) {
      citationProblems.push(
        "No cited mean radius for the first world. A proportion needs the size of the world as well as the measurement.",
      );
    }
    if (!objectRadius) {
      citationProblems.push(
        "No cited mean radius for the second world. A proportion needs the size of the world as well as the measurement.",
      );
    }
  }

  const citationCoverage = Boolean(
    subjectRecord &&
      objectRecord &&
      basisIsMeaningful &&
      (!proportional || (subjectRadius && objectRadius)),
  );
  const unitAndPrecisionCare =
    citationCoverage &&
    (subjectRecord?.significantDigits ?? 0) >= 1 &&
    (objectRecord?.significantDigits ?? 0) >= 1;

  // ANTI-GUESSING RULE: without cited evidence for both worlds the claim cannot
  // be checked at all, no matter how plausible it looks.
  if (!citationCoverage || !subjectRecord || !objectRecord) {
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

  const subjectValue = proportional
    ? claimBasisMagnitude(subjectRecord, subjectRadius)
    : canonicalMagnitude(subjectRecord.reading);
  const objectValue = proportional
    ? claimBasisMagnitude(objectRecord, objectRadius)
    : canonicalMagnitude(objectRecord.reading);
  // A zero denominator would make a proportion meaningless rather than infinite.
  if (!Number.isFinite(subjectValue) || !Number.isFinite(objectValue)) {
    return {
      verdict: "insufficient-evidence",
      dimensions: {
        citationCoverage,
        evidenceAdequacy: false,
        unitAndPrecisionCare,
        reasoningConsistency: false,
      },
      citationProblems: [
        ...citationProblems,
        "A world's radius reads as zero, so its proportion cannot be computed. Re-measure the radius.",
      ],
      comparedValues: [
        { bodyId: claim.subject, value: subjectRecord.reading },
        { bodyId: claim.object, value: objectRecord.reading },
      ],
      explanation:
        "This claim cannot be checked from the evidence cited: one of the radii is zero, " +
        "so the proportion has no meaning. Capture a radius measurement for both worlds.",
    };
  }
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

  const subjectName = proportional ? "proportion of mean radius" : definition.label.toLowerCase();

  if (relationHolds) {
    return {
      verdict: "supported",
      dimensions,
      citationProblems,
      comparedValues,
      explanation: `The cited ${subjectName} measurements support this claim, and the evidence is attached to it.`,
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

/**
 * The magnitude a claim's relation is evaluated against.
 *
 * For a proportional claim this is the measured value divided by the same world's
 * mean radius, computed in canonical units so the ratio is dimensionless.
 */
function claimBasisMagnitude(
  record: EvidenceRecord,
  radius: EvidenceRecord | undefined,
): number {
  if (!radius) return Number.NaN;
  const radiusMetres = canonicalMagnitude(radius.reading);
  return radiusMetres === 0 ? Number.NaN : canonicalMagnitude(record.reading) / radiusMetres;
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
