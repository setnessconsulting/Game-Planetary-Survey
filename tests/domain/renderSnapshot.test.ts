import { describe, expect, it } from "vitest";

import { projectRenderSnapshot, renderSnapshotKeys } from "@/domain/renderSnapshot";
import { applyIntent, initialMissionSnapshot, type MissionSnapshot } from "@/domain/mission";
import { DEV_FIXTURE_BODIES, FIXTURE_ALPHA, fixtureContext } from "@/testing/devFixture";

const context = fixtureContext();

function surveyedSnapshot(): MissionSnapshot {
  let snapshot = initialMissionSnapshot(5);
  for (const intent of [
    { kind: "loadMission", missionId: "m", seed: 5 },
    { kind: "beginBriefing" },
    { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    { kind: "selectInstrument", instrumentId: "altimeter" },
    { kind: "measure", attributeId: "surfaceRelief" },
  ] as const) {
    const result = applyIntent(snapshot, intent, context);
    if (result.kind === "applied") snapshot = result.snapshot;
  }
  return snapshot;
}

describe("projectRenderSnapshot", () => {
  it("degrades to an honest reference view when no body is loaded", () => {
    const projected = projectRenderSnapshot(initialMissionSnapshot(0), DEV_FIXTURE_BODIES);
    expect(projected.bodyId).toBeNull();
    expect(projected.displayName).toBeNull();
    expect(projected.presentation.mode).toBe("reference");
    expect(projected.presentation.scaleNotice).toContain("no mission body is loaded");
    expect(projected.presentation.scaleNotice).toContain("nothing here is a measurement");
  });

  it("carries the display name and target when a body is selected", () => {
    const projected = projectRenderSnapshot(surveyedSnapshot(), DEV_FIXTURE_BODIES);
    expect(projected.bodyId).toBe(FIXTURE_ALPHA);
    expect(projected.displayName).toBe("Fixture Alpha");
    expect(projected.presentation.mode).toBe("body");
  });

  it("states body-relative presentation for a surveyed target", () => {
    const projected = projectRenderSnapshot(surveyedSnapshot(), DEV_FIXTURE_BODIES);
    expect(projected.presentation.scaleMode).toBe("bodyRelative");
    expect(projected.presentation.scaleNotice).toContain("body-relative");
    expect(projected.presentation.cameraMode).toBe("inspection");
  });

  it("uses the system-comparison declaration for target selection", () => {
    let snapshot = initialMissionSnapshot(1);
    for (const intent of [
      { kind: "loadMission", missionId: "m", seed: 1 },
      { kind: "beginBriefing" },
    ] as const) {
      const result = applyIntent(snapshot, intent, context);
      if (result.kind !== "applied") throw new Error(`rejected: ${result.reason}`);
      snapshot = result.snapshot;
    }
    const projected = projectRenderSnapshot(snapshot, DEV_FIXTURE_BODIES, [
      {
        id: "SIM-7",
        representationId: "system-comparison",
        kind: "nonLinearCompression",
        ratio: 0.0001,
        sourceBasisIds: ["fixture.alpha.radius"],
        rationale: "legibility",
        modelBoundary: "not a measurement",
        learnerText: "This comparison view is compressed, not literal.",
        reviewStatus: "unreviewed",
      },
    ]);
    expect(projected.presentation.mode).toBe("systemComparison");
    expect(projected.presentation.scaleMode).toBe("comparativeNonLiteral");
    expect(projected.presentation.declarationId).toBe("SIM-7");
    expect(projected.presentation.scaleNotice).toContain("compressed");
    expect(projected.presentation.cameraMode).toBe("systemComparison");
  });

  it("states that the comparison view is not drawn to literal scale", () => {
    const projected = projectRenderSnapshot(
      { ...surveyedSnapshot(), phase: "comparison" },
      DEV_FIXTURE_BODIES,
      [
        {
          id: "SIM-7",
          representationId: "system-comparison",
          kind: "nonLinearCompression",
          ratio: 0.0001,
          sourceBasisIds: ["fixture.alpha.radius"],
          rationale: "legibility",
          modelBoundary: "not a measurement",
          learnerText: "This comparison view is not drawn to literal scale.",
          reviewStatus: "unreviewed",
        },
      ],
    );
    expect(projected.presentation.scaleNotice).toContain("not drawn to literal scale");
  });

  it("exposes attribute IDS but no attribute VALUES", () => {
    const projected = projectRenderSnapshot(surveyedSnapshot(), DEV_FIXTURE_BODIES);
    // Fixture Alpha has a radius, an atmosphere depth, and a temperature.
    expect([...projected.bodyAvailableAttributes].sort()).toEqual([
      "atmosphereDepth",
      "meanRadius",
      "meanSurfaceTemperature",
    ]);
  });

  it("DOES NOT LEAK a single scientific value into the renderer", () => {
    // The strongest form of the boundary guarantee: serialize the projection and
    // assert none of the fixture's sourced magnitudes appear anywhere in it.
    const projected = projectRenderSnapshot(surveyedSnapshot(), DEV_FIXTURE_BODIES);
    const serialized = JSON.stringify(projected);
    for (const leakedValue of ["1000", "4000", "20", "300", "250000000", "250"]) {
      expect(serialized).not.toContain(leakedValue);
    }
    expect(serialized).not.toContain("fixture.alpha.radius");
  });

  it("keeps a stable, inspectable shape", () => {
    const projected = projectRenderSnapshot(surveyedSnapshot(), DEV_FIXTURE_BODIES);
    expect(renderSnapshotKeys(projected)).toEqual([
      "approachProgress",
      "bodyAvailableAttributes",
      "bodyId",
      "displayName",
      "instrumentId",
      "observationActive",
      "phase",
      "presentation",
    ]);
    expect(Object.keys(projected.presentation).sort()).toEqual([
      "cameraMode",
      "declarationId",
      "mode",
      "scaleFactor",
      "scaleMode",
      "scaleNotice",
    ]);
  });

  it("is pure and total, including for an unknown body id", () => {
    const unknown: MissionSnapshot = { ...initialMissionSnapshot(0), selectedBodyId: "ghost" };
    const projected = projectRenderSnapshot(unknown, DEV_FIXTURE_BODIES);
    expect(projected.presentation.mode).toBe("reference");
    expect(JSON.stringify(projectRenderSnapshot(unknown, DEV_FIXTURE_BODIES))).toBe(
      JSON.stringify(projected),
    );
  });

  it("reports observation-active only while observing", () => {
    // Selecting an instrument moves the mission into `observing`; simply having a
    // target selected does not.
    let snapshot = initialMissionSnapshot(1);
    for (const intent of [
      { kind: "loadMission", missionId: "m", seed: 1 },
      { kind: "beginBriefing" },
      { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    ] as const) {
      const result = applyIntent(snapshot, intent, context);
      if (result.kind !== "applied") throw new Error(`rejected: ${result.reason}`);
      snapshot = result.snapshot;
    }
    // A chosen target alone is not "observing".
    expect(projectRenderSnapshot(snapshot, DEV_FIXTURE_BODIES).observationActive).toBe(false);

    // Selecting an instrument moves the mission into the observing phase.
    const withInstrument = applyIntent(
      snapshot,
      { kind: "selectInstrument", instrumentId: "altimeter" },
      context,
    );
    if (withInstrument.kind !== "applied") throw new Error("expected applied");
    expect(withInstrument.snapshot.phase).toBe("observing");
    expect(
      projectRenderSnapshot(withInstrument.snapshot, DEV_FIXTURE_BODIES).observationActive,
    ).toBe(true);
  });

  it("keeps approach progress inside [0, 1]", () => {
    for (const phase of ["unloaded", "briefing", "comparison", "complete"] as const) {
      const projected = projectRenderSnapshot(
        { ...initialMissionSnapshot(0), phase },
        DEV_FIXTURE_BODIES,
      );
      expect(projected.approachProgress).toBeGreaterThanOrEqual(0);
      expect(projected.approachProgress).toBeLessThanOrEqual(1);
    }
  });
});
