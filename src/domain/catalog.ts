/**
 * The authored-content catalog: schema, validation, and data snapshots.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * Two PS-03 requirements live here:
 *
 *  - "typed body/property/source schemas", and
 *  - "deterministic mission data snapshots" — "same content version + seed
 *    produces the same mission facts" (GAME-366).
 *
 * The snapshot is the *data* a mission is built from, as opposed to
 * `MissionSnapshot` in `mission.ts`, which is the learner's runtime state. A data
 * snapshot is deliberately boring and total: ids sorted, attributes sorted,
 * register version and digest recorded, and no dependence on the clock, the
 * renderer, or the device. Two builds of the same commit must produce byte-identical
 * snapshots, and a digest of one can be pinned as a golden value.
 *
 * Note what a snapshot *cannot* do: carry a seed into a scientific value. The seed
 * is recorded (so a variant run is identifiable) but the facts are seed-independent,
 * because a seed selects an observation's identity and never perturbs a value
 * (docs/SCIENCE_MODEL.md §5-§6, `measurement.ts`).
 *
 * Authored values live in `src/content/`; this module owns only the shape and the
 * pure functions over it. It never imports `src/content/`.
 */

import { ATTRIBUTES, type AttributeId } from "./attributes";
import type { BodyId, BodyRecord, ReviewStatus, SourcedValue } from "./bodies";
import { canonicalJson, digestOf } from "./canonical";
import type { ClaimBasis, ClaimRelation } from "./claims";
import { instrumentDefinition, type InstrumentId } from "./measurement";
import { convertTo, unitKind, type Quantity, type Unit } from "./quantities";
import type { Seed } from "./random";
import { registerDigest, type SourceRegister } from "./register";
import type { ValidationIssue } from "./validation";

export type MissionKind = "guided" | "independent";

/**
 * One observation a mission requires, expressed as (body, attribute, instrument).
 *
 * A mission's completion path is its required observations. Nothing else may be
 * needed to finish, which is what keeps a mission from degenerating into recall:
 * the learner has to *produce* these, and the claim contract refuses a conclusion
 * that does not cite them.
 */
export interface RequiredObservation {
  readonly bodyId: BodyId;
  readonly attributeId: AttributeId;
  readonly instrumentId: InstrumentId;
  /** Why this observation is needed, in learner-facing language. */
  readonly purpose: string;
}

/** The stable key a mission, its claim target, and a misconception share. */
export function observationKey(bodyId: BodyId, attributeId: AttributeId): string {
  return `${bodyId}.${attributeId}`;
}

/**
 * A mission's expected conclusion.
 *
 * `basis` matters as much as the relation. "Mars's relief is larger than Venus's"
 * and "Mars's relief is a larger *proportion of its own radius* than Venus's" are
 * different scientific statements, and MS-ESS1-3's LO-3 is specifically about the
 * second. Encoding the basis means a mission can require the proportional
 * insight rather than accepting the raw comparison that accidentally agrees with
 * it.
 */
export interface ClaimTarget {
  readonly attributeId: AttributeId;
  readonly basis: ClaimBasis;
  readonly subject: BodyId;
  readonly relation: ClaimRelation;
  readonly object: BodyId;
  /** The assertion in learner-facing language, phrased so it can be checked. */
  readonly assertion: string;
  /**
   * Observation keys (`body.attribute`) that must be cited for the claim to count.
   * Validated against `requiredObservations`, so evidence mapping cannot drift
   * away from the completion path.
   */
  readonly requiredEvidence: readonly string[];
}

/**
 * A plausible but wrong conclusion, with the evidence that refutes it.
 *
 * docs/UX_USER_FLOW.md and GAME-368 require explanatory feedback rather than
 * "incorrect". A misconception is authored as data so the feedback can quote the
 * values the learner actually collected instead of asserting a correction.
 */
export interface MissionMisconception {
  readonly id: string;
  /** A statement a learner could reasonably make. */
  readonly belief: string;
  /** What the collected evidence shows instead, and why. */
  readonly feedback: string;
  /** Observation keys whose values contradict the belief. */
  readonly refutedBy: readonly string[];
}

/** A progressive hint. Hints point at what to look at; they never answer. */
export interface MissionHint {
  /** 1-based; hints are revealed in order. */
  readonly order: number;
  readonly text: string;
}

