/**
 * The debrief and the completion summary.
 *
 * docs/UX_USER_FLOW.md step 10: a debrief "reports separate dimensions, never one
 * opaque correctness score", and "every debrief statement must be traceable to
 * something the learner did or did not collect". GAME-372 adds: the debrief
 * explains which observations supported or refuted the claim, and hints/debrief
 * are content-driven and source-traceable, and the completion summary "contains
 * bounded facts suitable for later host integration".
 *
 * Both are pure functions of domain inputs. Neither reads the clock, the
 * renderer, the device, or the network, and neither can name a fact the mission
 * did not author. A `sourced` fact carries the register ids it came from, so a
 * learner-facing sentence about a world is always traceable back to the register —
 * the same rule `validateMissionDefinition` enforces on the content.
 */

import type { AttributeId } from "./attributes";
import type { BodyId } from "./bodies";
import {
  observationKey,
  type MissionDefinition,
  type MissionMisconception,
} from "./catalog";
import type {
  Claim,
  ClaimBasis,
  ClaimDimensions,
  ClaimEvaluation,
  ClaimRelation,
  ClaimVerdict,
} from "./claims";
import { citedRecords, type EvidenceRecord } from "./evidence";
import type { Quantity } from "./quantities";
import type { Seed } from "./random";

/** One value the debrief quotes back to the learner. */
export interface DebriefValue {
  readonly bodyId: BodyId;
  readonly attributeId: AttributeId;
  readonly value: Quantity;
}

/** An authored debrief fact, with its provenance made explicit. */
export interface DebriefFact {
  readonly id: string;
  readonly text: string;
  /** `measured` restates the learner's own data; `sourced` asserts a register fact. */
  readonly basis: "measured" | "sourced";
  /** Register ids for a `sourced` fact. Always empty for a `measured` one. */
  readonly sourceIds: readonly string[];
}

export interface MissionDebrief {
  readonly missionId: string;
  readonly claimId: string;
  readonly attributeId: AttributeId;
  readonly basis: ClaimBasis;
  readonly subject: BodyId;
  readonly relation: ClaimRelation;
  readonly object: BodyId;
  readonly verdict: ClaimVerdict;
  readonly dimensions: ClaimDimensions;
  readonly explanation: string;
  readonly citationProblems: readonly string[];
  readonly comparedValues: readonly DebriefValue[];
  /** Cited observations that carry the verdict; empty when the citation fell short. */
  readonly supportingEvidenceIds: readonly string[];
  /** Cited observations that point the other way; empty on a supported claim. */
  readonly refutingEvidenceIds: readonly string[];
  readonly facts: readonly DebriefFact[];
  /** The authored misconception this attempt matched, if any. */
  readonly misconception: MissionMisconception | null;
  readonly hintsUsed: number;
  readonly claimAttempts: number;
}

export interface BuildDebriefInput {
  readonly mission: MissionDefinition;
  readonly claim: Claim;
  readonly evaluation: ClaimEvaluation;
  readonly records: readonly EvidenceRecord[];
  readonly hintsUsed: number;
  readonly claimAttempts: number;
}

/**
 * Build the debrief for a submitted claim.
 *
 * Pure. The verdict and dimensions are carried through from `evaluateClaim`
 * unchanged, so the debrief and the score can never disagree.
 */
