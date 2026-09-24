import { describe, expect, it } from "vitest";

import { compareByAttribute, proportionalReading } from "@/domain/comparison";
import { createClaim, evaluateClaim } from "@/domain/claims";
import type { EvidenceRecord } from "@/domain/evidence";
import { canonicalMagnitude, celsius, formatQuantity, kelvin, kilometres, toCelsius } from "@/domain/quantities";
import { FIXTURE_ALPHA, FIXTURE_BETA } from "@/testing/devFixture";

function record(
  id: string,
  bodyId: string,
  value: number,
  unit: "km" | "K",
  order: number,
): EvidenceRecord {
  return {
    id,
    bodyId,
    attributeId: unit === "K" ? "meanSurfaceTemperature" : "meanRadius",
    instrumentId: unit === "K" ? "thermalMapper" : "radiusSounder",
    reading: { value, unit },
    sourceId: `synthetic.${id}`,
    significantDigits: 3,
    order,
  };
}

describe("proportionalReading", () => {
  const records = [
    record("a", FIXTURE_ALPHA, 1000, "km", 0),
    record("b", FIXTURE_BETA, 4000, "km", 1),
  ];

  it("reports a body's size relative to the largest in the comparison", () => {
    const result = compareByAttribute(records, "meanRadius");
    if (result.kind !== "finding") throw new Error("expected a finding");
    expect(proportionalReading(result.finding, FIXTURE_BETA)).toBe(1);
    expect(proportionalReading(result.finding, FIXTURE_ALPHA)).toBeCloseTo(0.25, 10);
  });

  it("returns null for a body that is not in the comparison", () => {
    const result = compareByAttribute(records, "meanRadius");
    if (result.kind !== "finding") throw new Error("expected a finding");
    expect(proportionalReading(result.finding, "not-compared")).toBeNull();
  });
});

describe("sameAs claims", () => {
  it("supports 'about the same' only when the difference is inside tolerance", () => {
    const nearEqual = [record("a", FIXTURE_ALPHA, 1000, "km", 0), record("b", FIXTURE_BETA, 1005, "km", 1)];
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_ALPHA,
      relation: "sameAs",
      object: FIXTURE_BETA,
      citedEvidenceIds: ["a", "b"],
    });
    const evaluation = evaluateClaim(claim, nearEqual);
    expect(evaluation.verdict).toBe("supported");
    expect(evaluation.dimensions.reasoningConsistency).toBe(true);
  });

  it("contradicts 'about the same' when the values clearly differ", () => {
    const farApart = [record("a", FIXTURE_ALPHA, 1000, "km", 0), record("b", FIXTURE_BETA, 4000, "km", 1)];
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_ALPHA,
      relation: "sameAs",
      object: FIXTURE_BETA,
      citedEvidenceIds: ["a", "b"],
    });
    expect(evaluateClaim(claim, farApart).verdict).toBe("contradicted");
  });

  it("treats two zero values as equal rather than dividing by zero", () => {
    const zeros = [record("a", FIXTURE_ALPHA, 0, "km", 0), record("b", FIXTURE_BETA, 0, "km", 1)];
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_ALPHA,
      relation: "sameAs",
      object: FIXTURE_BETA,
      citedEvidenceIds: ["a", "b"],
    });
    expect(evaluateClaim(claim, zeros).verdict).toBe("supported");
  });
});

describe("temperature quantities", () => {
  it("normalizes temperature to kelvin for comparison", () => {
    expect(canonicalMagnitude(celsius(0))).toBeCloseTo(273.15, 10);
    expect(toCelsius(kelvin(300)).value).toBeCloseTo(26.85, 10);
  });

  it("formats a temperature with its unit", () => {
    expect(formatQuantity(kelvin(288.15), 5)).toBe("288.15 K");
  });

  it("compares temperatures across units", () => {
    const records = [
      {
        ...record("a", FIXTURE_ALPHA, 0, "K", 0),
        attributeId: "meanSurfaceTemperature" as const,
        reading: celsius(0),
      },
      {
        ...record("b", FIXTURE_BETA, 0, "K", 1),
        attributeId: "meanSurfaceTemperature" as const,
        reading: kelvin(100),
      },
    ];
    const result = compareByAttribute(records, "meanSurfaceTemperature");
    if (result.kind !== "finding") throw new Error("expected a finding");
    expect(result.finding.unit).toBe("K");
    // 0 degC is 273.15 K, which is hotter than 100 K, so Fixture Alpha is first
    // even though its raw unit-relative magnitude is smaller.
    expect(result.finding.ordering).toEqual([FIXTURE_ALPHA, FIXTURE_BETA]);
  });
});

describe("kilometre-scale quantities", () => {
  it("formats a large length with grouping and the requested precision", () => {
    expect(formatQuantity(kilometres(149598023.0), 6)).toBe("149,598,000 km");
  });
});
