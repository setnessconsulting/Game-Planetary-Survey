/**
 * The vertical-slice gate (GAME-373 / PS-09).
 *
 * GAME-373 is the **hard gate before content expansion**. A gate that exists only as
 * a sentence in a document is a hope, so this file makes the two properties the gate
 * depends on mechanical:
 *
 *  1. **every shipped mission can be played to completion along its own authored
 *     path.** Its required observations are measurable with the instruments it
 *     names, its claim target is supported by that evidence, and completion reports
 *     the target as met (D-40). Add a mission that cannot be finished, or that
 *     requires evidence its instruments cannot produce, and the build fails — rather
 *     than a learner finding it.
 *  2. **the real-browser slice evidence still exists.** The specs that prove the
 *     slice in a browser, and the document that records what they do and do not
 *     establish, are part of the gate rather than files someone can delete quietly.
 *
 * This drives the domain directly, so it is renderer-free, deterministic, and runs
 * in milliseconds. The browser half of the same gate is
 * `tests/e2e/verticalSlice.spec.ts`, which runs as part of `npm run test:e2e`.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { MISSIONS, PLANETARY_BODIES } from "@/content";
import type { MissionDefinition } from "@/domain/catalog";
import type { EvidenceRecord } from "@/domain/evidence";
import {
  applyIntent,
  initialMissionSnapshot,
  type MissionContext,
  type MissionIntent,
  type MissionSnapshot,
} from "@/domain/mission";
import { citedEvidenceIds } from "@/testing/missionTrace";

const CONTEXT: MissionContext = { bodies: PLANETARY_BODIES, missions: MISSIONS };

/**
 * Play a mission exactly the way its own content says it should be played: every
 * required observation, in the authored order, with the authored instrument; then
 * compare, and claim the authored target while citing exactly the authored evidence.
 *
 * Nothing here is mission-specific on purpose. If a mission cannot be finished this
 * way, its content and its completion path disagree, and that is the failure.
 */
function playMission(mission: MissionDefinition): MissionSnapshot {
  const seed = mission.seedBase;
  let snapshot = initialMissionSnapshot(seed);

  const apply = (intent: MissionIntent): void => {
    const outcome = applyIntent(snapshot, intent, CONTEXT);
    if (outcome.kind === "rejected") {
      throw new Error(`${mission.id}: ${intent.kind} was rejected — ${outcome.reason}`);
    }
    snapshot = outcome.snapshot;
  };

  apply({ kind: "loadMission", missionId: mission.id, seed });
  apply({ kind: "beginBriefing" });

  for (const observation of mission.requiredObservations) {
    apply({ kind: "selectTarget", bodyId: observation.bodyId });
    apply({ kind: "selectInstrument", instrumentId: observation.instrumentId });
    apply({ kind: "measure", attributeId: observation.attributeId });
    if (snapshot.lastMeasurement?.kind !== "measured") {
      throw new Error(
        `${mission.id}: ${observation.bodyId}.${observation.attributeId} is unavailable to the ` +
          `instrument the mission names, so the mission cannot be played as authored.`,
      );
    }
    apply({ kind: "captureEvidence" });
  }

  apply({ kind: "compare" });

  const target = mission.claimTarget;
  const pairs = target.requiredEvidence.map(
    (key) => key.split(".") as [string, EvidenceRecord["attributeId"]],
  );
  apply({
    kind: "draftClaim",
    draft: {
      attributeId: target.attributeId,
      basis: target.basis,
      subject: target.subject,
      relation: target.relation,
      object: target.object,
      citedEvidenceIds: citedEvidenceIds(snapshot, pairs),
    },
  });
  apply({ kind: "submitClaim" });
  apply({ kind: "openDebrief" });
  apply({ kind: "completeMission" });

  return snapshot;
}

describe("every shipped mission is completable along its authored path", () => {
  it("ships at least one mission, and a guided one to gate content expansion on", () => {
    expect(MISSIONS.length).toBeGreaterThan(0);
    expect(MISSIONS.filter((mission) => mission.kind === "guided")).toHaveLength(1);
  });

  for (const mission of MISSIONS) {
    it(`${mission.id} reaches complete with its target met`, () => {
      const final = playMission(mission);

      expect(final.phase).toBe("complete");
      expect(final.evaluation?.verdict).toBe("supported");
      // The mission's own evidence is fully cited, so nothing is left outstanding
      // for the learner (D-40). This is the property the F-1 defect broke.
      expect(final.debrief?.missingRequiredEvidence).toEqual([]);
      expect(final.completion?.targetMet).toBe(true);
      expect(final.completion?.observationsRequired).toBe(mission.requiredObservations.length);
      expect(final.completion?.observationsCaptured).toBe(mission.requiredObservations.length);
      expect(final.completion?.evidenceCount).toBe(mission.requiredObservations.length);

      // Every citation is a record the run actually produced.
      const known = new Set(final.evidence.map((record) => record.id));
      for (const id of final.claim?.citedEvidenceIds ?? []) {
        expect(known.has(id), `${mission.id} cites an observation the run never made`).toBe(true);
      }
    });
  }
});

describe("the gate needs its browser evidence to exist", () => {
  // Vitest runs with the project root as the working directory; `import.meta.url`
  // is not a file URL under the jsdom environment, so it cannot be used here.
  const ROOT = process.cwd();

  it("keeps the real-browser slice spec, its evidence generator, and the record", () => {
    // Deleting the proof should fail the build, not quietly shrink the gate.
    for (const relative of [
      "tests/e2e/verticalSlice.spec.ts",
      "tests/e2e/sliceEvidence.spec.ts",
      "docs/SLICE_QUALIFICATION.md",
    ]) {
      expect(existsSync(resolve(ROOT, relative)), `${relative} is missing`).toBe(true);
    }
  });
});
