/**
 * Comparison over captured evidence.
 *
 * Comparing worlds is a required, gated step in the loop
 * (docs/UX_USER_FLOW.md step 7): at least two bodies must share a comparable
 * attribute before a claim can be submitted. This is what stops the game from
 * becoming a single-body fact lookup.
 *
 * Comparisons are computed here, in the domain, so that the chart and the
 * accessible data table are guaranteed to describe the same numbers
 * (docs/ACCESSIBILITY.md A-13).
 */

import { ATTRIBUTES, type AttributeId } from "./attributes";
import type { BodyId } from "./bodies";
import { distinctBodyIds, type EvidenceRecord } from "./evidence";
import { compareQuantities, convertTo, quantity, type Quantity, type Unit } from "./quantities";

/** The minimum number of distinct bodies a v1 claim may rest on. */
export const MINIMUM_COMPARISON_BODIES = 2;

export interface ComparisonEntry {
  readonly bodyId: BodyId;
  readonly evidenceId: string;
  readonly value: Quantity;
  readonly sourceId: string;
  readonly significantDigits: number;
}

export interface ComparativeFinding {
  readonly attributeId: AttributeId;
  /** The single unit every entry was normalized to. */
  readonly unit: Unit;
  readonly entries: readonly ComparisonEntry[];
  /** Body ids ordered from largest to smallest in `unit`. */
  readonly ordering: readonly BodyId[];
  /** Largest / smallest, or null when the smallest value is zero. */
  readonly ratio: number | null;
  /**
   * True when the attribute is a proportion of body radius, i.e. the comparison
   * is about relative scale rather than absolute size (learning objective LO-3).
   */
  readonly proportional: boolean;
}

export type ComparisonResult =
  | {
      readonly kind: "insufficient";
      readonly attributeId: AttributeId;
      readonly presentBodies: readonly BodyId[];
      readonly explanation: string;
    }
  | { readonly kind: "finding"; readonly finding: ComparativeFinding };

/**
 * Compare one attribute across every evidence record that measured it.
 *
 * All entries are normalized into the attribute's canonical unit before
 * ordering, so a comparison can never mix metres with kilometres.
 */
export function compareByAttribute(
  records: readonly EvidenceRecord[],
  attributeId: AttributeId,
): ComparisonResult {
  const definition = ATTRIBUTES[attributeId];
  const matching = records.filter((record) => record.attributeId === attributeId);

  // One entry per body: evidence capture already rejects duplicates, but a body
  // could in principle be measured with two instruments, so keep the first.
  const byBody = new Map<BodyId, EvidenceRecord>();
  for (const record of matching) {
    if (!byBody.has(record.bodyId)) byBody.set(record.bodyId, record);
  }

  if (byBody.size < MINIMUM_COMPARISON_BODIES) {
    return {
      kind: "insufficient",
      attributeId,
      presentBodies: distinctBodyIds(matching),
      explanation: `Comparing ${definition.label.toLowerCase()} needs at least ${MINIMUM_COMPARISON_BODIES} worlds with a captured measurement. Capture another world's value first.`,
    };
  }

  const entries: readonly ComparisonEntry[] = [...byBody.values()]
    .map((record) => ({
      bodyId: record.bodyId,
      evidenceId: record.id,
      value: convertTo(record.reading, definition.canonicalUnit),
      sourceId: record.sourceId,
      significantDigits: record.significantDigits,
    }))
    .sort((left, right) => left.bodyId.localeCompare(right.bodyId));

  const ordered = [...entries].sort((left, right) =>
    compareQuantities(right.value, left.value) || left.bodyId.localeCompare(right.bodyId),
  );

  const largest = ordered[0];
  const smallest = ordered[ordered.length - 1];
  const ratio =
    largest && smallest && smallest.value.value !== 0
      ? largest.value.value / smallest.value.value
      : null;

  return {
    kind: "finding",
    finding: {
      attributeId,
      unit: definition.canonicalUnit,
      entries,
      ordering: ordered.map((entry) => entry.bodyId),
      ratio,
      proportional: definition.relativeToBodyRadius,
    },
  };
}

/** Every attribute that currently has enough evidence to compare. */
export function comparableAttributes(records: readonly EvidenceRecord[]): readonly AttributeId[] {
  const attributes = new Set<AttributeId>();
  for (const record of records) attributes.add(record.attributeId);
  return [...attributes].filter((attributeId) => {
    const result = compareByAttribute(records, attributeId);
    return result.kind === "finding";
  });
}

/** All findings that can be computed from the current notebook. */
export function compareEvidence(records: readonly EvidenceRecord[]): readonly ComparativeFinding[] {
  return comparableAttributes(records).flatMap((attributeId) => {
    const result = compareByAttribute(records, attributeId);
    return result.kind === "finding" ? [result.finding] : [];
  });
}

/** A presentation-ready proportion, or null when it cannot be justified. */
export function proportionalReading(
  finding: ComparativeFinding,
  bodyId: BodyId,
): number | null {
  const entry = finding.entries.find((candidate) => candidate.bodyId === bodyId);
  const largest = finding.entries.reduce<ComparisonEntry | null>(
    (best, candidate) => (best === null || candidate.value.value > best.value.value ? candidate : best),
    null,
  );
  if (!entry || !largest || largest.value.value === 0) return null;
  return entry.value.value / largest.value.value;
}

export { quantity };
