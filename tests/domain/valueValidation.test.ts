/**
 * Content validation tests (GAME-366).
 *
 * The requirement is "validation for impossible or contradictory values". A
 * per-field check catches a bad magnitude; the cross-field checks catch the
 * errors authors actually make — swapped semi-axes, a layer deeper than its
 * planet, an orbital radius inside the body it belongs to.
 */

import { describe, expect, it } from "vitest";

import type { BodyRecord, SourcedValue } from "@/domain/bodies";
import {
  blockingIssues,
  formatIssue,
  hasBlockingIssues,
  isBlocking,
  validateBody,
  validateSourcedValue,
  type ValidationIssue,
} from "@/domain/validation";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, FIXTURE_REGISTER_VERSION } from "@/testing/devFixture";

function codes(issues: readonly ValidationIssue[]): readonly string[] {
  return issues.map((issue) => issue.code);
}

function value(
  magnitude: number,
  unit: SourcedValue["value"]["unit"],
  significantDigits = 2,
): SourcedValue {
  return {
    value: { value: magnitude, unit },
    sourceId: "src",
    significantDigits,
    reviewStatus: "unreviewed",
  };
}

function bodyWith(attributes: BodyRecord["attributes"]): BodyRecord {
  return {
    id: FIXTURE_ALPHA,
    displayName: "Test body",
    summary: "Synthetic.",
    attributes,
    provenance: {
      registerVersion: FIXTURE_REGISTER_VERSION,
      scienceReviewed: false,
    },
  };
}

describe("the validator's own contract", () => {
  it("separates blocking errors from advisories", () => {
    const error: ValidationIssue = { severity: "error", code: "value-negative", subject: "s", message: "m" };
    const warning: ValidationIssue = { severity: "warning", code: "value-negative", subject: "s", message: "m" };
    expect(isBlocking(error)).toBe(true);
    expect(isBlocking(warning)).toBe(false);
    expect(blockingIssues([error, warning])).toEqual([error]);
    expect(hasBlockingIssues([warning])).toBe(false);
    expect(hasBlockingIssues([error])).toBe(true);
    expect(formatIssue(error)).toBe("ERROR value-negative s: m");
  });
});

