/**
 * The source register: the register container, field resolution, and freshness.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * `sources.ts` says what a citation must look like. This module does three things
 * with a set of citations:
 *
 *  1. **Resolves a field to its authority.** `resolveSource` is the only way a
 *     displayed value's `sourceId` becomes a record, and it refuses to resolve to a
 *     locator: a locator is how an author found a source, not a source.
 *  2. **Proves nothing shipped unsourced.** `validateBodiesAgainstRegister` reports
 *     every body attribute that has a value but no value-source entry — the check
 *     behind "every scored/required fact resolves to a source record" (GAME-366).
 *  3. **Is deterministic.** Serialization sorts keys and entries, so the same
 *     register content always produces the same digest regardless of authoring
 *     order, and freshness is computed from two dates rather than from the clock.
 *
 * No ambient time, no bundler metadata, no I/O: a register's age is a function of
 * the dates recorded in it, which is what makes it reproducible in a test and in
 * a build rather than dependent on when it happened to run.
 */

import { ATTRIBUTE_IDS, type AttributeId } from "./attributes";
import type { BodyRecord } from "./bodies";
import type { MissionCatalog } from "./catalog";
import { canonicalJson, digestOf } from "./canonical";
import {
  SOURCE_POLICY_VERSION,
  isIsoDate,
  isoDateToDayNumber,
  mayCarryDisplayedValue,
  sourceClassRank,
  validateSourceRecord,
  type IsoDate,
  type SourceRecord,
} from "./sources";
import { hasBlockingIssues, type ValidationIssue } from "./validation";

export interface SourceRegister {
  /** Version of the register content. Recorded in release and cache identities. */
  readonly version: string;
  /** Version of the source policy the register conforms to. */
  readonly policyVersion: string;
  /** The date this register was assembled. */
  readonly retrievedOn: IsoDate;
  readonly entries: readonly SourceRecord[];
}

/** An empty, honest register: no entries, no claims to have any. */
export function emptyRegister(version: string, retrievedOn: IsoDate): SourceRegister {
  return { version, policyVersion: SOURCE_POLICY_VERSION, retrievedOn, entries: [] };
}

function fieldKey(bodyId: string, attributeId: string): string {
  return `${bodyId}::${attributeId}`;
}

export interface RegisterIndex {
  readonly byId: ReadonlyMap<string, SourceRecord>;
  /** All records about one body/attribute pair, in file order. */
  readonly byField: ReadonlyMap<string, readonly SourceRecord[]>;
}

export function createRegisterIndex(register: SourceRegister): RegisterIndex {
  const byId = new Map<string, SourceRecord>();
  const byField = new Map<string, SourceRecord[]>();

  for (const entry of register.entries) {
    byId.set(entry.id, entry);
    const key = fieldKey(entry.bodyId, entry.attributeId);
    const bucket = byField.get(key);
    if (bucket) bucket.push(entry);
    else byField.set(key, [entry]);
  }

  return { byId, byField };
}

/**
 * Look up one record by id.
 *
 * Builds an index for the lookup, so a caller resolving many fields should build
 * one index with `createRegisterIndex` and reuse it — which is what
 * `validateBodiesAgainstRegister` does.
 */
export function findSourceById(register: SourceRegister, sourceId: string): SourceRecord | undefined {
  return createRegisterIndex(register).byId.get(sourceId);
}

/** All records about one body/attribute pair. Index-building, as `findSourceById`. */
export function sourcesFor(
  register: SourceRegister,
  bodyId: string,
  attributeId: AttributeId,
): readonly SourceRecord[] {
  return createRegisterIndex(register).byField.get(fieldKey(bodyId, attributeId)) ?? [];
}

/**
 * The authority for one body/attribute field.
 *
 * Only a `value-source` with an accepted source class can resolve, and the most
 * preferred class wins where a field has more than one entry. Returning
 * `undefined` is meaningful: the game reports the gap instead of displaying a
 * plausible-looking number (docs/SCIENCE_MODEL.md §8).
 */