/**
 * A fact stated in the debrief.
 *
 * `basis` is deliberately not "optional extra" versus "core". A `measured` fact
 * restates data the learner collected, so it needs no citation beyond the notebook
 * it came from. A `sourced` fact asserts something about the worlds that the
 * learner did *not* measure, so it must cite register entries. Without that rule a
 * debrief is the easiest place in the game to introduce an unsourced claim, which
 * is exactly what `docs/SCIENCE_MODEL.md` §5 forbids.
 */
export interface MissionDebriefFact {
  readonly id: string;
  readonly text: string;
  readonly basis: "measured" | "sourced";
  /** Required for `sourced` facts; must cite at least one register entry. */
  readonly sourceBasisIds: readonly string[];
}

/**
 * What a mission explicitly does not claim.
 *
 * GAME-366's register explains why: MS-ESS1-2 is bounded and qualitative in v1, so
 * a mission that touches orbital context must state that it is context and not a
 * requirement, in the content, where it can be checked.
 */
export interface MissionScienceBoundary {
  readonly id: string;
  readonly statement: string;
}

/**
 * A mission the learner can run.
 *
 * `scaleProperty` is an `AttributeId` and not a free string because
 * docs/SCIENCE_MODEL.md §1 is structural: a v1 mission exists to determine a
 * *scale property*. A mission about a non-scale attribute is not an MS-ESS1-3
 * mission and `validateMissionDefinition` rejects it.
 */
export interface MissionDefinition {
  readonly id: string;
  readonly kind: MissionKind;
  readonly title: string;
  /** Plain-language survey question the learner must answer with data. */
  readonly brief: string;
  /** The scale property this mission is about (docs/SCIENCE_MODEL.md §1.2). */
  readonly scaleProperty: AttributeId;
  readonly targetBodyIds: readonly BodyId[];
  readonly seedBase: Seed;
  /** Set when this mission is a seeded/data variant of another mission. */
  readonly variantOf: string | null;
  /** Target session length in minutes, from docs/PRD.md §5. */
  readonly targetMinutes: number;
  /** The completion path: what the learner must measure. */
  readonly requiredObservations: readonly RequiredObservation[];
  readonly claimTarget: ClaimTarget;
  readonly misconceptions: readonly MissionMisconception[];
  readonly hints: readonly MissionHint[];
  readonly debriefFacts: readonly MissionDebriefFact[];
  readonly scienceBoundaries: readonly MissionScienceBoundary[];
}

/** Everything authored for v1, plus the register its values came from. */
/**
 * Validate the completion path: required observations, evidence mapping, hints,
 * misconceptions, and the stated science boundaries.
 *
 * The rules here are what stop a mission from being solvable by recall. A mission
 * with no required observations, or with a claim whose evidence is not on the
 * completion path, cannot be "completed" by evidence at all — which is a content
 * defect, not a difficulty setting.
 */
