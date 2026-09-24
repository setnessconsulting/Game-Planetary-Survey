/**
 * Instruments and the pure measurement contract.
 *
 * THE MEASUREMENT RULE (docs/TECHNICAL_DESIGN.md §4.4): no measurement may
 * originate in the renderer. A measurement is a pure function of
 * (instrument, body, attribute, seed) plus the source register.
 *
 * A seed selects an observation's *identity* (so a variant run is reproducible
 * and traceable). It never perturbs a scientific value: what the learner measures
 * is always the sourced value at the precision the source supports. Adding
 * physically-plausible noise here would fabricate evidence and is prohibited by
 * docs/SCIENCE_MODEL.md §8.
 */

import { ATTRIBUTES, type AttributeId } from "./attributes";
import { sourcedAttribute, type BodyId, type BodyRecord } from "./bodies";
import { quantity, type Quantity } from "./quantities";
import { deriveSeed, seedToken, type Seed } from "./random";

export type InstrumentId =
  | "radiusSounder"
  | "orbitalRangefinder"
  | "atmosphereSounder"
  | "altimeter"
  | "thermalMapper";

export interface InstrumentDefinition {
  readonly id: InstrumentId;
  readonly label: string;
  /** What the learner is choosing this instrument *for*. */
  readonly purpose: string;
  readonly measures: readonly AttributeId[];
  /** Opportunity cost, in mission ticks. Makes instrument choice a real trade. */
  readonly costTicks: number;
  /** Honest statement of what the instrument cannot resolve. */
  readonly limitation: string;
}

export const INSTRUMENTS: readonly InstrumentDefinition[] = [
  {
    id: "radiusSounder",
    label: "Radius sounder",
    purpose: "Measure how wide a world is, from the centre out to its surface.",
    measures: ["meanRadius", "equatorialRadius", "polarRadius"],
    costTicks: 1,
    limitation: "Resolves overall size only; it cannot see surface shape or an atmosphere.",
  },
  {
    id: "orbitalRangefinder",
    label: "Orbital rangefinder",
    purpose: "Measure how far a world orbits from the Sun.",
    measures: ["orbitalRadius"],
    costTicks: 2,
    limitation: "Requires a stable long baseline; it does not measure the body itself.",
  },
  {
    id: "atmosphereSounder",
    label: "Atmosphere sounder",
    purpose: "Measure how deep a world's atmosphere is compared with the world's size.",
    measures: ["atmosphereDepth"],
    costTicks: 2,
    limitation: "Returns nothing when no authoritative atmosphere depth exists for the world.",
  },
  {
    id: "altimeter",
    label: "Altimeter",
    purpose: "Measure the height range between the lowest and highest surface points.",
    measures: ["surfaceRelief"],
    costTicks: 2,
    limitation: "Measures relief, not absolute altitude, and cannot detect a thin atmosphere.",
  },
  {
    id: "thermalMapper",
    label: "Thermal mapper",
    purpose: "Measure the average surface temperature of a world.",
    measures: ["meanSurfaceTemperature"],
    costTicks: 1,
    limitation: "Reports a mean surface value, not a daily or seasonal range.",
  },
];

export function instrumentDefinition(id: InstrumentId): InstrumentDefinition | undefined {
  return INSTRUMENTS.find((instrument) => instrument.id === id);
}

export interface MeasurementRequest {
  readonly instrumentId: InstrumentId;
  readonly bodyId: BodyId;
  readonly attributeId: AttributeId;
  readonly seed: Seed;
}

export type MeasurementUnavailableReason =
  | "unknown-body"
  | "instrument-cannot-measure"
  | "no-sourced-value";

export type MeasurementOutcome =
  | {
      readonly kind: "unavailable";
      readonly request: MeasurementRequest;
      readonly reason: MeasurementUnavailableReason;
      /** Learner-facing explanation. Never a bare error code. */
      readonly explanation: string;
    }
  | {
      readonly kind: "measured";
      readonly request: MeasurementRequest;
      /** The authoritative value, at the source's precision. */
      readonly reading: Quantity;
      readonly sourceId: string;
      readonly significantDigits: number;
      readonly reviewStatus: "unreviewed" | "reviewed" | "contested";
      /** Stable identity for this observation, derived only from request + seed. */
      readonly observationId: string;
    };

/**
 * Take a measurement. Pure and deterministic.
 *
 * Determinism proof: identical (instrument, body, attribute, seed) plus identical
 * register content yields byte-identical output, independent of renderer backend,
 * quality tier, device, and wall-clock time.
 */
export function measure(
  request: MeasurementRequest,
  bodies: readonly BodyRecord[],
): MeasurementOutcome {
  const body = bodies.find((candidate) => candidate.id === request.bodyId);
  if (!body) {
    return {
      kind: "unavailable",
      request,
      reason: "unknown-body",
      explanation: "That world is not in the survey catalogue, so nothing can be measured.",
    };
  }

  const instrument = instrumentDefinition(request.instrumentId);
  if (!instrument || !instrument.measures.includes(request.attributeId)) {
    return {
      kind: "unavailable",
      request,
      reason: "instrument-cannot-measure",
      explanation: `${instrument?.label ?? "That instrument"} cannot measure ${
        ATTRIBUTES[request.attributeId].label.toLowerCase()
      }. Choose an instrument whose purpose matches the question.`,
    };
  }

  const sourced = sourcedAttribute(body, request.attributeId);
  if (!sourced) {
    return {
      kind: "unavailable",
      request,
      reason: "no-sourced-value",
      explanation: `No authoritative value exists for ${ATTRIBUTES[request.attributeId].label.toLowerCase()} at ${body.displayName}. The survey reports the gap instead of a guess.`,
    };
  }

  const observationId = seedToken(
    deriveSeed(request.seed, request.bodyId, request.attributeId, request.instrumentId),
  );

  return {
    kind: "measured",
    request,
    reading: quantity(sourced.value.value, sourced.value.unit),
    sourceId: sourced.sourceId,
    significantDigits: sourced.significantDigits,
    reviewStatus: sourced.reviewStatus,
    observationId,
  };
}
