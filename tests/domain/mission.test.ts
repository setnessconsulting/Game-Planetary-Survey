import { describe, expect, it } from "vitest";

import {
  applyIntent,
  forwardIntentsIn,
  initialMissionSnapshot,
  LEGAL_PHASES,
  MISSION_PHASES,
  type IntentResult,
  type MissionIntent,
  type MissionSnapshot,
} from "@/domain/mission";
import { measure } from "@/domain/measurement";
import {
  DEV_FIXTURE_MISSION_ID,
  FIXTURE_ALPHA,
  FIXTURE_BETA,
  FIXTURE_GAMMA,
  fixtureContext,
} from "@/testing/devFixture";

const context = fixtureContext();

function run(snapshot: MissionSnapshot, intents: Parameters<typeof applyIntent>[1][]): MissionSnapshot {
  let current = snapshot;
  for (const intent of intents) {
    const result = applyIntent(current, intent, context);
    if (result.kind === "rejected") {
      throw new Error(`Intent ${intent.kind} was rejected: ${result.reason}`);
    }
    current = result.snapshot;
  }
  return current;
}

function surveyToComparison(seed = 7): MissionSnapshot {
  return run(initialMissionSnapshot(seed), [
    { kind: "loadMission", missionId: "dev-survey", seed },
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
  ]);
}

describe("initial state", () => {
  it("starts unloaded with an empty notebook", () => {
    const snapshot = initialMissionSnapshot(0);
    expect(snapshot.phase).toBe("unloaded");
    expect(snapshot.evidence).toHaveLength(0);
    expect(snapshot.comparison).toHaveLength(0);
    expect(snapshot.claim).toBeNull();
    expect(snapshot.revision).toBe(0);
  });

  it("is JSON-serializable and round-trips", () => {
    const snapshot = surveyToComparison();
    const roundTripped = JSON.parse(JSON.stringify(snapshot)) as MissionSnapshot;
    expect(roundTripped).toEqual(snapshot);
  });
});