export function buildMissionDebrief(input: BuildDebriefInput): MissionDebrief {
  const { mission, claim, evaluation, records, hintsUsed, claimAttempts } = input;

  // Only the records the learner attached to this claim, and only those that are
  // about the property being compared (a proportional claim legitimately cites the
  // radii too). An uncited world is never quietly counted.
  const attributed = citedRecords(records, claim.citedEvidenceIds).filter(
    (record) =>
      record.attributeId === claim.attributeId ||
      (claim.basis === "proportionOfRadius" && record.attributeId === "meanRadius"),
  );
  const covered = evaluation.dimensions.citationCoverage;
  const consistent = evaluation.dimensions.reasoningConsistency;

  const supportingEvidenceIds = consistent ? attributed.map((record) => record.id) : [];
  const refutingEvidenceIds = covered && !consistent ? attributed.map((record) => record.id) : [];
  // When the citation fell short there is no verdict to attribute, but an on-topic
  // attachment is still worth naming: it is half of what the claim needs.
  const partialEvidenceIds = !covered ? attributed.map((record) => record.id) : [];

  return {
    missionId: mission.id,
    claimId: claim.id,
    attributeId: claim.attributeId,
    basis: claim.basis,
    subject: claim.subject,
    relation: claim.relation,
    object: claim.object,
    verdict: evaluation.verdict,
    dimensions: evaluation.dimensions,
    explanation: evaluation.explanation,
    citationProblems: [...evaluation.citationProblems],
    comparedValues: evaluation.comparedValues.map((entry) => ({
      bodyId: entry.bodyId,
      attributeId: claim.attributeId,
      value: entry.value,
    })),
    supportingEvidenceIds: [...supportingEvidenceIds, ...partialEvidenceIds],
    refutingEvidenceIds,
    facts: mission.debriefFacts.map((fact) => ({
      id: fact.id,
      text: fact.text,
      basis: fact.basis,
      sourceIds: fact.basis === "sourced" ? [...fact.sourceBasisIds] : [],
    })),
    misconception: matchingMisconception(mission, claim, evaluation),
    hintsUsed,
    claimAttempts,
  };
}

/**
 * The authored misconception this attempt matched.
 *
 * Only a `contradicted` claim can match: the mission authors a misconception and
 * the observation keys that refute it, and a wrong relation is exactly the belief
 * that feedback is written for. A supported or uncheckable claim names none, so the
 * debrief never lectures a learner who was not wrong.
 */
function matchingMisconception(
  mission: MissionDefinition,
  claim: Claim,
  evaluation: ClaimEvaluation,
): MissionMisconception | null {
  if (evaluation.verdict !== "contradicted") return null;
  const keys = [
    observationKey(claim.subject, claim.attributeId),
    observationKey(claim.object, claim.attributeId),
  ];
  return (
    mission.misconceptions.find((misconception) =>
      keys.every((key) => misconception.refutedBy.includes(key)),
    ) ?? null
  );
}

export interface CompletionSummary {
  readonly missionId: string;
  readonly seed: Seed;
  readonly verdict: ClaimVerdict;
  readonly dimensions: ClaimDimensions;
  readonly evidenceCount: number;
  readonly citationCount: number;
  readonly claimAttempts: number;
  readonly hintsUsed: number;
  readonly observationsRequired: number;
  readonly observationsCaptured: number;
  /** The mission's claim target was actually supported by cited evidence. */
  readonly targetMet: boolean;
}

export interface BuildCompletionInput {
  readonly mission: MissionDefinition;
  readonly missionId: string;
  readonly seed: Seed;
  readonly evaluation: ClaimEvaluation | null;
  readonly claim: Claim | null;
  readonly evidence: readonly EvidenceRecord[];
  readonly hintsUsed: number;
  readonly claimAttempts: number;
}

/**
 * The bounded completion summary.
 *
 * Deliberately small and free of anything a host would have to redact: no clock, no
 * device, no identity, no free text. It is counts and a verdict, so a later
 * games-site integration can record "this mission finished with this outcome"
 * without importing any of the learner's work.
 */
export function buildCompletionSummary(input: BuildCompletionInput): CompletionSummary {
  const {
    mission,
    missionId,
    seed,
    evaluation,
    claim,
    evidence,
    hintsUsed,
    claimAttempts,
  } = input;

  const capturedKeys = new Set(
    evidence.map((record) => observationKey(record.bodyId, record.attributeId)),
  );
  const observationsCaptured = mission.requiredObservations.filter((observation) =>
    capturedKeys.has(observationKey(observation.bodyId, observation.attributeId)),
  ).length;

  const dimensions: ClaimDimensions = evaluation?.dimensions ?? {
    citationCoverage: false,
    evidenceAdequacy: false,
    unitAndPrecisionCare: false,
    reasoningConsistency: false,
  };

  return {
    missionId,
    seed,
    verdict: evaluation?.verdict ?? "insufficient-evidence",
    dimensions,
    evidenceCount: evidence.length,
    citationCount: claim?.citedEvidenceIds.length ?? 0,
    claimAttempts,
    hintsUsed,
    observationsRequired: mission.requiredObservations.length,
    observationsCaptured,
    targetMet: evaluation?.verdict === "supported",
  };
}
