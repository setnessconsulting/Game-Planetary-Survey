/**
 * Evidence requirements cannot be bypassed (GAME-372).
 *
 * GAME-372's acceptance requires that "no renderer event can bypass evidence
 * requirements". The renderer reaches the domain only by having the app translate a
 * `RenderEvent` into a `MissionIntent`, and the domain decides legality
 * (docs/TECHNICAL_DESIGN.md §4.3). So the property to pin is about intents: from a
 * mid-mission state, no intent can add evidence except capturing a measurement, no
 * intent can fabricate a claim or finish a mission, and the intent surface contains
 * no renderer-originated member. This is the same discipline the architecture check
 * enforces structurally; here it is behaviour.
 */

import { describe, expect, it } from "vitest";

import {
  applyIntent,
  initialMissionSnapshot,
  LEGAL_PHASES,
  MISSION_PHASES,
  type IntentResult,
  type MissionIntent,
  type MissionSnapshot,
} from "@/domain/mission";
import { DEV_FIXTURE_MISSION_ID, FIXTURE_ALPHA, FIXTURE_BETA, fixtureContext } from "@/testing/devFixture";

const context = fixtureContext();

function applied(snapshot: MissionSnapshot, intent: MissionIntent): MissionSnapshot {
  const result: IntentResult = applyIntent(snapshot, intent, context);
  if (result.kind !== "applied") throw new Error(`${intent.kind} was rejected: ${result.reason}`);
  return result.snapshot;
}

/** A legal mid-mission state: two worlds measured, captured, and compared. */
function midMission(): MissionSnapshot {
  let snapshot = initialMissionSnapshot(9);
  const intents: readonly MissionIntent[] = [
    { kind: "loadMission", missionId: DEV_FIXTURE_MISSION_ID, seed: 9 },
    { kind: "beginBriefing" },
    { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    { kind: "selectInstrument", instrumentId: "radiusSounder" },
    { kind: "measure", attributeId: "meanRadius" },
    { kind: "captureEvidence" },
    { kind: "selectTarget", bodyId: FIXTURE_BETA },
    { kind: "selectInstrument", instrumentId: "radiusSounder" },
    { kind: "measure", attributeId: "meanRadius" },
    { kind: "captureEvidence" },
    { kind: "compare" },
  ];
  for (const intent of intents) snapshot = applied(snapshot, intent);
  return snapshot;
}

function representativeIntents(base: MissionSnapshot): readonly MissionIntent[] {
  return [
    { kind: "loadMission", missionId: DEV_FIXTURE_MISSION_ID, seed: 9 },
    { kind: "beginBriefing" },
    { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    { kind: "selectInstrument", instrumentId: "radiusSounder" },
    { kind: "measure", attributeId: "meanRadius" },
    { kind: "captureEvidence" },
    { kind: "compare" },
    {
      kind: "draftClaim",
      draft: {
        attributeId: "meanRadius",
        subject: FIXTURE_BETA,
        relation: "largerThan",
        object: FIXTURE_ALPHA,
        citedEvidenceIds: [],
      },
    },
    { kind: "citeEvidence", evidenceIds: base.evidence.map((record) => record.id) },
    { kind: "submitClaim" },
    { kind: "openDebrief" },
    { kind: "completeMission" },
    { kind: "reviseClaim" },
    { kind: "requestHint" },
    { kind: "reset" },
  ];
}

describe("no intent can bypass the evidence requirements", () => {
  it("adds evidence only through capturing a measurement", () => {
    const base = midMission();
    for (const intent of representativeIntents(base)) {
      if (intent.kind === "captureEvidence") continue;
      const result = applyIntent(base, intent, context);
      if (result.kind !== "applied") continue;
      expect(result.snapshot.evidence.length, intent.kind).toBeLessThanOrEqual(
        base.evidence.length,
      );
    }
  });

  it("cannot submit a claim that was never drafted", () => {
    const result = applyIntent(midMission(), { kind: "submitClaim" }, context);
    expect(result.kind).toBe("rejected");
  });

  it("cannot submit a claim that is not fully evidenced, however complete the notebook", () => {
    const base = midMission();
    const drafted = applied(base, {
      kind: "draftClaim",
      draft: {
        attributeId: "meanRadius",
        subject: FIXTURE_BETA,
        relation: "largerThan",
        object: FIXTURE_ALPHA,
        citedEvidenceIds: [],
      },
    });
    const submitted = applied(drafted, { kind: "submitClaim" });
    // A full notebook is not a citation: the anti-guessing rule holds.
    expect(submitted.evaluation?.verdict).toBe("insufficient-evidence");
    expect(submitted.evaluation?.dimensions.citationCoverage).toBe(false);
  });

  it("cannot complete a mission before a debrief exists, from any phase", () => {
    const base = midMission();
    for (const phase of MISSION_PHASES) {
      const result = applyIntent({ ...base, phase }, { kind: "completeMission" }, context);
      expect(result.kind, phase).toBe("rejected");
    }
  });

  it("exposes no renderer-originated intent kind", () => {
    // The intent surface is pinned. A renderer event is translated into one of these
    // by the app; adding a renderer-shaped intent would be a visible diff here.
    expect(Object.keys(LEGAL_PHASES).sort()).toEqual(
      [
        "beginBriefing",
        "captureEvidence",
        "citeEvidence",
        "compare",
        "completeMission",
        "draftClaim",
        "loadMission",
        "measure",
        "openDebrief",
        "requestHint",
        "reset",
        "reviseClaim",
        "selectInstrument",
        "selectTarget",
        "submitClaim",
      ].sort(),
    );
  });
});