export function resolveSource(
  register: SourceRegister,
  bodyId: string,
  attributeId: AttributeId,
): SourceRecord | undefined {
  const candidates = sourcesFor(register, bodyId, attributeId).filter(
    (entry) => entry.role === "value-source" && mayCarryDisplayedValue(entry.sourceClass),
  );
  if (candidates.length === 0) return undefined;

  return [...candidates].sort(
    (left, right) => sourceClassRank(left.sourceClass) - sourceClassRank(right.sourceClass),
  )[0];
}

/**
 * Validate the register itself: entry-level rules plus the cross-entry rules that
 * make a *set* of citations usable.
 */
export function validateRegister(register: SourceRegister): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (register.version.trim() === "") {
    issues.push({
      severity: "error",
      code: "register-empty-version",
      subject: "register",
      message:
        "The register needs a version: release, cache, and manifest identities all record it, " +
        "and a value cannot be re-derived from an unversioned register.",
    });
  }

  if (register.policyVersion !== SOURCE_POLICY_VERSION) {
    issues.push({
      severity: "error",
      code: "register-policy-version-mismatch",
      subject: "register",
      message:
        `Register declares policy "${register.policyVersion}" but this build implements ` +
        `"${SOURCE_POLICY_VERSION}". Re-review the register against the current policy.`,
    });
  }

  if (!isIsoDate(register.retrievedOn)) {
    issues.push({
      severity: "error",
      code: "source-malformed-date",
      subject: "register",
      message: `retrievedOn must be a real ISO date (YYYY-MM-DD); received "${register.retrievedOn}".`,
    });
  }

  const seenIds = new Set<string>();
  const seenFields = new Set<string>();

  for (const entry of register.entries) {
    issues.push(...validateSourceRecord(entry));

    const subject = `source:${entry.id}`;

    if (seenIds.has(entry.id)) {
      issues.push({
        severity: "error",
        code: "register-duplicate-source-id",
        subject,
        message:
          "Two register entries share this id, so a value citing it no longer identifies one authority.",
      });
    }
    seenIds.add(entry.id);

    if (entry.role === "value-source") {
      const key = fieldKey(entry.bodyId, entry.attributeId);
      if (seenFields.has(key)) {
        issues.push({
          severity: "error",
          code: "register-duplicate-field-entry",
          subject,
          message:
            `Another value-source already covers ${entry.bodyId}/${entry.attributeId}. ` +
            "Two authorities for one displayed number is ambiguity, not redundancy.",
        });
      }
      seenFields.add(key);
      if (!ATTRIBUTE_IDS.includes(entry.attributeId as AttributeId)) {
        issues.push({
          severity: "error",
          code: "source-unknown-attribute",
          subject,
          message: `"${entry.attributeId}" is not an attribute in the science contract.`,
        });
      }
    }

    if (
      isIsoDate(entry.retrievedOn) &&
      isIsoDate(register.retrievedOn) &&
      entry.retrievedOn > register.retrievedOn
    ) {
      issues.push({
        severity: "error",
        code: "register-entry-newer-than-register",
        subject,
        message:
          `Entry was retrieved ${entry.retrievedOn}, after the register's own retrievedOn ` +
          `(${register.retrievedOn}): the register cannot predate its own evidence.`,
      });
    }
  }

  return issues;
}

/**
 * Validate that every value a body displays has a resolvable authority.
 *
 * This is the mechanical form of "a value with no register entry cannot ship"
 * (docs/SCIENCE_MODEL.md §5.2). It reports one issue per offending field rather
 * than one per body, so an author sees exactly what to cite.
 */
