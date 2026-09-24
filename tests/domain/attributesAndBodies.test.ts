import { describe, expect, it } from "vitest";

import {
  ATTRIBUTES,
  ATTRIBUTE_IDS,
  attributeDefinition,
  isScaleProperty,
  SCALE_PROPERTY_IDS,
} from "@/domain/attributes";
import { findBody, proportionOfRadius, sourcedAttribute } from "@/domain/bodies";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, FIXTURE_GAMMA } from "@/testing/devFixture";

describe("attribute registry", () => {
  it("defines every attribute with a learner-facing explanation", () => {
    expect(ATTRIBUTE_IDS).toHaveLength(7);
    for (const id of ATTRIBUTE_IDS) {
      const definition = attributeDefinition(id);
      expect(definition.id).toBe(id);
      expect(definition.learnerDefinition.length).toBeGreaterThan(20);
      expect(definition.label.length).toBeGreaterThan(2);
      expect(["length", "temperature"]).toContain(definition.kind);
    }
  });

  it("marks the MS-ESS1-3 scale properties and leaves temperature out", () => {
    const scaleProperties = [...SCALE_PROPERTY_IDS].sort();
    expect(scaleProperties).toEqual([
      "atmosphereDepth",
      "equatorialRadius",
      "meanRadius",
      "orbitalRadius",
      "polarRadius",
      "surfaceRelief",
    ]);
    expect(isScaleProperty("meanSurfaceTemperature")).toBe(false);
    expect(isScaleProperty("meanRadius")).toBe(true);
  });

  it("marks the layer/relief attributes as proportional to body radius", () => {
    expect(ATTRIBUTES.atmosphereDepth.relativeToBodyRadius).toBe(true);
    expect(ATTRIBUTES.surfaceRelief.relativeToBodyRadius).toBe(true);
    expect(ATTRIBUTES.meanRadius.relativeToBodyRadius).toBe(false);
  });

  it("uses a coherent canonical unit per kind", () => {
    expect(ATTRIBUTES.meanRadius.canonicalUnit).toBe("km");
    expect(ATTRIBUTES.meanSurfaceTemperature.canonicalUnit).toBe("K");
  });
});

describe("body lookup", () => {
  it("finds a body by id and returns undefined for an unknown id", () => {
    expect(findBody(DEV_FIXTURE_BODIES, FIXTURE_ALPHA)?.displayName).toBe("Fixture Alpha");
    expect(findBody(DEV_FIXTURE_BODIES, "nope")).toBeUndefined();
  });

  it("resolves a sourced attribute, and reports a genuine gap as undefined", () => {
    const alpha = findBody(DEV_FIXTURE_BODIES, FIXTURE_ALPHA);
    if (!alpha) throw new Error("fixture missing");
    expect(sourcedAttribute(alpha, "meanRadius")?.sourceId).toBe("fixture.alpha.radius");
    // Fixture Gamma deliberately has no atmosphere value.
    const gamma = findBody(DEV_FIXTURE_BODIES, FIXTURE_GAMMA);
    if (!gamma) throw new Error("fixture missing");
    expect(sourcedAttribute(gamma, "atmosphereDepth")).toBeUndefined();
  });
});

describe("proportionOfRadius", () => {
  it("computes a proportion of body radius", () => {
    const alpha = findBody(DEV_FIXTURE_BODIES, FIXTURE_ALPHA);
    if (!alpha) throw new Error("fixture missing");
    // 20 km of atmosphere on a 1,000 km radius body.
    expect(proportionOfRadius(alpha, "atmosphereDepth")).toBeCloseTo(0.02, 10);
  });

  it("returns null rather than guessing when a value is missing", () => {
    const gamma = findBody(DEV_FIXTURE_BODIES, FIXTURE_GAMMA);
    if (!gamma) throw new Error("fixture missing");
    expect(proportionOfRadius(gamma, "atmosphereDepth")).toBeNull();
  });

  it("returns null when the body has no radius to divide by", () => {
    expect(
      proportionOfRadius(
        {
          id: "no-radius",
          displayName: "No Radius",
          summary: "synthetic",
          attributes: {
            atmosphereDepth: {
              value: { value: 5, unit: "km" },
              sourceId: "x",
              significantDigits: 1,
              reviewStatus: "unreviewed",
            },
          },
          provenance: { registerVersion: "dev", scienceReviewed: false },
        },
        "atmosphereDepth",
      ),
    ).toBeNull();
  });

  it("returns null for a non-length attribute instead of a nonsense ratio", () => {
    const alpha = findBody(DEV_FIXTURE_BODIES, FIXTURE_ALPHA);
    if (!alpha) throw new Error("fixture missing");
    expect(proportionOfRadius(alpha, "meanSurfaceTemperature")).toBeNull();
  });

  it("returns null when the radius is zero", () => {
    expect(
      proportionOfRadius(
        {
          id: "zero-radius",
          displayName: "Zero Radius",
          summary: "synthetic",
          attributes: {
            meanRadius: {
              value: { value: 0, unit: "km" },
              sourceId: "x",
              significantDigits: 1,
              reviewStatus: "unreviewed",
            },
            atmosphereDepth: {
              value: { value: 5, unit: "km" },
              sourceId: "y",
              significantDigits: 1,
              reviewStatus: "unreviewed",
            },
          },
          provenance: { registerVersion: "dev", scienceReviewed: false },
        },
        "atmosphereDepth",
      ),
    ).toBeNull();
  });
});
