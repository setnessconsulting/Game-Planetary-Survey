/**
 * Normalization: derived values that name their formula and carry their unit.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * MS-ESS1-3 asks the learner to interpret a *proportion* — how deep an atmosphere
 * is compared with its planet, how large a world is compared with another. Those
 * numbers are derived, not measured, and PS-03's acceptance criteria say so
 * precisely:
 *
 *  - "derived values identify formulas and units";
 *  - "renderer-friendly normalized values are derived from, never substituted for,
 *    authoritative values".
 *
 * So every derived value carries the `formulaId` that produced it, the unit of its
 * result, and its inputs *with the source ids they came from*. The result is
 * unit-typed (`ratio`), never a bare number. A derived value cannot be constructed
 * by hand either: the only constructors take authoritative inputs.
 *
 * A derived value never replaces the value it was derived from. Both travel, and
 * the measurement remains the evidence.
 */

import { ATTRIBUTES, type AttributeId } from "./attributes";
import { sourcedAttribute, type BodyRecord } from "./bodies";
import { digestOf } from "./canonical";
import {
  convertTo,
  decimalPlacesFor,
  formatNumber,
  roundSignificant,
  unitKind,
  type Quantity,
} from "./quantities";

export type DerivedFormulaId = "proportion" | "relativeScale" | "relativeVolume";

/** The units a derived value may carry. Both are dimensionless by construction. */
export type DerivedOutputUnit = "ratio" | "percent";

/** What a formula produces, and what it means. */
export interface DerivedFormulaDefinition {
  readonly id: DerivedFormulaId;
  /** Unit of the result, stated once here rather than inferred by a consumer. */
  readonly outputUnit: DerivedOutputUnit;
  /** How the result was computed, in plain language. */
  readonly definition: string;
  /** How the result reads when narrated to a learner. */
  readonly phrasing: string;
}

export const DERIVED_FORMULAS: Readonly<Record<DerivedFormulaId, DerivedFormulaDefinition>> = {
  proportion: {
    id: "proportion",
    outputUnit: "ratio",
    definition: "the first magnitude divided by the second magnitude, of the same kind",
    phrasing: "of the comparison value",
  },
  relativeScale: {
    id: "relativeScale",
    outputUnit: "ratio",
    definition: "one world's magnitude divided by another world's magnitude of the same kind",
    phrasing: "of the comparison world",
  },
  relativeVolume: {
    id: "relativeVolume",
    outputUnit: "ratio",
    definition:
      "the cube of one world's mean radius divided by another's, which is the ratio of " +
      "their volumes only while both are treated as spheres",
    phrasing: "of the comparison world's volume",
  },
};

/** One authoritative input to a derived value, with the source it came from. */
export interface DerivedInput {
  readonly label: string;
  readonly sourceId: string;
  readonly value: Quantity;
}

/**
 * A derived value.
 *
 * `id` derives from the formula and its inputs, so the same comparison always
 * produces the same identity. That is what lets a test pin a golden value and a
 * debrief cite the exact derivation the learner was shown.
 */
export interface DerivedValue {
  readonly id: string;
  readonly formulaId: DerivedFormulaId;
  readonly value: Quantity;
  readonly unit: DerivedOutputUnit;
  readonly definition: string;
  readonly phrasing: string;
  readonly inputs: readonly DerivedInput[];
}

/** Two inputs may form a ratio only if both are usable numbers of the same kind. */
function areComparable(left: DerivedInput, right: DerivedInput): boolean {
  return (
    Number.isFinite(left.value.value) &&
    Number.isFinite(right.value.value) &&
    unitKind(left.value.unit) === unitKind(right.value.unit)
  );
}

function build(
  formulaId: DerivedFormulaId,
  name: string,
  magnitude: number,
  inputs: readonly DerivedInput[],
  phrasing?: string,
): DerivedValue {
  const formula = DERIVED_FORMULAS[formulaId];
  return {
    id: digestOf({
      formulaId,
      inputs: inputs.map((input) => ({
        label: input.label,
        sourceId: input.sourceId,
        value: input.value,
      })),
    }),
    formulaId,
    value: { value: magnitude, unit: formula.outputUnit },
    unit: formula.outputUnit,
    definition: formula.definition,
    phrasing: `${name} ${phrasing ?? formula.phrasing}`.trim(),
    inputs,
  };
}

/**
 * `numerator / denominator` as a unit-typed ratio.
 *
 * Returns `null` when an input is unavailable, the two are of different kinds, or
 * the denominator is zero. That is the domain's way of reporting a gap instead of
 * a guess (docs/SCIENCE_MODEL.md §8); it never substitutes a default.
 */
