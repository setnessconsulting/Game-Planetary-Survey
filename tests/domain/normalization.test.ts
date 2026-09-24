/**
 * Derived-value tests (GAME-366).
 *
 * The acceptance criteria here are "derived values identify formulas and units"
 * and "renderer-friendly normalized values are derived from, never substituted
 * for, authoritative values".
 */

import { describe, expect, it } from "vitest";

import { kilometres, metres, quantity, ratio as ratioUnit } from "@/domain/quantities";
import {
  DERIVED_FORMULAS,
  describeDerivedValue,
  proportionOfBodyRadius,
  ratioOf,
  relativeBodyScale,
  relativeScale,
  type DerivedInput,
} from "@/domain/normalization";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, FIXTURE_BETA, FIXTURE_GAMMA } from "@/testing/devFixture";

const alpha = DEV_FIXTURE_BODIES.find((body) => body.id === FIXTURE_ALPHA)!;
const beta = DEV_FIXTURE_BODIES.find((body) => body.id === FIXTURE_BETA)!;
const gamma = DEV_FIXTURE_BODIES.find((body) => body.id === FIXTURE_GAMMA)!;

function input(label: string, value: number, unit: DerivedInput["value"]["unit"], sourceId = "s"): DerivedInput {
  return { label, sourceId, value: quantity(value, unit) };
}

describe("the formula register", () => {
  it("names a formula and a unit for every derivation it permits", () => {
    expect(Object.keys(DERIVED_FORMULAS).sort()).toEqual([
      "proportion",
      "relativeScale",
      "relativeVolume",
    ]);
    for (const formula of Object.values(DERIVED_FORMULAS)) {
      expect(formula.outputUnit, formula.id).toBe("ratio");
      expect(formula.definition.length).toBeGreaterThan(0);
      expect(formula.phrasing.length).toBeGreaterThan(0);
    }
  });
});