function validateMissionCompletionPath(
  mission: MissionDefinition,
  subject: string,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const keys = new Set<string>();

  if (mission.requiredObservations.length === 0) {
    issues.push(
      issue(
        "catalog-no-required-observations",
        subject,
        "A mission must require at least one observation: completion has to depend on data the " +
          "learner produced (docs/PRD.md §1).",
      ),
    );
  }

  for (const observation of mission.requiredObservations) {
    const key = observationKey(observation.bodyId, observation.attributeId);
    if (keys.has(key)) {
      issues.push(
        issue(
          "catalog-duplicate-observation",
          subject,
          `Two required observations share the key ${key}; the evidence mapping would be ambiguous.`,
        ),
      );
    }
    keys.add(key);

    if (!mission.targetBodyIds.includes(observation.bodyId)) {
      issues.push(
        issue(
          "catalog-unknown-body",
          subject,
          `Required observation ${key} is not one of the mission's target worlds.`,
        ),
      );
    }

    const instrument = instrumentDefinition(observation.instrumentId);
    if (!instrument || !instrument.measures.includes(observation.attributeId)) {
      issues.push(
        issue(
          "catalog-claim-not-covered",
          subject,
          `${instrument?.label ?? "That instrument"} cannot measure ${observation.attributeId}, ` +
            `so the required observation ${key} is not obtainable.`,
        ),
      );
    }

    if (observation.purpose.trim() === "") {
      issues.push(
        issue(
          "catalog-empty-field",
          subject,
          `Required observation ${key} needs a purpose the learner can understand.`,
        ),
      );
    }
  }

  const target = mission.claimTarget;
  if (!ATTRIBUTES[target.attributeId].scaleProperty) {
    issues.push(
      issue(
        "catalog-mission-not-a-scale-property",
        subject,
        `Claim target ${target.attributeId} is not a scale property.`,
      ),
    );
  }
  if (target.basis === "proportionOfRadius" && ATTRIBUTES[target.attributeId].kind !== "length") {
    issues.push(
      issue(
        "catalog-claim-not-a-target",
        subject,
        `${target.attributeId} is not a size, so a proportion of radius cannot be its claim basis.`,
      ),
    );
  }
  if (target.assertion.trim() === "") {
    issues.push(
      issue("catalog-empty-field", subject, "A claim target needs an assertion the learner can check."),
    );
  }

  const requiredEvidence = new Set(target.requiredEvidence);
  for (const key of requiredEvidence) {
    if (!keys.has(key)) {
      issues.push(
        issue(
          "catalog-claim-not-covered",
          subject,
          `The claim cites ${key}, which is not on the completion path. Evidence mapping must ` +
            "match the observations the learner is asked to make.",
        ),
      );
    }
  }
  for (const key of [
    observationKey(target.subject, target.attributeId),
    observationKey(target.object, target.attributeId),
  ]) {
    if (!requiredEvidence.has(key)) {
      issues.push(
        issue(
          "catalog-claim-not-covered",
          subject,
          `The claim compares ${key} but does not require it as evidence.`,
        ),
      );
    }
  }
  if (target.basis === "proportionOfRadius") {
    for (const bodyId of [target.subject, target.object]) {
      const key = observationKey(bodyId, "meanRadius");
      if (!requiredEvidence.has(key)) {
        issues.push(
          issue(
            "catalog-claim-not-covered",
            subject,
            `A proportion claim needs the mean radius of ${bodyId} cited, so ${key} must be required evidence.`,
          ),
        );
      }
    }
  }

  for (const fact of mission.debriefFacts) {
    if (fact.id.trim() === "" || fact.text.trim() === "") {
      issues.push(
        issue("catalog-empty-field", subject, "A debrief fact needs an id and text."),
      );
    }
    if (fact.basis === "sourced" && fact.sourceBasisIds.filter((id) => id.trim() !== "").length === 0) {
      issues.push(
        issue(
          "catalog-debrief-fact-unsourced",
          subject,
          `Debrief fact ${fact.id} is marked sourced but cites no register entry. A fact the ` +
            "learner did not measure has to be traceable.",
        ),
      );
    }
  }

  for (const misconception of mission.misconceptions) {
    if (
      misconception.id.trim() === "" ||
      misconception.belief.trim() === "" ||
      misconception.feedback.trim() === ""
    ) {
      issues.push(
        issue(
          "catalog-misconception-incomplete",
          subject,
          "A misconception needs an id, the belief it states, and evidence-based feedback.",
        ),
      );
    }
    if (misconception.refutedBy.length === 0) {
      issues.push(
        issue(
          "catalog-misconception-incomplete",
          subject,
          `Misconception ${misconception.id} names no refuting evidence, so its feedback would ` +
            "assert a correction instead of showing one.",
        ),
      );
    }
  }

  const orders = mission.hints.map((hint) => hint.order);
  if (new Set(orders).size !== orders.length) {
    issues.push(issue("catalog-hint-order", subject, "Two hints share an order value."));
  }
  for (const hint of mission.hints) {
    if (hint.text.trim() === "") {
      issues.push(issue("catalog-empty-field", subject, `Hint ${hint.order} is blank.`));
    }
  }

  if (mission.debriefFacts.length === 0) {
    issues.push(
      issue("catalog-empty-field", subject, "A mission needs at least one debrief fact."),
    );
  }

  if (mission.scienceBoundaries.length === 0) {
    issues.push(
      issue(
        "catalog-empty-field",
        subject,
        "A mission must state at least one science boundary: what it does not claim.",
      ),
    );
  }

  return issues;
}