describe("validateSourcedValue", () => {
  it("accepts the reviewed fixture bodies as authored", () => {
    for (const body of DEV_FIXTURE_BODIES) {
      expect(blockingIssues(validateBody(body)), `body ${body.id}`).toEqual([]);
    }
  });

  it("rejects an attribute the science contract does not define", () => {
    expect(codes(validateSourcedValue("b", "diameter", value(1, "km")))).toEqual([
      "source-unknown-attribute",
    ]);
  });

  it("rejects a value that is not a finite number", () => {
    expect(codes(validateSourcedValue("b", "meanRadius", value(Number.NaN, "km")))).toEqual([
      "value-not-a-finite-number",
    ]);
    expect(
      codes(validateSourcedValue("b", "meanRadius", value(Number.POSITIVE_INFINITY, "km"))),
    ).toEqual(["value-not-a-finite-number"]);
  });

  it("rejects a unit of the wrong kind", () => {
    expect(codes(validateSourcedValue("b", "meanRadius", value(300, "K")))).toEqual([
      "value-unit-kind-mismatch",
    ]);
    expect(codes(validateSourcedValue("b", "meanSurfaceTemperature", value(1, "km")))).toEqual([
      "value-unit-kind-mismatch",
    ]);
  });

  it("warns, without blocking, when a value is stored in a non-canonical unit", () => {
    const issues = validateSourcedValue("b", "meanRadius", value(6000, "m"));
    expect(codes(issues)).toEqual(["value-non-canonical-unit"]);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("rejects precision that is not a usable significant-digit count", () => {
    expect(codes(validateSourcedValue("b", "meanRadius", value(1, "km", 0)))).toContain(
      "value-precision-out-of-range",
    );
    expect(codes(validateSourcedValue("b", "meanRadius", value(1, "km", 16)))).toContain(
      "value-precision-out-of-range",
    );
    expect(codes(validateSourcedValue("b", "meanRadius", value(1, "km", 2.5)))).toContain(
      "value-precision-out-of-range",
    );
  });

  it("rejects a negative length", () => {
    expect(codes(validateSourcedValue("b", "meanRadius", value(-1, "km")))).toContain(
      "value-negative",
    );
  });

  it("rejects a temperature below absolute zero, including in Celsius", () => {
    expect(codes(validateSourcedValue("b", "meanSurfaceTemperature", value(-1, "K")))).toContain(
      "value-below-absolute-zero",
    );
    expect(
      codes(validateSourcedValue("b", "meanSurfaceTemperature", value(-300, "degC"))),
    ).toContain("value-below-absolute-zero");
    expect(codes(validateSourcedValue("b", "meanSurfaceTemperature", value(0, "K")))).toEqual([]);
  });
});

describe("cross-field geometry", () => {
  it("catches reversed semi-axes", () => {
    const issues = validateBody(
      bodyWith({ equatorialRadius: value(1000, "km"), polarRadius: value(1200, "km") }),
    );
    expect(codes(issues)).toContain("body-polar-exceeds-equatorial");
  });

  it("catches a mean radius outside the polar..equatorial range", () => {
    const tooBig = validateBody(
      bodyWith({
        meanRadius: value(1500, "km"),
        equatorialRadius: value(1000, "km"),
        polarRadius: value(900, "km"),
      }),
    );
    expect(codes(tooBig)).toContain("body-radius-outside-axis-range");

    const tooSmall = validateBody(
      bodyWith({
        meanRadius: value(800, "km"),
        equatorialRadius: value(1000, "km"),
        polarRadius: value(900, "km"),
      }),
    );
    expect(codes(tooSmall)).toContain("body-radius-outside-axis-range");
  });

  it("accepts an oblate body whose mean sits inside the range", () => {
    const issues = validateBody(
      bodyWith({
        meanRadius: value(950, "km"),
        equatorialRadius: value(1000, "km"),
        polarRadius: value(900, "km"),
      }),
    );
    expect(blockingIssues(issues)).toEqual([]);
  });

  it("catches an atmosphere deeper than the body it surrounds", () => {
    const issues = validateBody(
      bodyWith({ meanRadius: value(1000, "km"), atmosphereDepth: value(1000, "km") }),
    );
    expect(codes(issues)).toContain("body-atmosphere-exceeds-radius");
  });

  it("advises, without blocking, when an atmosphere has no radius to compare with", () => {
    const issues = validateBody(bodyWith({ atmosphereDepth: value(20, "km") }));
    expect(codes(issues)).toEqual(["body-atmosphere-without-radius"]);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("treats a zero radius as an unusable comparison base", () => {
    const issues = validateBody(bodyWith({ meanRadius: value(0, "km"), atmosphereDepth: value(20, "km") }));
    expect(codes(issues)).toContain("body-atmosphere-without-radius");
  });

  it("catches relief larger than the span it is measured across", () => {
    const issues = validateBody(
      bodyWith({ meanRadius: value(1000, "km"), surfaceRelief: value(2000, "km") }),
    );
    expect(codes(issues)).toContain("body-relief-exceeds-diameter");
  });

  it("catches an orbital radius inside the body's own radius", () => {
    const issues = validateBody(
      bodyWith({ meanRadius: value(100000, "km"), orbitalRadius: value(50000, "km") }),
    );
    expect(codes(issues)).toContain("body-orbital-radius-inside-body");
  });

  it("compares values across units, so a mixed-unit body is still checked", () => {
    const issues = validateBody(
      bodyWith({ meanRadius: value(1000, "km"), atmosphereDepth: value(2_000_000, "m") }),
    );
    expect(codes(issues)).toContain("body-atmosphere-exceeds-radius");
  });

  it("skips a cross-field check when a unit is the wrong kind rather than guessing", () => {
    const malformed = bodyWith({
      meanRadius: { ...value(1000, "K"), sourceId: "src" },
      atmosphereDepth: value(20, "km"),
    });
    const issues = validateBody(malformed);
    expect(codes(issues)).toContain("value-unit-kind-mismatch");
    expect(codes(issues)).not.toContain("body-atmosphere-exceeds-radius");
  });
});