export function validateBodiesAgainstRegister(
  bodies: readonly BodyRecord[],
  register: SourceRegister,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // One index for the whole sweep: this is the check that walks every field of
  // every body, so it must not rebuild an index per attribute.
  const index = createRegisterIndex(register);

  for (const body of bodies) {
    if (body.provenance.registerVersion !== register.version) {
      issues.push({
        severity: "error",
        code: "register-version-mismatch",
        subject: `body:${body.id}`,
        message:
          `Body was authored against register "${body.provenance.registerVersion}" but the ` +
          `register in this build is "${register.version}". Re-derive the values.`,
      });
    }

    for (const [attributeId, sourced] of Object.entries(body.attributes)) {
      if (!sourced) continue;
      const subject = `body:${body.id}:${attributeId}`;
      const record = index.byId.get(sourced.sourceId);

      if (!record) {
        issues.push({
          severity: "error",
          code: "value-without-register-entry",
          subject,
          message:
            `Value cites source "${sourced.sourceId}", which is not in register ` +
            `"${register.version}". An uncited value cannot ship.`,
        });
        continue;
      }

      if (record.role !== "value-source" || !mayCarryDisplayedValue(record.sourceClass)) {
        issues.push({
          severity: "error",
          code: "value-references-missing-source",
          subject,
          message:
            `Source "${record.id}" is a ${record.role} of class "${record.sourceClass}", which ` +
            "cannot originate a displayed value.",
        });
      }

      if (record.attributeId !== attributeId) {
        issues.push({
          severity: "error",
          code: "value-source-attribute-mismatch",
          subject,
          message: `Source "${record.id}" is registered for "${record.attributeId}".`,
        });
      }

      if (record.bodyId !== body.id) {
        issues.push({
          severity: "error",
          code: "value-source-body-mismatch",
          subject,
          message: `Source "${record.id}" is registered for body "${record.bodyId}".`,
        });
      }
    }
  }

  return issues;
}

/**
 * Validate that no mission requires a value whose authority is in dispute.
 *
 * This is the rule that makes `reviewStatus: "contested"` mean something. A
 * contested value may sit in the register — recording a disagreement is better
 * than hiding one — but it must not become a completion requirement, because a
 * mission that grades a disputed number teaches a dispute as a fact.
 */
export function validateMissionsAgainstRegister(
  catalog: MissionCatalog,
  register: SourceRegister,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const index = createRegisterIndex(register);

  for (const mission of catalog.missions) {
    for (const observation of mission.requiredObservations) {
      const subject = `mission:${mission.id}:${observation.bodyId}.${observation.attributeId}`;
      const body = catalog.bodies.find((candidate) => candidate.id === observation.bodyId);
      const sourced = body?.attributes[observation.attributeId];
      if (!sourced) {
        issues.push({
          severity: "error",
          code: "value-without-register-entry",
          subject,
          message: "A required observation has no value on its target body.",
        });
        continue;
      }

      const record = index.byId.get(sourced.sourceId);
      if (!record) {
        issues.push({
          severity: "error",
          code: "value-without-register-entry",
          subject,
          message: `Required value cites "${sourced.sourceId}", which is not in the register.`,
        });
        continue;
      }

      if (record.reviewStatus === "contested") {
        issues.push({
          severity: "error",
          code: "catalog-contested-value-required",
          subject,
          message:
            `The mission requires a value marked contested (${record.reviewNote || "no note"}). ` +
            "Resolve the dispute or take the value off the completion path.",
        });
      }
    }
  }

  return issues;
}

/**
 * Canonical serialization of a register.
 *
 * Entries are sorted by id and keys are sorted, so a register authored in a
 * different order still serializes identically. That is what lets a digest be a
 * stable identity rather than a record of edit history.
 */
export function serializeRegister(register: SourceRegister): string {
  return canonicalJson({
    version: register.version,
    policyVersion: register.policyVersion,
    retrievedOn: register.retrievedOn,
    entries: [...register.entries].sort((left, right) => (left.id < right.id ? -1 : 1)),
  });
}