/**
 * Validate the PRD's v1 content scope, which is a property of the catalogue and
 * not of any single mission: one guided mission, at least two independent ones,
 * and at least one replayable variant (docs/PRD.md §6).
 *
 * An empty catalogue is *not* a scope failure. "No content yet" is a declared
 * state — the register version says `unpopulated` — and PS-02/PS-03 shipped it
 * deliberately, so failing it here would make the honest empty build look broken
 * and would push authors toward placeholder content to silence the check. The
 * moment there is any content, the whole scope applies.
 */
export function validateV1Scope(catalog: MissionCatalog): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (catalog.bodies.length === 0 && catalog.missions.length === 0) {
    return issues;
  }
  const guided = catalog.missions.filter(
    (mission) => mission.kind === "guided" && mission.variantOf === null,
  );
  const independent = catalog.missions.filter(
    (mission) => mission.kind === "independent" && mission.variantOf === null,
  );
  const variants = catalog.missions.filter((mission) => mission.variantOf !== null);

  if (guided.length !== 1) {
    issues.push(
      issue(
        "catalog-v1-scope",
        "catalog",
        `v1 requires exactly one guided mission; found ${guided.length}.`,
      ),
    );
  }
  if (independent.length < 2) {
    issues.push(
      issue(
        "catalog-v1-scope",
        "catalog",
        `v1 requires at least two independently solvable missions; found ${independent.length}.`,
      ),
    );
  }
  if (variants.length < 1) {
    issues.push(
      issue("catalog-v1-scope", "catalog", "v1 requires at least one replayable variant; found 0."),
    );
  }

  const missionIds = new Set(catalog.missions.map((mission) => mission.id));
  for (const variant of variants) {
    if (!variant.variantOf || !missionIds.has(variant.variantOf)) {
      issues.push(
        issue(
          "catalog-v1-scope",
          `mission:${variant.id}`,
          `Variant refers to "${String(variant.variantOf)}", which is not a mission in this catalog.`,
        ),
      );
    }
  }

  return issues;
}

export interface MissionCatalog {
  readonly registerVersion: string;
  readonly bodies: readonly BodyRecord[];
  readonly missions: readonly MissionDefinition[];
}

/** The session-length window docs/PRD.md §5 allows a v1 mission to target. */
export const MIN_TARGET_MINUTES = 5;
export const MAX_TARGET_MINUTES = 25;

function issue(
  code: ValidationIssue["code"],
  subject: string,
  message: string,
): ValidationIssue {
  return { severity: "error", code, subject, message };
}

/** Validate one mission against the science contract and the v1 scope. */
export function validateMissionDefinition(
  mission: MissionDefinition,
  knownBodyIds: readonly BodyId[],
): readonly ValidationIssue[] {
  const subject = `mission:${mission.id}`;
  const issues: ValidationIssue[] = [];
  issues.push(...validateMissionCompletionPath(mission, subject));

  if (mission.id.trim() === "") {
    issues.push(issue("catalog-empty-field", subject, "A mission needs an id."));
  }
  if (mission.title.trim() === "" || mission.brief.trim() === "") {
    issues.push(
      issue("catalog-empty-field", subject, "A mission needs a title and a brief the learner can read."),
    );
  }

  if (mission.targetBodyIds.length < 2) {
    issues.push(
      issue(
        "catalog-mission-needs-two-targets",
        subject,
        "A survey mission compares at least two worlds: a single target cannot determine a " +
          "scale property by comparison (docs/SCIENCE_MODEL.md §1.2).",
      ),
    );
  }

  const unknown = mission.targetBodyIds.filter((bodyId) => !knownBodyIds.includes(bodyId));
  if (unknown.length > 0) {
    issues.push(
      issue(
        "catalog-unknown-body",
        subject,
        `Targets not in the catalog: ${unknown.join(", ")}.`,
      ),
    );
  }

  if (!ATTRIBUTES[mission.scaleProperty].scaleProperty) {
    issues.push(
      issue(
        "catalog-mission-not-a-scale-property",
        subject,
        `"${mission.scaleProperty}" is not a scale property, so a mission about it is not an ` +
          "MS-ESS1-3 mission (docs/SCIENCE_MODEL.md §1.1).",
      ),
    );
  }

  if (
    !Number.isInteger(mission.seedBase) ||
    mission.seedBase < 0 ||
    mission.seedBase > 0xffffffff
  ) {
    issues.push(
      issue(
        "catalog-seed-out-of-range",
        subject,
        `seedBase must be a 32-bit unsigned integer; received ${String(mission.seedBase)}.`,
      ),
    );
  }

  if (
    !Number.isFinite(mission.targetMinutes) ||
    mission.targetMinutes < MIN_TARGET_MINUTES ||
    mission.targetMinutes > MAX_TARGET_MINUTES
  ) {
    issues.push(
      issue(
        "catalog-target-duration",
        subject,
        `targetMinutes must be within ${MIN_TARGET_MINUTES}..${MAX_TARGET_MINUTES} ` +
          `(docs/PRD.md §5); received ${String(mission.targetMinutes)}.`,
      ),
    );
  }

  return issues;
}