describe("the canonical loop", () => {
  it("advances through brief -> target -> instrument -> measure -> capture -> compare", () => {
    const afterCapture = run(initialMissionSnapshot(3), [
      { kind: "loadMission", missionId: "m", seed: 3 },
      { kind: "beginBriefing" },
      { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
      { kind: "selectInstrument", instrumentId: "radiusSounder" },
      { kind: "measure", attributeId: "meanRadius" },
      { kind: "captureEvidence" },
    ]);
    expect(afterCapture.phase).toBe("comparison");
    expect(afterCapture.evidence).toHaveLength(1);
    // Observation is not capture: the measurement is cleared once kept.
    expect(afterCapture.lastMeasurement).toBeNull();
  });

  it("reaches a submitted claim end to end", () => {
    let snapshot = surveyToComparison();
    snapshot = run(snapshot, [{ kind: "compare" }]);
    expect(snapshot.phase).toBe("claimDrafting");
    expect(snapshot.comparison).toHaveLength(1);

    const [alpha, beta] = snapshot.evidence;
    snapshot = run(snapshot, [
      {
        kind: "draftClaim",
        draft: {
          attributeId: "meanRadius",
          subject: FIXTURE_BETA,
          relation: "largerThan",
          object: FIXTURE_ALPHA,
          citedEvidenceIds: [alpha?.id ?? "", beta?.id ?? ""],
        },
      },
      { kind: "submitClaim" },
    ]);

    expect(snapshot.phase).toBe("claimSubmitted");
    expect(snapshot.evaluation?.verdict).toBe("supported");
  });

  it("requires a claim before it can be submitted", () => {
    const result = applyIntent(surveyToComparison(), { kind: "submitClaim" }, context);
    expect(result.kind).toBe("rejected");
  });
});

describe("honest failure and rejection", () => {
  it("rejects an intent that is illegal in the current phase, without changing state", () => {
    const snapshot = initialMissionSnapshot(1);
    const result = applyIntent(
      snapshot,
      { kind: "measure", attributeId: "meanRadius" },
      context,
    );
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") return;
    expect(result.snapshot).toEqual(snapshot);
    expect(result.reason).toContain("not available");
  });

  it("records an unavailable measurement instead of fabricating a value", () => {
    const beforeMeasure = run(initialMissionSnapshot(2), [
      { kind: "loadMission", missionId: "m", seed: 2 },
      { kind: "beginBriefing" },
      { kind: "selectTarget", bodyId: FIXTURE_GAMMA },
      { kind: "selectInstrument", instrumentId: "atmosphereSounder" },
    ]);
    const result = applyIntent(beforeMeasure, { kind: "measure", attributeId: "atmosphereDepth" }, context);
    expect(result.kind).toBe("applied");
    if (result.kind !== "applied") return;
    expect(result.snapshot.lastMeasurement?.kind).toBe("unavailable");
    expect(result.fact).toContain("instead of a guess");
  });

  it("refuses to capture when nothing was measured", () => {
    const snapshot = run(initialMissionSnapshot(1), [
      { kind: "loadMission", missionId: "m", seed: 1 },
      { kind: "beginBriefing" },
      { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    ]);
    const result = applyIntent(snapshot, { kind: "captureEvidence" }, context);
    expect(result.kind).toBe("rejected");
  });

  it("refuses a comparison that has insufficient evidence", () => {
    const snapshot = run(initialMissionSnapshot(1), [
      { kind: "loadMission", missionId: "m", seed: 1 },
      { kind: "beginBriefing" },
      { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
      { kind: "selectInstrument", instrumentId: "radiusSounder" },
      { kind: "measure", attributeId: "meanRadius" },
      { kind: "captureEvidence" },
    ]);
    const result = applyIntent(snapshot, { kind: "compare" }, context);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "rejected") return;
    expect(result.reason).toContain("at least two worlds");
  });

  it("rejects an unknown target world rather than inventing one", () => {
    const snapshot = run(initialMissionSnapshot(1), [
      { kind: "loadMission", missionId: "m", seed: 1 },
      { kind: "beginBriefing" },
    ]);
    const result = applyIntent(snapshot, { kind: "selectTarget", bodyId: "not-a-world" }, context);
    expect(result.kind).toBe("rejected");
  });
});

describe("guarantees", () => {
  it("has no dead-end phase", () => {
    for (const phase of MISSION_PHASES) {
      expect(forwardIntentsIn(phase).length, `${phase} is a dead end`).toBeGreaterThan(0);
    }
  });

  it("is deterministic: the same intents produce byte-identical state", () => {
    const first = run(surveyToComparison(99), [{ kind: "compare" }]);
    const second = run(surveyToComparison(99), [{ kind: "compare" }]);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("counts hints without letting a hint perform a required choice", () => {
    const before = initialMissionSnapshot(1);
    const result = applyIntent(before, { kind: "requestHint" }, context) as IntentResult;
    if (result.kind !== "applied") throw new Error("hint should be allowed");
    expect(result.snapshot.hintsUsed).toBe(1);
    // A hint changes nothing about the mission's scientific choices.
    expect(result.snapshot.selectedBodyId).toBeNull();
    expect(result.snapshot.selectedInstrumentId).toBeNull();
    expect(result.snapshot.evidence).toHaveLength(0);
  });

  it("resets to a clean unloaded state", () => {
    const result = applyIntent(surveyToComparison(), { kind: "reset" }, context);
    if (result.kind !== "applied") throw new Error("reset should be allowed");
    expect(result.snapshot.phase).toBe("unloaded");
    expect(result.snapshot.evidence).toHaveLength(0);
  });

  it("increments the revision on every accepted intent", () => {
    const first = applyIntent(initialMissionSnapshot(1), { kind: "beginBriefing" }, context);
    if (first.kind !== "applied") throw new Error("expected applied");
    const second = applyIntent(first.snapshot, { kind: "requestHint" }, context);
    if (second.kind !== "applied") throw new Error("expected applied");
    expect(second.snapshot.revision).toBe(first.snapshot.revision + 1);
  });
});

describe("the PS-08 claim loop", () => {
  /**
   * A debrief-phase snapshot with a submitted claim, a matching evaluation, an
   * opened debrief, and a fresh measurement still in hand (so `captureEvidence`'s
   * own guard is satisfied when the transition matrix probes it).
   */
  function richBase(seed = 5): MissionSnapshot {
    let snapshot = surveyToComparison(seed);
    const [alpha, beta] = snapshot.evidence;
    snapshot = run(snapshot, [
      {
        kind: "draftClaim",
        draft: {
          attributeId: "meanRadius",
          subject: FIXTURE_BETA,
          relation: "largerThan",
          object: FIXTURE_ALPHA,
          citedEvidenceIds: [alpha?.id ?? "", beta?.id ?? ""],
        },
      },
      { kind: "submitClaim" },
      { kind: "openDebrief" },
    ]);
    // A fresh measurement of an uncaptured world, so `captureEvidence`'s own
    // duplicate guard is satisfied when the transition matrix probes it.
    const measured = measure(
      { instrumentId: "radiusSounder", bodyId: FIXTURE_GAMMA, attributeId: "meanRadius", seed: snapshot.seed },
      context.bodies,
    );
    if (measured.kind !== "measured") throw new Error("the fixture should measure");
    return { ...snapshot, lastMeasurement: measured };
  }

  it("covers every legal and illegal (intent, phase) pair against the declared table", () => {
    const base = richBase();
    const representative: readonly MissionIntent[] = [
      { kind: "loadMission", missionId: DEV_FIXTURE_MISSION_ID, seed: 1 },
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

    const mismatches: string[] = [];
    for (const intent of representative) {
      for (const phase of MISSION_PHASES) {
        const result = applyIntent({ ...base, phase }, intent, context);
        const declaredLegal = LEGAL_PHASES[intent.kind].includes(phase);
        if (declaredLegal !== (result.kind === "applied")) {
          mismatches.push(`${intent.kind} in ${phase}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("attaches cited evidence to a drafted claim and refuses ids it does not hold", () => {
    let snapshot = surveyToComparison();
    const [alpha] = snapshot.evidence;
    snapshot = run(snapshot, [
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
      { kind: "citeEvidence", evidenceIds: [alpha?.id ?? ""] },
    ]);
    expect(snapshot.claim?.citedEvidenceIds).toEqual([alpha?.id]);

    const rejected = applyIntent(
      snapshot,
      { kind: "citeEvidence", evidenceIds: ["not-a-record"] },
      context,
    );
    expect(rejected.kind).toBe("rejected");
    // A refusal changes nothing: the citation is untouched.
    expect(rejected.snapshot.claim?.citedEvidenceIds).toEqual([alpha?.id]);
  });

  it("counts claim attempts across revisions", () => {
    expect(richBase().claimAttempts).toBe(1);
    const after = run(richBase(), [{ kind: "reviseClaim" }, { kind: "submitClaim" }]);
    expect(after.claimAttempts).toBe(2);
  });

  it("reopens the claim in place and clears the stale verdict", () => {
    const before = richBase();
    const after = run(before, [{ kind: "reviseClaim" }]);
    expect(after.phase).toBe("claimDrafting");
    expect(after.claim).not.toBeNull();
    expect(after.evaluation).toBeNull();
    expect(after.debrief).toBeNull();
    expect(after.completion).toBeNull();
    // Nothing measured is discarded.
    expect(after.evidence).toEqual(before.evidence);
  });

  it("builds a source-traceable debrief and a bounded completion summary", () => {
    const base = richBase();
    const debrief = base.debrief;
    expect(debrief).not.toBeNull();
    expect(debrief?.verdict).toBe("supported");
    expect(debrief?.missionId).toBe(DEV_FIXTURE_MISSION_ID);
    for (const fact of debrief?.facts ?? []) {
      if (fact.basis === "sourced") expect(fact.sourceIds.length).toBeGreaterThan(0);
      else expect(fact.sourceIds).toEqual([]);
    }

    const completed = applyIntent(base, { kind: "completeMission" }, context);
    if (completed.kind !== "applied") throw new Error("completion should be applied");
    expect(completed.snapshot.phase).toBe("complete");
    const summary = completed.snapshot.completion;
    expect(summary?.targetMet).toBe(true);
    expect(summary?.observationsCaptured).toBe(2);
    // Bounded facts only: no clock, identity, or free text.
    expect(Object.keys(summary ?? {}).sort()).toEqual([
      "citationCount",
      "claimAttempts",
      "dimensions",
      "evidenceCount",
      "hintsUsed",
      "missionId",
      "observationsCaptured",
      "observationsRequired",
      "seed",
      "targetMet",
      "verdict",
    ]);
  });

  it("refuses to complete before the debrief is opened", () => {
    const submitted = run(surveyToComparison(), [
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
      { kind: "submitClaim" },
    ]);
    expect(applyIntent(submitted, { kind: "completeMission" }, context).kind).toBe("rejected");
  });

  it("rejects openDebrief when the caller supplied no mission definitions", () => {
    const submitted = run(surveyToComparison(), [
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
      { kind: "submitClaim" },
    ]);
    const result = applyIntent(submitted, { kind: "openDebrief" }, { bodies: context.bodies });
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") expect(result.reason).toContain("debrief facts");
  });
});
