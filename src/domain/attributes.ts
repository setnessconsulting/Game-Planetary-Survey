/**
 * Typed attribute registry.
 *
 * This module defines *which* properties exist and what they mean. It contains
 * NO scientific values: every displayed value comes from a sourced register
 * entry resolved through `content/` (docs/SCIENCE_MODEL.md §5.2).
 *
 * Kept in the pure domain layer so that mission state, comparison, and claim
 * evaluation can reason about attributes without touching content or rendering.
 */

import type { Unit } from "./quantities";

export type AttributeId =
  | "meanRadius"
  | "equatorialRadius"
  | "polarRadius"
  | "orbitalRadius"
  | "atmosphereDepth"
  | "surfaceRelief"
  | "meanSurfaceTemperature";

/** Which dimension of measurement an attribute belongs to. */
export type AttributeKind = "length" | "temperature";

export interface AttributeDefinition {
  readonly id: AttributeId;
  readonly label: string;
  readonly kind: AttributeKind;
  readonly canonicalUnit: Unit;
  /**
   * True when the attribute is a *scale property* under NGSS MS-ESS1-3.
   * Only scale properties may carry a v1 mission's primary learning objective
   * (docs/SCIENCE_MODEL.md §1.2).
   */
  readonly scaleProperty: boolean;
  /** Plain-language definition shown to the learner. */
  readonly learnerDefinition: string;
  /**
   * True when the value is a proportion of body radius rather than an absolute
   * measurement. Proportion attributes are what make MS-ESS1-3 layering
   * comparisons possible (LO-3).
   */
  readonly relativeToBodyRadius: boolean;
}

export const ATTRIBUTES: Readonly<Record<AttributeId, AttributeDefinition>> = {
  meanRadius: {
    id: "meanRadius",
    label: "Mean radius",
    kind: "length",
    canonicalUnit: "km",
    scaleProperty: true,
    learnerDefinition: "The average distance from the centre of the body to its surface.",
    relativeToBodyRadius: false,
  },
  equatorialRadius: {
    id: "equatorialRadius",
    label: "Equatorial radius",
    kind: "length",
    canonicalUnit: "km",
    scaleProperty: true,
    learnerDefinition: "The distance from the centre to the surface at the body's widest point.",
    relativeToBodyRadius: false,
  },
  polarRadius: {
    id: "polarRadius",
    label: "Polar radius",
    kind: "length",
    canonicalUnit: "km",
    scaleProperty: true,
    learnerDefinition: "The distance from the centre to the surface at the body's poles.",
    relativeToBodyRadius: false,
  },
  orbitalRadius: {
    id: "orbitalRadius",
    label: "Orbital radius",
    kind: "length",
    canonicalUnit: "km",
    scaleProperty: true,
    learnerDefinition: "The average distance from the Sun to the body.",
    relativeToBodyRadius: false,
  },
  atmosphereDepth: {
    id: "atmosphereDepth",
    label: "Atmosphere depth",
    kind: "length",
    canonicalUnit: "km",
    scaleProperty: true,
    learnerDefinition:
      "How far the atmosphere extends above the surface, compared with the size of the body.",
    relativeToBodyRadius: true,
  },
  surfaceRelief: {
    id: "surfaceRelief",
    label: "Surface relief",
    kind: "length",
    canonicalUnit: "km",
    scaleProperty: true,
    learnerDefinition:
      "The height range from the lowest to the highest point on the surface, compared with the size of the body.",
    relativeToBodyRadius: true,
  },
  meanSurfaceTemperature: {
    id: "meanSurfaceTemperature",
    label: "Mean surface temperature",
    kind: "temperature",
    canonicalUnit: "K",
    scaleProperty: false,
    learnerDefinition: "The average temperature at the surface of the body.",
    relativeToBodyRadius: false,
  },
};

export const ATTRIBUTE_IDS = Object.keys(ATTRIBUTES) as readonly AttributeId[];

export function attributeDefinition(id: AttributeId): AttributeDefinition {
  return ATTRIBUTES[id];
}

/** Only these attributes may carry the primary MS-ESS1-3 objective. */
export const SCALE_PROPERTY_IDS: readonly AttributeId[] = ATTRIBUTE_IDS.filter(
  (id) => ATTRIBUTES[id].scaleProperty,
);

export function isScaleProperty(id: AttributeId): boolean {
  return ATTRIBUTES[id].scaleProperty;
}