/**
 * Validate a whole catalog: unique ids, known targets, and a register version that
 * matches the bodies it is meant to describe.
 */
export function validateCatalog(catalog: MissionCatalog): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const bodyIds: BodyId[] = [];
  const seenBodyIds = new Set<BodyId>();

  for (const body of catalog.bodies) {
    if (seenBodyIds.has(body.id)) {
      issues.push(
        issue("catalog-duplicate-id", `body:${body.id}`, "Two bodies share this id."),
      );
    }
    seenBodyIds.add(body.id);
    bodyIds.push(body.id);
  }

  const seenMissionIds = new Set<string>();
  for (const mission of catalog.missions) {
    if (seenMissionIds.has(mission.id)) {
      issues.push(
        issue("catalog-duplicate-id", `mission:${mission.id}`, "Two missions share this id."),
      );
    }
    seenMissionIds.add(mission.id);
    issues.push(...validateMissionDefinition(mission, bodyIds));
  }

  // The v1 scope is checked here rather than in `validateMissionDefinition`
  // because "at least two independent missions" is a property of the set.
  issues.push(...validateV1Scope(catalog));

  return issues;
}

/** One attribute value inside a data snapshot. Unit and provenance travel with it. */
export interface SnapshotAttribute {
  readonly attributeId: AttributeId;
  readonly value: number;
  readonly unit: Unit;
  readonly sourceId: string;
  readonly significantDigits: number;
  readonly reviewStatus: ReviewStatus;
  readonly appliesToEpoch?: string;
}

export interface SnapshotBody {
  readonly bodyId: BodyId;
  readonly displayName: string;
  readonly registerVersion: string;
  readonly scienceReviewed: boolean;
  /** Sorted by attribute id, so authoring order cannot change a digest. */
  readonly attributes: readonly SnapshotAttribute[];
}

/**
 * The scientifically load-bearing part of a mission, as data.
 *
 * Hints, misconceptions, debrief wording and learner-facing text are deliberately
 * excluded: they are presentation, and a snapshot exists so two builds can prove
 * the *facts* and the *completion path* are identical.
 */
export interface SnapshotMission {
  readonly missionId: string;
  readonly kind: MissionKind;
  readonly title: string;
  readonly scaleProperty: AttributeId;
  readonly targetBodyIds: readonly BodyId[];
  readonly seedBase: Seed;
  readonly variantOf: string | null;
  readonly targetMinutes: number;
  /** Sorted observation keys, so authoring order cannot change the digest. */
  readonly requiredObservationKeys: readonly string[];
  readonly claimTarget: {
    readonly attributeId: AttributeId;
    readonly basis: ClaimBasis;
    readonly subject: BodyId;
    readonly relation: ClaimRelation;
    readonly object: BodyId;
    readonly requiredEvidence: readonly string[];
  };
}

export interface MissionDataSnapshot {
  readonly schemaVersion: number;
  /** The seed whose run this snapshot was captured for. Never affects the facts. */
  readonly seed: Seed;
  readonly registerVersion: string;
  readonly registerDigest: string;
  /** Digest over the facts only, so it is stable across seeds. */
  readonly factsDigest: string;
  readonly bodies: readonly SnapshotBody[];
  readonly missions: readonly SnapshotMission[];
}

