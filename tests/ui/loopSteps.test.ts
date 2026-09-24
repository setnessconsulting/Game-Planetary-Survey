import { describe, expect, it } from "vitest";

import { deriveLoopStatus, LOOP_STEPS, statusLabel, statusMarker } from "@/ui/loopSteps";
import { applyIntent, initialMissionSnapshot, type MissionSnapshot } from "@/domain/mission";
import { FIXTURE_ALPHA, FIXTURE_BETA, fixtureContext } from "@/testing/devFixture";

const context = fixtureContext();

function advance(snapshot: MissionSnapshot, intents: Parameters<typeof applyIntent>[1][]) {
  let current = snapshot;
  for (const intent of intents) {
    const result = applyIntent(current, intent, context);
    if (result.kind !== "applied") throw new Error(`rejected: ${result.reason}`);
    current = result.snapshot;
  }
  return current;
}

function statusOf(snapshot: MissionSnapshot, id: string) {
  const entry = deriveLoopStatus(snapshot).find((state) => state.step.id === id);
  if (!entry) throw new Error(`no such step: ${id}`);
  return entry;
}

describe("LOOP_STEPS", () => {
  it("is the frozen 11-step first-user path", () => {
    expect(LOOP_STEPS).toHaveLength(11);
    expect(LOOP_STEPS.map((step) => step.id)).toEqual([
      "load",
      "briefing",
      "chooseTarget",
      "selectInstrument",
      "observe",
      "captureEvidence",
      "compare",
      "makeClaim",
      "citeEvidence",
      "debrief",
      "reviseOrReplay",
    ]);
    expect(LOOP_STEPS.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe("deriveLoopStatus", () => {
  it("reports one state per step with an honest note", () => {
    const states = deriveLoopStatus(initialMissionSnapshot(0));
    expect(states).toHaveLength(11);
    for (const state of states) {
      expect(state.note.length).toBeGreaterThan(3);
      expect(["done", "active", "pending"]).toContain(state.status);
    }
  });

  it("marks the load step active while no mission is loaded, and says why", () => {
    const state = statusOf(initialMissionSnapshot(0), "load");
    expect(state.status).toBe("active");
    expect(state.note).toContain("No mission content is loaded");
  });

  it("marks load done once a mission is loaded", () => {
    const snapshot = advance(initialMissionSnapshot(1), [
      { kind: "loadMission", missionId: "m", seed: 1 },
    ]);
    expect(statusOf(snapshot, "load").status).toBe("done");
  });

  it("advances steps as the survey progresses", () => {
    let snapshot = advance(initialMissionSnapshot(2), [
      { kind: "loadMission", missionId: "m", seed: 2 },
      { kind: "beginBriefing" },
      { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    ]);
    expect(statusOf(snapshot, "chooseTarget").status).toBe("done");
    expect(statusOf(snapshot, "selectInstrument").status).toBe("pending");

    snapshot = advance(snapshot, [
      { kind: "selectInstrument", instrumentId: "radiusSounder" },
      { kind: "measure", attributeId: "meanRadius" },
    ]);
    expect(statusOf(snapshot, "selectInstrument").status).toBe("done");
    expect(statusOf(snapshot, "observe").status).toBe("done");
    expect(statusOf(snapshot, "captureEvidence").status).toBe("pending");

    snapshot = advance(snapshot, [
      { kind: "captureEvidence" },
      { kind: "selectTarget", bodyId: FIXTURE_BETA },
      { kind: "selectInstrument", instrumentId: "radiusSounder" },
      { kind: "measure", attributeId: "meanRadius" },
      { kind: "captureEvidence" },
      { kind: "compare" },
    ]);
    expect(statusOf(snapshot, "captureEvidence").status).toBe("done");
    expect(statusOf(snapshot, "compare").status).toBe("done");
    expect(statusOf(snapshot, "makeClaim").status).toBe("pending");
  });

  it("keeps cite-evidence pending until a claim actually cites something", () => {
    const snapshot = advance(initialMissionSnapshot(3), [
      { kind: "loadMission", missionId: "m", seed: 3 },
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
    ]);
    expect(statusOf(snapshot, "makeClaim").status).toBe("done");
    expect(statusOf(snapshot, "citeEvidence").status).toBe("pending");
    expect(statusOf(snapshot, "citeEvidence").note).toContain("uncited claim cannot be submitted");
  });

  it("is pure: the same snapshot derives the same statuses", () => {
    const snapshot = advance(initialMissionSnapshot(4), [
      { kind: "loadMission", missionId: "m", seed: 4 },
    ]);
    expect(JSON.stringify(deriveLoopStatus(snapshot))).toBe(JSON.stringify(deriveLoopStatus(snapshot)));
  });
});

describe("non-color status encodings", () => {
  it("provides a text marker and label for every status", () => {
    expect(statusMarker("done")).toBe("[\u2713]");
    expect(statusMarker("active")).toBe("[\u25B8]");
    expect(statusMarker("pending")).toBe("[ ]");
    expect(statusLabel("done")).toBe("Done");
    expect(statusLabel("active")).toBe("Current");
    expect(statusLabel("pending")).toBe("Not yet");
  });
});