describe("ratioOf", () => {
  it("produces a unit-typed ratio that identifies its formula and inputs", () => {
    const derived = ratioOf(input("Atmosphere", 20, "km", "atm"), input("Radius", 1000, "km", "rad"));
    expect(derived).not.toBeNull();
    expect(derived?.formulaId).toBe("proportion");
    expect(derived?.unit).toBe("ratio");
    expect(derived?.value).toEqual(ratioUnit(0.02));
    expect(derived?.inputs.map((entry) => entry.sourceId)).toEqual(["atm", "rad"]);
    expect(derived?.inputs.map((entry) => entry.label)).toEqual(["Atmosphere", "Radius"]);
    expect(derived?.definition).toBe(DERIVED_FORMULAS.proportion.definition);
  });

  it("is dimensionless for the right reason: kilometres cancel", () => {
    const inKilometres = ratioOf(input("a", 20, "km"), input("b", 1000, "km"));
    const inMetres = ratioOf(input("a", 20_000, "m"), input("b", 1_000_000, "m"));
    expect(inKilometres?.value.value).toBeCloseTo(inMetres?.value.value ?? Number.NaN, 12);
  });

  it("returns null rather than a guess when an input is unusable", () => {
    expect(ratioOf(input("a", 1, "km"), input("b", 0, "km"))).toBeNull();
    expect(ratioOf(input("a", Number.NaN, "km"), input("b", 1, "km"))).toBeNull();
    expect(ratioOf(input("a", 1, "km"), input("b", Number.POSITIVE_INFINITY, "km"))).toBeNull();
    expect(ratioOf(input("a", 1, "km"), input("b", 1, "K"))).toBeNull();
    expect(ratioOf(input("a", 1, "km"), input("b", 1, "ratio"))).toBeNull();
  });

  it("gives the same identity to the same comparison", () => {
    const first = ratioOf(input("a", 20, "km", "x"), input("b", 1000, "km", "y"));
    const second = ratioOf(input("a", 20, "km", "x"), input("b", 1000, "km", "y"));
    expect(first?.id).toBe(second?.id);
    expect(first?.id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("gives a different identity when the inputs differ", () => {
    const first = ratioOf(input("a", 20, "km", "x"), input("b", 1000, "km", "y"));
    const second = ratioOf(input("a", 21, "km", "x"), input("b", 1000, "km", "y"));
    expect(first?.id).not.toBe(second?.id);
  });
});

describe("relativeScale", () => {
  it("compares two worlds by the same attribute", () => {
    const derived = relativeScale(input("Alpha", 1000, "km", "a"), input("Beta", 4000, "km", "b"));
    expect(derived?.formulaId).toBe("relativeScale");
    expect(derived?.value.value).toBeCloseTo(0.25, 12);
    expect(derived?.phrasing).toContain("comparison world");
  });

  it("returns null for an unusable or zero divisor", () => {
    expect(relativeScale(input("a", 1, "km"), input("b", 0, "km"))).toBeNull();
    expect(relativeScale(input("a", 1, "km"), input("b", 1, "K"))).toBeNull();
  });
});

describe("body-level derivations", () => {
  it("computes an atmosphere's proportion of its body's radius", () => {
    const derived = proportionOfBodyRadius(alpha, "atmosphereDepth");
    expect(derived?.value.value).toBeCloseTo(0.02, 12);
    expect(derived?.inputs.map((entry) => entry.sourceId)).toEqual([
      "fixture.alpha.atmosphere",
      "fixture.alpha.radius",
    ]);
  });

  it("labels the derivation with the body it belongs to", () => {
    const derived = proportionOfBodyRadius(alpha, "atmosphereDepth");
    expect(derived?.phrasing).toContain("Fixture Alpha");
  });

  it("reports the gap instead of a number when part of the comparison is missing", () => {
    expect(proportionOfBodyRadius(gamma, "atmosphereDepth")).toBeNull();
    expect(relativeBodyScale(gamma, gamma, "surfaceRelief")).toBeNull();
  });

  it("compares two bodies' radii and reverses cleanly", () => {
    const forward = relativeBodyScale(alpha, beta, "meanRadius");
    const reverse = relativeBodyScale(beta, alpha, "meanRadius");
    expect(forward?.value.value).toBeCloseTo(0.25, 12);
    expect(reverse?.value.value).toBeCloseTo(4, 12);
    expect(forward?.id).not.toBe(reverse?.id);
  });

  it("converts mixed units before comparing, so the ratio is still dimensionless", () => {
    const body = {
      ...alpha,
      attributes: {
        ...alpha.attributes,
        meanRadius: { value: metres(500_000), sourceId: "m", significantDigits: 3, reviewStatus: "unreviewed" as const },
      },
    };
    const derived = relativeBodyScale(alpha, body, "meanRadius");
    // 1000 km vs 500 km.
    expect(derived?.value.value).toBeCloseTo(2, 12);
  });

  it("returns null when a stored value is not comparable to its attribute kind", () => {
    const mismatched = {
      ...alpha,
      attributes: {
        ...alpha.attributes,
        meanRadius: { value: quantity(1, "K"), sourceId: "k", significantDigits: 2, reviewStatus: "unreviewed" as const },
      },
    };
    expect(proportionOfBodyRadius(mismatched, "atmosphereDepth")).toBeNull();
  });

  it("keeps the authoritative value alongside the derived one", () => {
    const derived = proportionOfBodyRadius(alpha, "atmosphereDepth");
    // The measurement is untouched: the derivation adds a value, it does not
    // replace the one that came from the source.
    expect(alpha.attributes.atmosphereDepth?.value).toEqual(kilometres(20));
    expect(derived?.value.unit).toBe("ratio");
  });
});

describe("describeDerivedValue", () => {
  it("narrates a proportion as a percentage, at the caller's precision", () => {
    const derived = proportionOfBodyRadius(alpha, "atmosphereDepth");
    expect(describeDerivedValue(derived!, 2)).toBe("about 2.0% Fixture Alpha atmosphere depth of the body's mean radius");
  });

  it("does not display more precision than it was given", () => {
    const derived = proportionOfBodyRadius(alpha, "atmosphereDepth");
    expect(describeDerivedValue(derived!, 1)).toBe("about 2% Fixture Alpha atmosphere depth of the body's mean radius");
  });

  it("keeps a small proportion readable instead of rounding it away", () => {
    const derived = relativeScale(input("Tiny", 1, "km"), input("Huge", 4000, "km"));
    expect(describeDerivedValue(derived!, 2)).toBe("about 0.025% Tiny of the comparison world");
  });
});