/**
 * Bumped whenever the snapshot shape changes.
 *
 * v2 added the mission kind, the completion path, and the claim target, because a
 * snapshot that omits what a mission *requires* cannot prove that two builds grade
 * the same thing.
 */
export const MISSION_DATA_SNAPSHOT_SCHEMA_VERSION = 2;

/**
 * The magnitude of a value in the attribute's declared canonical unit.
 *
 * A snapshot always states values in one unit per attribute, so a snapshot cannot
 * differ between two runs merely because an author typed `m` where they meant
 * `km`. A kind mismatch is returned unchanged here because `validateSourcedValue`
 * is what reports it; the snapshot's job is to be deterministic, not to validate.
 */
function snapshotQuantity(attributeId: AttributeId, value: Quantity): number {
  const definition = ATTRIBUTES[attributeId];
  if (unitKind(value.unit) !== definition.kind) return value.value;
  return convertTo(value, definition.canonicalUnit).value;
}

function snapshotBody(body: BodyRecord): SnapshotBody {
  // Sorted by attribute id so authoring order cannot change a digest, and filtered
  // in the same pass so there is no "should be impossible" fallback to get wrong.
  const entries = (Object.keys(body.attributes) as AttributeId[])
    .map((attributeId) => [attributeId, body.attributes[attributeId]] as const)
    .filter((entry): entry is readonly [AttributeId, SourcedValue] => entry[1] !== undefined)
    .sort((left, right) => (left[0] < right[0] ? -1 : 1));

  const attributes: SnapshotAttribute[] = entries.map(([attributeId, sourced]) => ({
    attributeId,
    value: snapshotQuantity(attributeId, sourced.value),
    unit: ATTRIBUTES[attributeId].canonicalUnit,
    sourceId: sourced.sourceId,
    significantDigits: sourced.significantDigits,
    reviewStatus: sourced.reviewStatus,
    ...(sourced.appliesToEpoch !== undefined ? { appliesToEpoch: sourced.appliesToEpoch } : {}),
  }));

  return {
    bodyId: body.id,
    displayName: body.displayName,
    registerVersion: body.provenance.registerVersion,
    scienceReviewed: body.provenance.scienceReviewed,
    attributes,
  };
}

function snapshotMission(mission: MissionDefinition): SnapshotMission {
  return {
    missionId: mission.id,
    kind: mission.kind,
    title: mission.title,
    scaleProperty: mission.scaleProperty,
    targetBodyIds: [...mission.targetBodyIds],
    seedBase: mission.seedBase,
    variantOf: mission.variantOf,
    targetMinutes: mission.targetMinutes,
    requiredObservationKeys: mission.requiredObservations
      .map((observation) => observationKey(observation.bodyId, observation.attributeId))
      .sort(),
    claimTarget: {
      attributeId: mission.claimTarget.attributeId,
      basis: mission.claimTarget.basis,
      subject: mission.claimTarget.subject,
      relation: mission.claimTarget.relation,
      object: mission.claimTarget.object,
      requiredEvidence: [...mission.claimTarget.requiredEvidence].sort(),
    },
  };
}

/**
 * Build the deterministic data snapshot for a seed.
 *
 * Same catalog + same register + same seed ⇒ identical serialization, on any
 * device, in any order of authoring, with or without a renderer. Determinism is
 * achieved structurally (sorted ids) rather than by trusting authoring order.
 */
export function buildMissionDataSnapshot(input: {
  readonly catalog: MissionCatalog;
  readonly register: SourceRegister;
  readonly seed: Seed;
}): MissionDataSnapshot {
  const { catalog, register, seed } = input;

  const bodies = [...catalog.bodies]
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map(snapshotBody);

  const missions = [...catalog.missions]
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map(snapshotMission);

  const digest = registerDigest(register);

  return {
    schemaVersion: MISSION_DATA_SNAPSHOT_SCHEMA_VERSION,
    seed,
    registerVersion: register.version,
    registerDigest: digest,
    factsDigest: digestOf({ bodies, missions, registerDigest: digest }),
    bodies,
    missions,
  };
}

/** Canonical serialization of a snapshot, for golden fixtures and diagnostics. */
export function serializeMissionDataSnapshot(snapshot: MissionDataSnapshot): string {
  return canonicalJson(snapshot);
}
