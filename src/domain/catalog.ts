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
import { convertTo, unitKind, type Quantity, type Unit } from "./quantities";
import type { Seed } from "./random";
import { registerDigest, type SourceRegister } from "./register";
import type { ValidationIssue } from "./validation";

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
}

/** Everything authored for v1, plus the register its values came from. */
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

export interface SnapshotMission {
  readonly missionId: string;
  readonly title: string;
  readonly scaleProperty: AttributeId;
  readonly targetBodyIds: readonly BodyId[];
  readonly seedBase: Seed;
  readonly variantOf: string | null;
  readonly targetMinutes: number;
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

export const MISSION_DATA_SNAPSHOT_SCHEMA_VERSION = 1;

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
    title: mission.title,
    scaleProperty: mission.scaleProperty,
    targetBodyIds: [...mission.targetBodyIds],
    seedBase: mission.seedBase,
    variantOf: mission.variantOf,
    targetMinutes: mission.targetMinutes,
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
