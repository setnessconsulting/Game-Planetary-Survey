/**
 * Presentation scale/distortion contract tests (GAME-366).
 *
 * The requirement is "explicit scale/distortion metadata for rendered
 * representations", and docs/SCIENCE_MODEL.md §7-§8 is the reason: a distorted
 * drawing is permitted, an undisclosed one is not, and no presentation choice may
 * change an authoritative value.
 */

import { describe, expect, it } from "vitest";

import {
  DISTORTION_KIND_LABELS,
  applyPresentationDeclaration,
  findDeclaration,
  validatePresentationDeclaration,
  validatePresentationDeclarations,
  type PresentationScaleDeclaration,
} from "@/domain/presentation";
import { projectRenderSnapshot } from "@/domain/renderSnapshot";
import { initialMissionSnapshot } from "@/domain/mission";
import { FIXTURE_PRESENTATION_DECLARATIONS } from "@/testing/sourcedFixture";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA } from "@/testing/devFixture";
import type { ValidationIssue } from "@/domain/validation";

function codes(issues: readonly ValidationIssue[]): readonly string[] {
  return issues.map((issue) => issue.code);
}

function declaration(
  overrides: Partial<PresentationScaleDeclaration> = {},
): PresentationScaleDeclaration {
  return {
    id: "SIM-1",
    representationId: "system-comparison",
    kind: "uniformScale",
    ratio: 0.5,
    sourceBasisIds: ["source.one"],
    rationale: "Worlds differ by more than an order of magnitude.",
    modelBoundary: "Relative separation is not to scale.",
    learnerText: "This view is compressed. The notebook holds the measurements.",
    reviewStatus: "unreviewed",
    ...overrides,
  };
}

describe("distortion kinds", () => {
  it("names every kind for accessible description", () => {
    const kinds = Object.keys(DISTORTION_KIND_LABELS).sort();
    expect(kinds).toEqual([
      "layerThicknessExaggeration",
      "literal",
      "nonLinearCompression",
      "representativeSurface",
      "uniformScale",
    ]);
    expect(DISTORTION_KIND_LABELS.literal).toBe("drawn to literal scale");
  });
});

describe("validatePresentationDeclaration", () => {
  it("accepts a fully declared distortion and the shipped empty set", () => {
    expect(validatePresentationDeclaration(declaration())).toEqual([]);
    expect(validatePresentationDeclarations(FIXTURE_PRESENTATION_DECLARATIONS)).toEqual([]);
    expect(validatePresentationDeclarations([])).toEqual([]);
  });

  it("accepts a literal view, which needs no distortion disclosure", () => {
    const literal = declaration({
      kind: "literal",
      ratio: 1,
      sourceBasisIds: [],
      learnerText: "",
      modelBoundary: "",
    });
    expect(validatePresentationDeclaration(literal)).toEqual([]);
  });

  it("requires identity and rationale", () => {
    expect(codes(validatePresentationDeclaration(declaration({ id: " " })))).toContain(
      "presentation-empty-id",
    );
    expect(codes(validatePresentationDeclaration(declaration({ representationId: "" })))).toContain(
      "presentation-missing-representation",
    );
    expect(codes(validatePresentationDeclaration(declaration({ rationale: "  " })))).toContain(
      "presentation-missing-model-boundary",
    );
  });

  it("requires a usable ratio", () => {
    expect(codes(validatePresentationDeclaration(declaration({ ratio: Number.NaN })))).toContain(
      "presentation-ratio-not-literal",
    );
    expect(codes(validatePresentationDeclaration(declaration({ ratio: 0 })))).toContain(
      "presentation-ratio-not-literal",
    );
    expect(codes(validatePresentationDeclaration(declaration({ ratio: -2 })))).toContain(
      "presentation-ratio-not-literal",
    );
  });

  it("refuses to call a distorted view literal", () => {
    expect(
      codes(validatePresentationDeclaration(declaration({ kind: "literal", ratio: 0.5 }))),
    ).toContain("presentation-ratio-not-literal");
  });

  it("refuses to call a literal view distorted", () => {
    expect(
      codes(validatePresentationDeclaration(declaration({ kind: "uniformScale", ratio: 1 }))),
    ).toContain("presentation-undisclosed-distortion");
  });

  it("requires a model boundary and learner text for a distortion", () => {
    expect(codes(validatePresentationDeclaration(declaration({ modelBoundary: "  " })))).toContain(
      "presentation-missing-model-boundary",
    );
    expect(codes(validatePresentationDeclaration(declaration({ learnerText: "" })))).toContain(
      "presentation-undisclosed-distortion",
    );
  });

  it("requires at least one non-blank source basis for a distortion", () => {
    expect(codes(validatePresentationDeclaration(declaration({ sourceBasisIds: [] })))).toContain(
      "presentation-missing-source-basis",
    );
    expect(
      codes(validatePresentationDeclaration(declaration({ sourceBasisIds: ["", "  "] }))),
    ).toContain("presentation-missing-source-basis");
  });

  it("rejects two declarations sharing a SIM id", () => {
    const issues = validatePresentationDeclarations([declaration(), declaration()]);
    expect(codes(issues)).toContain("presentation-duplicate-id");
  });
});