/** Stable identity of the register *content*. */
export function registerDigest(register: SourceRegister): string {
  return digestOf(serializeRegister(register));
}

export type FreshnessState = "unknown" | "current" | "aging" | "stale";

export interface FreshnessThresholds {
  /** Age at which a value is reported as aging (still usable, worth re-checking). */
  readonly agingDays: number;
  /** Age at which a value is reported as stale (re-retrieve before it ships). */
  readonly staleDays: number;
}

/**
 * Default freshness thresholds.
 *
 * Two and five years reflect how often agency physical-parameter values actually
 * change: a radius is stable for decades, an epoch-dependent orbit is not. Values
 * that move with an epoch are additionally flagged by `appliesToEpoch` on the
 * record itself, because a date cannot express that.
 */
export const DEFAULT_FRESHNESS_THRESHOLDS: FreshnessThresholds = {
  agingDays: 730,
  staleDays: 1825,
};

export interface SourceFreshness {
  readonly sourceId: string;
  readonly retrievedOn: IsoDate;
  /** Whole days between `asOf` and the retrieval date; negative if future-dated. */
  readonly ageInDays: number;
  readonly state: FreshnessState;
}

export interface FreshnessReport {
  readonly asOf: IsoDate;
  readonly thresholds: FreshnessThresholds;
  readonly entries: readonly SourceFreshness[];
  /** Worst state across the register; `unknown` when the register is empty. */
  readonly state: FreshnessState;
  /** The oldest entry's age, or `null` for an empty register. */
  readonly oldestAgeInDays: number | null;
}

function classify(ageInDays: number, thresholds: FreshnessThresholds): FreshnessState {
  if (ageInDays >= thresholds.staleDays) return "stale";
  if (ageInDays >= thresholds.agingDays) return "aging";
  return "current";
}

const STATE_SEVERITY: Readonly<Record<FreshnessState, number>> = {
  unknown: 0,
  current: 1,
  aging: 2,
  stale: 3,
};

/**
 * Report how fresh a register is, as of a supplied date.
 *
 * `asOf` is an argument rather than the clock: a build must be able to state
 * "this register is current as of its own retrieval date" without the answer
 * changing between two runs of the same commit.
 */
export function assessRegisterFreshness(
  register: SourceRegister,
  asOf: IsoDate,
  thresholds: FreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS,
): FreshnessReport {
  const asOfDay = isoDateToDayNumber(asOf);
  const entries: SourceFreshness[] = [];
  let oldest: number | null = null;
  let state: FreshnessState = "unknown";

  for (const entry of register.entries) {
    const retrievedDay = isoDateToDayNumber(entry.retrievedOn);
    if (asOfDay === null || retrievedDay === null) {
      entries.push({
        sourceId: entry.id,
        retrievedOn: entry.retrievedOn,
        ageInDays: 0,
        state: "unknown",
      });
      continue;
    }
    const ageInDays = asOfDay - retrievedDay;
    const entryState = classify(ageInDays, thresholds);
    entries.push({ sourceId: entry.id, retrievedOn: entry.retrievedOn, ageInDays, state: entryState });
    if (oldest === null || ageInDays > oldest) oldest = ageInDays;
    if (STATE_SEVERITY[entryState] > STATE_SEVERITY[state]) state = entryState;
  }

  return { asOf, thresholds, entries, state, oldestAgeInDays: oldest };
}

/**
 * Throw unless the register is internally valid.
 *
 * For build and test call sites that should fail loudly rather than continue with
 * a register the application would have to defend against.
 */
export function assertRegisterValid(register: SourceRegister): void {
  const issues = validateRegister(register);
  if (hasBlockingIssues(issues)) {
    throw new Error(
      `Source register "${register.version}" is invalid:\n${issues
        .filter((issue) => issue.severity === "error")
        .map((issue) => `  ${issue.code} ${issue.subject}: ${issue.message}`)
        .join("\n")}`,
    );
  }
}