export function ratioOf(
  numerator: DerivedInput,
  denominator: DerivedInput,
  phrasing?: string,
): DerivedValue | null {
  if (!areComparable(numerator, denominator) || denominator.value.value === 0) return null;
  return build(
    "proportion",
    numerator.label,
    numerator.value.value / denominator.value.value,
    [numerator, denominator],
    phrasing,
  );
}

/** Relative size between two worlds by the same attribute (LO-2). */
export function relativeScale(first: DerivedInput, second: DerivedInput): DerivedValue | null {
  if (!areComparable(first, second) || second.value.value === 0) return null;
  return build("relativeScale", first.label, first.value.value / second.value.value, [first, second]);
}

function inputFromSource(
  body: BodyRecord,
  attributeId: AttributeId,
  label?: string,
): DerivedInput | null {
  const sourced = sourcedAttribute(body, attributeId);
  if (!sourced) return null;
  const definition = ATTRIBUTES[attributeId];
  // Convert into the attribute's canonical unit so a ratio comes out dimensionless
  // for the right reason, rather than depending on the units an author happened to
  // type. An unavailable conversion means the value is mis-united, so return null
  // rather than a number that looks fine.
  const canonical = convertToSafely(sourced.value, definition.canonicalUnit);
  if (!canonical) return null;
  return {
    label: label ?? `${body.displayName} ${definition.label.toLowerCase()}`,
    sourceId: sourced.sourceId,
    value: canonical,
  };
}

function convertToSafely(value: Quantity, unit: Quantity["unit"]): Quantity | null {
  if (unitKind(value.unit) !== unitKind(unit)) return null;
  return convertTo(value, unit);
}

/**
 * The authoritative proportion of a body's mean radius that one attribute occupies.
 *
 * This is the LO-3 relationship: a learner should end up able to say "the
 * atmosphere reaches about 8% of the way out", not just read a raw number.
 */
export function proportionOfBodyRadius(
  body: BodyRecord,
  attributeId: AttributeId,
): DerivedValue | null {
  const numerator = inputFromSource(body, attributeId);
  const radius = inputFromSource(body, "meanRadius");
  if (!numerator || !radius) return null;
  return ratioOf(numerator, radius, "of the body's mean radius");
}

/** Relative size between two worlds by one attribute (LO-2). */
export function relativeBodyScale(
  first: BodyRecord,
  second: BodyRecord,
  attributeId: AttributeId,
): DerivedValue | null {
  const left = inputFromSource(first, attributeId);
  const right = inputFromSource(second, attributeId);
  if (!left || !right) return null;
  return relativeScale(left, right);
}

/**
 * Relative volume between two worlds, treating both as spheres of their mean radius.
 *
 * Added for PS-04 content, which needed it: a mission tells a learner that one
 * world holds 0.13 of another "by volume", and before this formula existed no
 * registered derivation could produce that number. PS-03 recorded exactly that
 * hazard (D-26: a derived proportion that is possible but unlabelled is where a
 * fabricated number enters unnoticed), so the claim is either derived here or not
 * made at all.
 *
 * The sphere assumption is in the definition, not in a footnote. Flattening and
 * real shape are ignored, so this is a model, and a learner who reads "by volume"
 * is reading a model result rather than a measurement. It never replaces the radii
 * it came from.
 */
export function relativeBodyVolume(
  first: BodyRecord,
  second: BodyRecord,
): DerivedValue | null {
  const scale = relativeBodyScale(first, second, "meanRadius");
  if (!scale) return null;

  const inputs = scale.inputs;
  return build(
    "relativeVolume",
    `${first.displayName} volume`,
    scale.value.value ** 3,
    inputs,
  );
}

/**
 * Learner-facing text for a derived value.
 *
 * A dimensionless result is narrated as a percentage, because a percentage is what
 * a middle-school learner reads as "how much of". Precision is supplied by the
 * caller — the value's own source — and never invented here: a derived value may
 * not display more precision than the measurement behind it
 * (docs/SCIENCE_MODEL.md §6).
 */
export function describeDerivedValue(derived: DerivedValue, significantDigits: number): string {
  const asPercent = convertTo(derived.value, "percent");
  const rounded = roundSignificant(asPercent.value, significantDigits);
  return `about ${formatNumber(rounded, decimalPlacesFor(rounded, significantDigits))}% ${derived.phrasing}`;
}
