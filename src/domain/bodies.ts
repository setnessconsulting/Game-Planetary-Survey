/**
 * Body records and the sourced-value contract.
 *
 * A `SourcedValue` cannot exist without a source id, so the type system makes an
 * unsourced displayed value unattractive to write (docs/SCIENCE_MODEL.md §5.2).
 * The authoritative *values* arrive from `content/`; this module defines only the
 * shape and the pure helpers.
 */

import type { AttributeId } from "./attributes";
import type { Quantity, Unit } from "./quantities";

export type BodyId = string;

/**
 * How far a value has been through independent science review.
 *
 * `contested` is a first-class state: a disputed value is shown as disputed or
 * withheld, never quietly promoted to `reviewed` (docs/SCIENCE_MODEL.md §5.2).
 */
export type ReviewStatus = "unreviewed" | "reviewed" | "contested";

/**
 * A scientific value that is traceable to an authority.
 *
 * `sourceId` points at a per-field source-register entry. `significantDigits` is
 * the precision the source actually supports, which bounds what the game may
 * display.
 */
export interface SourcedValue {
  readonly value: Quantity;
  readonly sourceId: string;
  readonly significantDigits: number;
  /** Reference epoch/orbit when the value is time-dependent. */
  readonly appliesToEpoch?: string;
  readonly reviewStatus: ReviewStatus;
}

export interface BodyRecord {
  readonly id: BodyId;
  readonly displayName: string;
  /** One line the learner can read without prior knowledge. */
  readonly summary: string;
  /**
   * Only attributes with an authoritative value appear here. An absent key means
   * "no authoritative value", and the game must say so rather than invent one
   * (docs/SCIENCE_MODEL.md §8).
   */
  readonly attributes: Partial<Record<AttributeId, SourcedValue>>;
  readonly provenance: BodyProvenance;
}

export interface BodyProvenance {
  /** Version of the source register these values were read from. */
  readonly registerVersion: string;
  /** True once PS-04's independent science review has passed. */
  readonly scienceReviewed: boolean;
}

export function findBody(
  bodies: readonly BodyRecord[],
  bodyId: BodyId,
): BodyRecord | undefined {
  return bodies.find((body) => body.id === bodyId);
}

export function sourcedAttribute(
  body: BodyRecord,
  attributeId: AttributeId,
): SourcedValue | undefined {
  return body.attributes[attributeId];
}

/**
 * The proportion of a body's radius that an attribute represents.
 *
 * Returns null when either the attribute value or the radius is unavailable, or
 * when the units are not comparable. Returning null is deliberate: the game
 * states "not available" rather than guessing (docs/SCIENCE_MODEL.md §8).
 */
export function proportionOfRadius(
  body: BodyRecord,
  attributeId: AttributeId,
): number | null {
  const attribute = sourcedAttribute(body, attributeId);
  const radius = sourcedAttribute(body, "meanRadius");
  if (!attribute || !radius) return null;
  if (!isLengthUnit(attribute.value.unit) || !isLengthUnit(radius.value.unit)) return null;
  const attributeMetres = toMetresMagnitude(attribute.value);
  const radiusMetres = toMetresMagnitude(radius.value);
  if (radiusMetres === 0) return null;
  return attributeMetres / radiusMetres;
}

function isLengthUnit(unit: Unit): unit is "m" | "km" {
  return unit === "m" || unit === "km";
}

function toMetresMagnitude(value: Quantity): number {
  return value.unit === "m" ? value.value : value.value * 1000;
}
