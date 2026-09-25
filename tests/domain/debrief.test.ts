/**
 * Debrief and completion summary (GAME-372).
 *
 * GAME-372 requires the debrief to explain which observations supported or refuted
 * the claim and to be content-driven and source-traceable, and the completion
 * summary to contain bounded facts suitable for later host integration. These run
 * against the canonical guided mission, so a content change to its facts moves them.
 */

import { describe, expect, it } from "vitest";

import { MISSIONS, PLANETARY_BODIES } from "@/content";
import { MARS_ID, MOON_ID, VENUS_ID } from "@/content/bodies";
import { GUIDED_MISSION_ID } from "@/content/missions";
import { createClaim, evaluateClaim, type Claim, type ClaimRelation } from "@/domain/claims";
import { buildCompletionSummary, buildMissionDebrief } from "@/domain/debrief";
import { captureEvidence, type EvidenceRecord } from "@/domain/evidence";
import { measure } from "@/domain/measurement";

export function guidedMission() {
  const mission = MISSIONS.find((candidate) => candidate.id === GUIDED_MISSION_ID);
  if (!mission) throw new Error("the canonical guided mission is missing");
  return mission;
}

const SEED = 1_026_001;

function capture(bodyId: string): EvidenceRecord {
  const outcome = measure(
    { instrumentId: "radiusSounder", bodyId, attributeId: "meanRadius", seed: SEED },
    PLANETARY_BODIES,
  );
  if (outcome.kind !== "measured") throw new Error(`the fixture should measure ${bodyId}`);
  const result = captureEvidence([], outcome);
  if (result.kind !== "captured") throw new Error(`the fixture should capture ${bodyId}`);
  return result.record;
}

const moon = capture(MOON_ID);
const mars = capture(MARS_ID);
const venus = capture(VENUS_ID);
const records = [moon, mars, venus];

function claim(relation: ClaimRelation, cited: readonly EvidenceRecord[]): Claim {
  return createClaim({
    attributeId: "meanRadius",
    subject: VENUS_ID,
    relation,
    object: MARS_ID,
    citedEvidenceIds: cited.map((record) => record.id),
  });
}

const mission = guidedMission();

describe("the debrief explains the evidence", () => {
  it("carries the verdict, dimensions, and explanation through unchanged", () => {
    const subject = claim("largerThan", [venus, mars]);
    const evaluation = evaluateClaim(subject, records);
    const debrief = buildMissionDebrief({
      mission,
      claim: subject,
      evaluation,
      records,
      hintsUsed: 0,
      claimAttempts: 1,
    });

    expect(debrief.verdict).toBe(evaluation.verdict);
    expect(debrief.dimensions).toEqual(evaluation.dimensions);
    expect(debrief.explanation).toBe(evaluation.explanation);
    expect(debrief.missionId).toBe(GUIDED_MISSION_ID);
  });

  it("names the cited observations that support a supported claim", () => {
    const subject = claim("largerThan", [venus, mars]);
    const debrief = buildMissionDebrief({
      mission,
      claim: subject,
      evaluation: evaluateClaim(subject, records),
      records,
      hintsUsed: 0,
      claimAttempts: 1,
    });
    expect(debrief.supportingEvidenceIds).toEqual(
      expect.arrayContaining([venus.id, mars.id]),
    );
    expect(debrief.refutingEvidenceIds).toEqual([]);
    // An uncited world in the notebook is never quietly included.
    expect(debrief.supportingEvidenceIds).not.toContain(moon.id);
  });

  it("names the observations that point the other way, and the matching misconception", () => {
    const backwards = claim("smallerThan", [venus, mars]);
    const debrief = buildMissionDebrief({
      mission,
      claim: backwards,
      evaluation: evaluateClaim(backwards, records),
      records,
      hintsUsed: 0,
      claimAttempts: 1,
    });
    expect(debrief.verdict).toBe("contradicted");
    expect(debrief.refutingEvidenceIds).toEqual(expect.arrayContaining([venus.id, mars.id]));
    expect(debrief.supportingEvidenceIds).toEqual([]);
    expect(debrief.misconception?.id).toBe("misconception.famous-world-is-bigger");
    expect(debrief.misconception?.feedback).toContain("6,051.8");
  });

  it("attaches no misconception to a claim that was not contradicted", () => {
    const subject = claim("largerThan", [venus, mars]);
    const debrief = buildMissionDebrief({
      mission,
      claim: subject,
      evaluation: evaluateClaim(subject, records),
      records,
      hintsUsed: 0,
      claimAttempts: 1,
    });
    expect(debrief.misconception).toBeNull();
  });

  it("quotes the mission's own facts, with register ids on the sourced ones", () => {
    const subject = claim("largerThan", [venus, mars]);
    const debrief = buildMissionDebrief({
      mission,
      claim: subject,
      evaluation: evaluateClaim(subject, records),
      records,
      hintsUsed: 0,
      claimAttempts: 1,
    });
    expect(debrief.facts.map((fact) => fact.id)).toEqual(
      mission.debriefFacts.map((fact) => fact.id),
    );
    for (const fact of debrief.facts) {
      if (fact.basis === "sourced") {
        expect(fact.sourceIds.length).toBeGreaterThan(0);
      } else {
        expect(fact.sourceIds).toEqual([]);
      }
    }
    // At least one sourced fact exists, so the traceability rule is exercised.
    expect(debrief.facts.some((fact) => fact.basis === "sourced")).toBe(true);
  });
});

describe("the completion summary is bounded and honest", () => {
  it("records counts and the verdict, and whether the target was met", () => {
    const subject = claim("largerThan", [venus, mars]);
    const evaluation = evaluateClaim(subject, records);
    const summary = buildCompletionSummary({
      mission,
      missionId: mission.id,
      seed: SEED,
      evaluation,
      claim: subject,
      evidence: records,
      hintsUsed: 1,
      claimAttempts: 2,
    });

    expect(summary.verdict).toBe("supported");
    expect(summary.targetMet).toBe(true);
    expect(summary.evidenceCount).toBe(3);
    expect(summary.observationsRequired).toBe(3);
    expect(summary.observationsCaptured).toBe(3);
    expect(summary.hintsUsed).toBe(1);
    expect(summary.claimAttempts).toBe(2);
  });

  it("does not mark the target met when the claim was not supported", () => {
    const backwards = claim("smallerThan", [venus, mars]);
    const summary = buildCompletionSummary({
      mission,
      missionId: mission.id,
      seed: SEED,
      evaluation: evaluateClaim(backwards, records),
      claim: backwards,
      evidence: records,
      hintsUsed: 0,
      claimAttempts: 1,
    });
    expect(summary.verdict).toBe("contradicted");
    expect(summary.targetMet).toBe(false);
  });

  it("counts captured observations against the mission's required path only", () => {
    // Only the Moon has been captured here; the mission requires three worlds.
    const summary = buildCompletionSummary({
      mission,
      missionId: mission.id,
      seed: SEED,
      evaluation: null,
      claim: null,
      evidence: [moon],
      hintsUsed: 0,
      claimAttempts: 0,
    });
    expect(summary.observationsRequired).toBe(3);
    expect(summary.observationsCaptured).toBe(1);
    expect(summary.citationCount).toBe(0);
  });

  it("carries no clock, device, identity, or free text", () => {
    const summary = buildCompletionSummary({
      mission,
      missionId: mission.id,
      seed: SEED,
      evaluation: null,
      claim: null,
      evidence: [],
      hintsUsed: 0,
      claimAttempts: 0,
    });
    expect(Object.keys(summary).sort()).toEqual([
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
});