describe("findDeclaration", () => {
  it("finds the declaration that governs a representation", () => {
    expect(findDeclaration(FIXTURE_PRESENTATION_DECLARATIONS, "fixture-comparison")?.id).toBe(
      "SIM-fixture-1",
    );
    expect(findDeclaration(FIXTURE_PRESENTATION_DECLARATIONS, "no-such-view")).toBeUndefined();
  });
});

describe("applyPresentationDeclaration", () => {
  const fallback = { scaleFactor: 1, scaleNotice: "Not drawn to literal scale." };

  it("preserves the honest fallback when no declaration exists", () => {
    expect(applyPresentationDeclaration(undefined, fallback)).toEqual({
      scaleFactor: 1,
      scaleNotice: fallback.scaleNotice,
      declarationId: null,
    });
  });

  it("keeps literal scale and the fallback notice for a literal declaration", () => {
    expect(applyPresentationDeclaration(declaration({ kind: "literal", ratio: 1 }), fallback)).toEqual({
      scaleFactor: 1,
      scaleNotice: fallback.scaleNotice,
      declarationId: "SIM-1",
    });
  });

  it("carries the declared ratio and the declared learner text for a distortion", () => {
    expect(applyPresentationDeclaration(declaration(), fallback)).toEqual({
      scaleFactor: 0.5,
      scaleNotice: declaration().learnerText,
      declarationId: "SIM-1",
    });
  });

  it("carries no scientific value at all", () => {
    // The strongest form of the integrity rule: whatever the declaration says, the
    // renderer-facing output can only be a scale factor and a sentence.
    const [fixtureDeclaration] = FIXTURE_PRESENTATION_DECLARATIONS;
    const applied = applyPresentationDeclaration(fixtureDeclaration, fallback);
    expect(Object.keys(applied).sort()).toEqual(["declarationId", "scaleFactor", "scaleNotice"]);
    const serialized = JSON.stringify(applied);
    // The magnitudes the representation illustrates must not appear. The scale
    // factor itself is a presentation fact, not a scientific one, so it is allowed
    // to be there — that is the whole point of declaring it.
    for (const leaked of ["1000", "4000"]) {
      expect(serialized).not.toContain(leaked);
    }
    expect(applied.scaleFactor).toBe(0.0001);
  });

  it("cannot reach the render projection's scientific values", () => {
    // `RenderSnapshot` has no field for a measurement, so a declaration can change
    // how a world looks and never what it is (docs/SCIENCE_MODEL.md §8).
    const snapshot = projectRenderSnapshot(
      { ...initialMissionSnapshot(3), selectedBodyId: FIXTURE_ALPHA },
      DEV_FIXTURE_BODIES,
    );
    expect(JSON.stringify(snapshot)).not.toContain("1000");
  });
});
