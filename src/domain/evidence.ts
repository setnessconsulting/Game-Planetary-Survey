/**
 * Evidence records.
 *
 * Evidence capture is an explicit learner action: observation without capture
 * does not advance a mission (docs/UX_USER_FLOW.md step 6). Records are
 * immutable and carry their provenance, so a claim can cite exactly what was
 * measured, with which instrument, and from which source.
 */

import type { AttributeId } from "./attributes";
import type { BodyId } from "./bodies";
import type { MeasurementOutcome } from "./measurement";
import type { InstrumentId } from "./measurement";
import type { Quantity } from "./quantities";

export interface EvidenceRecord {
  readonly id: string;
  readonly bodyId: BodyId;
  readonly attributeId: AttributeId;
  readonly instrumentId: InstrumentId;
  /** The authoritative value as measured, at the source's precision. */
  readonly reading: Quantity;
  readonly sourceId: string;
  readonly significantDigits: number;
  /** Monotonic capture order, so a notebook has a stable learner-visible order. */
  readonly order: number;
}

export type CaptureRejection =
  | { readonly kind: "not-measured"; readonly explanation: string }
  | { readonly kind: "already-captured"; readonly existingId: string };

export type CaptureResult =
  | { readonly kind: "captured"; readonly records: readonly EvidenceRecord[]; readonly record: EvidenceRecord }
  | { readonly kind: "rejected"; readonly records: readonly EvidenceRecord[]; readonly rejection: CaptureRejection };

/**
 * Append a measurement to the notebook.
 *
 * Rejects an unavailable measurement (there is nothing to keep) and rejects a
 * duplicate of the same observation, so the notebook cannot be padded with
 * repeated copies of one reading to satisfy a citation requirement.
 */
export function captureEvidence(
  records: readonly EvidenceRecord[],
  outcome: MeasurementOutcome,
): CaptureResult {
  if (outcome.kind === "unavailable") {
    return {
      kind: "rejected",
      records,
      rejection: {
        kind: "not-measured",
        explanation: outcome.explanation,
      },
    };
  }

  const existing = records.find((record) => record.id === outcome.observationId);
  if (existing) {
    return {
      kind: "rejected",
      records,
      rejection: { kind: "already-captured", existingId: existing.id },
    };
  }

  const record: EvidenceRecord = {
    id: outcome.observationId,
    bodyId: outcome.request.bodyId,
    attributeId: outcome.request.attributeId,
    instrumentId: outcome.request.instrumentId,
    reading: outcome.reading,
    sourceId: outcome.sourceId,
    significantDigits: outcome.significantDigits,
    order: records.length,
  };

  return { kind: "captured", records: [...records, record], record };
}

export function evidenceForAttribute(
  records: readonly EvidenceRecord[],
  attributeId: AttributeId,
): readonly EvidenceRecord[] {
  return records.filter((record) => record.attributeId === attributeId);
}

export function distinctBodyIds(records: readonly EvidenceRecord[]): readonly BodyId[] {
  const seen = new Set<BodyId>();
  for (const record of records) seen.add(record.bodyId);
  return [...seen];
}

export function citedRecords(
  records: readonly EvidenceRecord[],
  citedIds: readonly string[],
): readonly EvidenceRecord[] {
  const wanted = new Set(citedIds);
  return records.filter((record) => wanted.has(record.id));
}
