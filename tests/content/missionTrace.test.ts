/**
 * Golden mission traces (GAME-368).
 *
 * PS-04 requires golden mission traces that are "independent of presentation" and
 * fixtures that are "deterministic and testable without Babylon/React". These
 * tests replay recorded learner paths through the pure domain and pin a digest of
 * the whole path, so a change to the mission state machine, the claim contract, or
 * the shipped content is a visible diff rather than a behaviour someone discovers
 * in a browser.
 *
 * Nothing here imports React or Babylon. That is not an accident of style: the
 * point of the fixture is that the mission's *logic* is provable without a
 * renderer, which is what makes the renderer free to change.
 */

import { describe, expect, it } from "vitest";

import { MISSIONS, PLANETARY_BODIES } from "@/content";
import { MARS_ID, MOON_ID, TITAN_ID, VENUS_ID } from "@/content/bodies";
import {
  DISTANCE_MISSION_ID,
  GUIDED_MISSION_ID,
  RELIEF_MISSION_ID,
  VARIANT_MISSION_ID,
} from "@/content/missions";
import { forwardIntentsIn, type MissionSnapshot } from "@/domain/mission";
import {
  citedEvidenceId,
  citedEvidenceIds,
  runMissionTrace,
  type TraceStep,
} from "@/testing/missionTrace";

const GUIDED_SEED = 1_026_001;

/** The three measurements `survey-001-sizes` requires, in the brief's order. */
const GUIDED_WORLDS = [MOON_ID, MARS_ID, VENUS_ID] as const;

/**
 * Measure one property of one world, the way the loop requires: choose the world,
 * choose the instrument that answers the question, measure, then keep it. Capture
 * is a separate learner action on purpose (docs/UX_USER_FLOW.md step 6), so a trace
 * that skipped it would not be a legal path.
 */
function surveySteps(
  bodyId: string,
  instrumentId: "radiusSounder" | "altimeter" | "orbitalRangefinder",
  attributeId: "meanRadius" | "surfaceRelief" | "orbitalRadius",
): readonly TraceStep[] {
  return [
    { note: `select ${bodyId}`, intent: { kind: "selectTarget", bodyId }, expect: "applied" },
    {
      note: `choose ${instrumentId} for ${bodyId}`,
      intent: { kind: "selectInstrument", instrumentId },
      expect: "applied",
    },
    {
      note: `measure ${bodyId}.${attributeId}`,
      intent: { kind: "measure", attributeId },
      expect: "applied",
    },
    {
      note: `capture ${bodyId}.${attributeId} as evidence`,
      intent: { kind: "captureEvidence" },
      expect: "applied",
    },
  ];
}

const GUIDED_SURVEY = GUIDED_WORLDS.flatMap((bodyId) =>
  surveySteps(bodyId, "radiusSounder", "meanRadius"),
);

const GUIDED_SIZES_CLAIM_PAIRS = [
  [VENUS_ID, "meanRadius"],
  [MARS_ID, "meanRadius"],
  [MOON_ID, "meanRadius"],
] as const;

describe("golden trace: the guided mission played correctly", () => {
  const trace: readonly TraceStep[] = [
    {
      note: "load the guided mission",
      intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
      expect: "applied",
    },
    { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
    ...GUIDED_SURVEY,
    { note: "compare the worlds", intent: { kind: "compare" }, expect: "applied" },
    {
      note: "draft the claim as the brief asks, citing all three measurements",
      intent: (snapshot) => ({
        kind: "draftClaim",
        draft: {
          attributeId: "meanRadius",
          subject: VENUS_ID,
          relation: "largerThan",
          object: MARS_ID,
          citedEvidenceIds: citedEvidenceIds(snapshot, GUIDED_SIZES_CLAIM_PAIRS),
        },
      }),
      expect: "applied",
    },
    { note: "submit the claim", intent: { kind: "submitClaim" }, expect: "applied" },
    { note: "open the debrief", intent: { kind: "openDebrief" }, expect: "applied" },
    { note: "complete the mission", intent: { kind: "completeMission" }, expect: "applied" },
  ];

  const run = runMissionTrace({
    steps: trace,
    bodies: PLANETARY_BODIES,
    seed: GUIDED_SEED,
    missions: MISSIONS,
  });

  it("records a step for every intent and refuses nothing on a legal path", () => {
    expect(run.steps).toHaveLength(trace.length);
    expect(run.steps.map((step) => step.kind)).toEqual(trace.map((step) => step.expect));
    expect(run.rejections).toEqual([]);
    expect(run.revisions).toBe(trace.length);
  });

  it("ends with the claim supported by the learner's own evidence", () => {
    const evaluation = run.finalSnapshot.evaluation;
    expect(evaluation?.verdict).toBe("supported");
    expect(evaluation?.dimensions).toEqual({
      citationCoverage: true,
      evidenceAdequacy: true,
      unitAndPrecisionCare: true,
      reasoningConsistency: true,
    });
    expect(run.finalSnapshot.evidence).toHaveLength(3);
  });

  it("finishes the mission on the evaluated claim, and records the outcome", () => {
    // PS-08 closes STATUS constraint 6: the loop now reaches debrief and complete.
    // Completion records the verdict rather than requiring a supported one (D-35).
    expect(run.finalPhase).toBe("complete");
    expect(run.finalSnapshot.debrief?.verdict).toBe("supported");
    expect(run.finalSnapshot.completion?.verdict).toBe("supported");
    expect(run.finalSnapshot.completion?.targetMet).toBe(true);
    expect(run.finalSnapshot.completion?.observationsCaptured).toBe(3);
    expect(run.finalSnapshot.completion?.claimAttempts).toBe(1);
  });

  it("measures every world the brief names, and nothing else", () => {
    expect(run.finalSnapshot.evidence.map((record) => record.bodyId)).toEqual([
      MOON_ID,
      MARS_ID,
      VENUS_ID,
    ]);
    // The comparison is what a claim is checked against, and it only appears
    // because the learner asked for it.
    expect(run.finalSnapshot.comparison.map((finding) => finding.attributeId)).toEqual([
      "meanRadius",
    ]);
  });

  it("replays identically, byte for byte", () => {
    const again = runMissionTrace({
      steps: trace,
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
      missions: MISSIONS,
    });
    expect(again.serialized).toBe(run.serialized);
    expect(again.digest).toBe(run.digest);
  });

  it("pins a golden digest for the whole path", () => {
    // Recompute deliberately. This covers the step log and the final snapshot, so
    // it moves when the state machine, the claim contract, or a measured value
    // changes — which is the point of a trace over a snapshot.
    //
    // PS-09 moved it from `aa1a94c8`: `MissionDebrief` gained
    // `missingRequiredEvidence`, which is empty on this path because all three
    // required worlds are cited (D-40).
    expect(run.digest).toBe("8ae54346");
  });
});

describe("golden trace: a supported claim can still miss the mission's target", () => {
  // The F-1 case PS-09 found, pinned at the content level. The guided mission's
  // claim target names all three worlds, so this run — Mars and Venus measured,
  // captured, cited, and correctly ordered — reaches `complete` with a supported
  // claim and a target that is NOT met, because the Moon was never cited (D-40).
  // Before that decision the same run reported `targetMet: true`.
  const trace: readonly TraceStep[] = [
    {
      note: "load the guided mission",
      intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
      expect: "applied",
    },
    { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
    ...surveySteps(MARS_ID, "radiusSounder", "meanRadius"),
    ...surveySteps(VENUS_ID, "radiusSounder", "meanRadius"),
    { note: "compare the two worlds", intent: { kind: "compare" }, expect: "applied" },
    {
      note: "draft the correct relation, citing the two worlds it compares",
      intent: (snapshot) => ({
        kind: "draftClaim",
        draft: {
          attributeId: "meanRadius",
          subject: VENUS_ID,
          relation: "largerThan",
          object: MARS_ID,
          citedEvidenceIds: citedEvidenceIds(snapshot, [
            [VENUS_ID, "meanRadius"],
            [MARS_ID, "meanRadius"],
          ]),
        },
      }),
      expect: "applied",
    },
    { note: "submit the claim", intent: { kind: "submitClaim" }, expect: "applied" },
    { note: "open the debrief", intent: { kind: "openDebrief" }, expect: "applied" },
    { note: "complete the mission", intent: { kind: "completeMission" }, expect: "applied" },
  ];

  const run = runMissionTrace({
    steps: trace,
    bodies: PLANETARY_BODIES,
    seed: GUIDED_SEED,
    missions: MISSIONS,
  });

  it("completes on a supported claim whose mission target is still short", () => {
    expect(run.rejections).toEqual([]);
    expect(run.finalPhase).toBe("complete");
    expect(run.finalSnapshot.evaluation?.verdict).toBe("supported");
    expect(run.finalSnapshot.completion?.verdict).toBe("supported");
    // The claim is supported; the mission is not finished with its own evidence.
    expect(run.finalSnapshot.completion?.targetMet).toBe(false);
    expect(run.finalSnapshot.completion?.observationsCaptured).toBe(2);
    expect(run.finalSnapshot.completion?.observationsRequired).toBe(3);
  });

  it("names the required observation the claim does not cite, and stays revisable", () => {
    expect(run.finalSnapshot.debrief?.missingRequiredEvidence).toEqual([
      `${MOON_ID}.meanRadius`,
    ]);
    // The evaluator raises no citation problem, which is why a separate reader of
    // the mission's own requirement was needed: both cited worlds are covered.
    expect(run.finalSnapshot.debrief?.citationProblems).toEqual([]);
    // Nothing is a dead end and nothing is punitive: revision is still offered.
    expect(forwardIntentsIn("complete")).toContain("reviseClaim");
  });
});

describe("golden trace: measuring both worlds is not the same as citing both", () => {
  const trace: readonly TraceStep[] = [
    {
      note: "load the guided mission",
      intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
      expect: "applied",
    },
    { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
    // Both worlds are measured and captured. The notebook is not the problem.
    ...surveySteps(MARS_ID, "radiusSounder", "meanRadius"),
    ...surveySteps(VENUS_ID, "radiusSounder", "meanRadius"),
    { note: "compare the worlds", intent: { kind: "compare" }, expect: "applied" },
    {
      note: "draft the correct relation but cite only one world",
      intent: (snapshot) => ({
        kind: "draftClaim",
        draft: {
          attributeId: "meanRadius",
          subject: VENUS_ID,
          relation: "largerThan",
          object: MARS_ID,
          citedEvidenceIds: citedEvidenceIds(snapshot, [[VENUS_ID, "meanRadius"]]),
        },
      }),
      expect: "applied",
    },
    { note: "submit the claim", intent: { kind: "submitClaim" }, expect: "applied" },
  ];

  const run = runMissionTrace({ steps: trace, bodies: PLANETARY_BODIES, seed: GUIDED_SEED });

  it("refuses to count the claim, even though the relation is right", () => {
    const evaluation = run.finalSnapshot.evaluation;
    expect(evaluation?.verdict).toBe("insufficient-evidence");
    expect(evaluation?.dimensions.citationCoverage).toBe(false);
    expect(evaluation?.citationProblems.join(" ")).toContain("second world");
  });

  it("keeps the uncited measurement in the notebook rather than discarding it", () => {
    // The learner is meant to revise, not to start over: the fix is to cite what
    // was already measured. Two records are kept, and only the cited one is
    // reported as compared — an uncited world is not quietly included in the
    // arithmetic just because it happens to be in the notebook.
    expect(run.finalSnapshot.evidence).toHaveLength(2);
    expect(run.finalSnapshot.evaluation?.comparedValues.map((entry) => entry.bodyId)).toEqual([
      VENUS_ID,
    ]);
  });

  it("lets the learner recover to a supported claim within the same notebook", () => {
    // The recovery path PS-08 supports: revise, redraft citing both worlds from the
    // notebook that already answers the question, submit. No reading is retaken and
    // no measurement is lost (D-36).
    const revised = runMissionTrace({
      steps: [
        {
          note: "load the guided mission",
          intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
          expect: "applied",
        },
        { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
        ...surveySteps(MARS_ID, "radiusSounder", "meanRadius"),
        ...surveySteps(VENUS_ID, "radiusSounder", "meanRadius"),
        { note: "compare", intent: { kind: "compare" }, expect: "applied" },
        {
          note: "draft citing only one world",
          intent: (snapshot) => ({
            kind: "draftClaim",
            draft: {
              attributeId: "meanRadius",
              subject: VENUS_ID,
              relation: "largerThan",
              object: MARS_ID,
              citedEvidenceIds: citedEvidenceIds(snapshot, [[VENUS_ID, "meanRadius"]]),
            },
          }),
          expect: "applied",
        },
        { note: "submit", intent: { kind: "submitClaim" }, expect: "applied" },
        { note: "revise the claim", intent: { kind: "reviseClaim" }, expect: "applied" },
        {
          note: "redraft at once, citing both worlds from the existing notebook — no new reading",
          intent: (snapshot) => ({
            kind: "draftClaim",
            draft: {
              attributeId: "meanRadius",
              subject: VENUS_ID,
              relation: "largerThan",
              object: MARS_ID,
              citedEvidenceIds: citedEvidenceIds(snapshot, [
                [VENUS_ID, "meanRadius"],
                [MARS_ID, "meanRadius"],
              ]),
            },
          }),
          expect: "applied",
        },
        { note: "submit the revised claim", intent: { kind: "submitClaim" }, expect: "applied" },
      ],
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
    });

    expect(revised.finalSnapshot.evaluation?.verdict).toBe("supported");
    // Recovery cost no readings and lost no evidence: the notebook still holds exactly
    // the two worlds it held before, and the claim was submitted twice.
    expect(revised.finalSnapshot.evidence).toHaveLength(2);
    expect(revised.finalSnapshot.claimAttempts).toBe(2);
  });

  it("reopens the claim in place on revision, with no redundant reading", () => {
    // PS-08 closes STATUS constraint 7. Revision lands in `claimDrafting`, so a
    // learner who only failed to cite can redraft from the notebook immediately.
    const run = runMissionTrace({
      steps: [
        ...trace,
        { note: "revise the claim", intent: { kind: "reviseClaim" }, expect: "applied" },
        {
          note: "redraft the corrected citation straight away",
          intent: (snapshot) => ({
            kind: "draftClaim",
            draft: {
              attributeId: "meanRadius",
              subject: VENUS_ID,
              relation: "largerThan",
              object: MARS_ID,
              citedEvidenceIds: citedEvidenceIds(snapshot, [
                [VENUS_ID, "meanRadius"],
                [MARS_ID, "meanRadius"],
              ]),
            },
          }),
          expect: "applied",
        },
      ],
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
    });

    expect(run.finalPhase).toBe("claimDrafting");
    expect(run.rejections).toHaveLength(0);
    expect(run.finalSnapshot.evidence).toHaveLength(2);
    expect(run.finalSnapshot.claim?.citedEvidenceIds).toHaveLength(2);
  });
});

describe("golden trace: full citations do not rescue a wrong conclusion", () => {
  const trace: readonly TraceStep[] = [
    {
      note: "load the guided mission",
      intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
      expect: "applied",
    },
    { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
    ...GUIDED_SURVEY,
    { note: "compare the worlds", intent: { kind: "compare" }, expect: "applied" },
    {
      note: "draft the relation backwards, citing every measurement",
      intent: (snapshot) => ({
        kind: "draftClaim",
        draft: {
          attributeId: "meanRadius",
          subject: MARS_ID,
          relation: "largerThan",
          object: VENUS_ID,
          citedEvidenceIds: citedEvidenceIds(snapshot, GUIDED_SIZES_CLAIM_PAIRS),
        },
      }),
      expect: "applied",
    },
    { note: "submit the claim", intent: { kind: "submitClaim" }, expect: "applied" },
  ];

  const run = runMissionTrace({ steps: trace, bodies: PLANETARY_BODIES, seed: GUIDED_SEED });

  it("contradicts the claim on the learner's own numbers", () => {
    const evaluation = run.finalSnapshot.evaluation;
    expect(evaluation?.verdict).toBe("contradicted");
    expect(evaluation?.dimensions.citationCoverage).toBe(true);
    expect(evaluation?.dimensions.reasoningConsistency).toBe(false);
    // The evaluated claim is not the mission's target, which is what makes this
    // trace a probe of the claim contract rather than of the mission.
    expect(evaluation?.comparedValues.map((entry) => entry.bodyId)).toEqual([MARS_ID, VENUS_ID]);
  });
});

describe("golden trace: the LO-3 proportion claim needs the radii", () => {
  const RELIEF_SEED = 1_026_002;

  const fullSurvey: readonly TraceStep[] = [
    {
      note: "load the independent relief mission",
      intent: { kind: "loadMission", missionId: RELIEF_MISSION_ID, seed: RELIEF_SEED },
      expect: "applied",
    },
    { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
    ...surveySteps(MARS_ID, "altimeter", "surfaceRelief"),
    ...surveySteps(MARS_ID, "radiusSounder", "meanRadius"),
    ...surveySteps(VENUS_ID, "altimeter", "surfaceRelief"),
    ...surveySteps(VENUS_ID, "radiusSounder", "meanRadius"),
    { note: "compare the worlds", intent: { kind: "compare" }, expect: "applied" },
  ];

  const proportionalDraft = (snapshot: MissionSnapshot, citeRadii: boolean) => ({
    kind: "draftClaim" as const,
    draft: {
      attributeId: "surfaceRelief" as const,
      basis: "proportionOfRadius" as const,
      subject: MARS_ID,
      relation: "largerThan" as const,
      object: VENUS_ID,
      citedEvidenceIds: citedEvidenceIds(
        snapshot,
        citeRadii
          ? [
              [MARS_ID, "surfaceRelief"],
              [MARS_ID, "meanRadius"],
              [VENUS_ID, "surfaceRelief"],
              [VENUS_ID, "meanRadius"],
            ]
          : [
              [MARS_ID, "surfaceRelief"],
              [VENUS_ID, "surfaceRelief"],
            ],
      ),
    },
  });

  it("supports the proportional reading when both radii are cited", () => {
    const run = runMissionTrace({
      steps: [
        ...fullSurvey,
        { note: "draft the proportional claim with both radii", intent: (s) => proportionalDraft(s, true), expect: "applied" },
        { note: "submit", intent: { kind: "submitClaim" }, expect: "applied" },
      ],
      bodies: PLANETARY_BODIES,
      seed: RELIEF_SEED,
    });
    expect(run.finalSnapshot.evaluation?.verdict).toBe("supported");
  });

  it("refuses the same claim when the radii are not cited", () => {
    // The whole point of pinning `basis`: Mars wins the raw comparison too, so a
    // relief-only citation would otherwise be graded as the LO-3 insight.
    const run = runMissionTrace({
      steps: [
        ...fullSurvey,
        { note: "draft the proportional claim citing relief only", intent: (s) => proportionalDraft(s, false), expect: "applied" },
        { note: "submit", intent: { kind: "submitClaim" }, expect: "applied" },
      ],
      bodies: PLANETARY_BODIES,
      seed: RELIEF_SEED,
    });
    expect(run.finalSnapshot.evaluation?.verdict).toBe("insufficient-evidence");
    expect(run.finalSnapshot.evaluation?.dimensions.reasoningConsistency).toBe(false);
  });

  // PS-08's follow-through: the proportional mission reaches `complete` the same way
  // the guided one does, and the debrief reports the ratio the claim was made under
  // rather than the raw relief. Digests are pinned because a trace is only a golden
  // fixture if a change to the state machine, the claim contract, or a measured
  // value shows up as a diff here.
  const RELIEF_END_TO_END: readonly TraceStep[] = [
    ...fullSurvey,
    {
      note: "draft the proportional claim with both radii",
      intent: (s) => proportionalDraft(s, true),
      expect: "applied",
    },
    { note: "submit", intent: { kind: "submitClaim" }, expect: "applied" },
    { note: "open the debrief", intent: { kind: "openDebrief" }, expect: "applied" },
    { note: "complete the mission", intent: { kind: "completeMission" }, expect: "applied" },
  ];

  const relief = runMissionTrace({
    steps: RELIEF_END_TO_END,
    bodies: PLANETARY_BODIES,
    seed: RELIEF_SEED,
    missions: MISSIONS,
  });

  it("runs the proportional mission through to debrief and completion", () => {
    expect(relief.steps).toHaveLength(RELIEF_END_TO_END.length);
    expect(relief.rejections).toEqual([]);
    expect(relief.finalPhase).toBe("complete");

    const debrief = relief.finalSnapshot.debrief;
    expect(debrief?.basis).toBe("proportionOfRadius");
    expect(debrief?.verdict).toBe("supported");
    expect(debrief?.facts).toHaveLength(3);
    // The debrief quotes the two worlds the claim compared, and names relief *and*
    // radius for each as what carries the verdict: four cited observations, none of
    // them refuting, and no misconception attached to a claim that was right.
    expect(debrief?.comparedValues.map((value) => value.bodyId)).toEqual([MARS_ID, VENUS_ID]);
    expect(debrief?.supportingEvidenceIds).toHaveLength(4);
    expect(debrief?.refutingEvidenceIds).toEqual([]);
    expect(debrief?.misconception).toBeNull();

    const completion = relief.finalSnapshot.completion;
    expect(completion?.targetMet).toBe(true);
    expect(completion?.observationsRequired).toBe(4);
    expect(completion?.observationsCaptured).toBe(4);
    expect(completion?.evidenceCount).toBe(4);
    expect(completion?.citationCount).toBe(4);
    expect(completion?.claimAttempts).toBe(1);
    expect(completion?.hintsUsed).toBe(0);
  });

  it("replays the proportional path identically and pins its digest", () => {
    const again = runMissionTrace({
      steps: RELIEF_END_TO_END,
      bodies: PLANETARY_BODIES,
      seed: RELIEF_SEED,
      missions: MISSIONS,
    });
    expect(again.serialized).toBe(relief.serialized);
    expect(again.digest).toBe(relief.digest);
    expect(relief.digest).toBe("7f3399ff");
  });
});

describe("golden trace: the orbital-distance mission runs end to end", () => {
  const DISTANCE_SEED = 1_026_003;

  const DISTANCE_END_TO_END: readonly TraceStep[] = [
    {
      note: "load the independent orbital-distance mission",
      intent: { kind: "loadMission", missionId: DISTANCE_MISSION_ID, seed: DISTANCE_SEED },
      expect: "applied",
    },
    { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
    ...surveySteps(VENUS_ID, "orbitalRangefinder", "orbitalRadius"),
    ...surveySteps(MARS_ID, "orbitalRangefinder", "orbitalRadius"),
    { note: "compare the two orbits", intent: { kind: "compare" }, expect: "applied" },
    // A hint is content, not a shortcut (D-38): asking for one changes the record,
    // not the science, so the verdict is unchanged and the count is carried into
    // both the debrief and the completion summary.
    { note: "ask for the first hint", intent: { kind: "requestHint" }, expect: "applied" },
    {
      note: "claim that Mars orbits farther out than Venus, citing both readings",
      intent: (snapshot) => ({
        kind: "draftClaim",
        draft: {
          attributeId: "orbitalRadius",
          subject: MARS_ID,
          relation: "largerThan",
          object: VENUS_ID,
          citedEvidenceIds: citedEvidenceIds(snapshot, [
            [MARS_ID, "orbitalRadius"],
            [VENUS_ID, "orbitalRadius"],
          ]),
        },
      }),
      expect: "applied",
    },
    { note: "submit", intent: { kind: "submitClaim" }, expect: "applied" },
    { note: "open the debrief", intent: { kind: "openDebrief" }, expect: "applied" },
    { note: "complete the mission", intent: { kind: "completeMission" }, expect: "applied" },
  ];

  const run = runMissionTrace({
    steps: DISTANCE_END_TO_END,
    bodies: PLANETARY_BODIES,
    seed: DISTANCE_SEED,
    missions: MISSIONS,
  });

  it("records a step for every intent and refuses nothing on a legal path", () => {
    expect(run.steps).toHaveLength(DISTANCE_END_TO_END.length);
    expect(run.steps.map((step) => step.kind)).toEqual(DISTANCE_END_TO_END.map((step) => step.expect));
    expect(run.rejections).toEqual([]);
  });

  it("supports the distance claim and finishes the mission on it", () => {
    expect(run.finalPhase).toBe("complete");
    expect(run.finalSnapshot.evaluation?.verdict).toBe("supported");
    expect(run.finalSnapshot.debrief?.attributeId).toBe("orbitalRadius");
    expect(run.finalSnapshot.debrief?.comparedValues.map((value) => value.bodyId)).toEqual([
      MARS_ID,
      VENUS_ID,
    ]);
    expect(run.finalSnapshot.completion?.targetMet).toBe(true);
    expect(run.finalSnapshot.completion?.claimAttempts).toBe(1);
  });

  it("counts the mission's own required observations", () => {
    // The distance mission needs two readings, not the guided mission's three, and
    // the completion summary has to take that from the mission rather than a
    // constant in the domain.
    const distance = MISSIONS.find((mission) => mission.id === DISTANCE_MISSION_ID);
    expect(distance?.requiredObservations).toHaveLength(2);
    expect(run.finalSnapshot.completion?.observationsRequired).toBe(
      distance?.requiredObservations.length,
    );
    expect(run.finalSnapshot.completion?.observationsCaptured).toBe(2);
    expect(run.finalSnapshot.evidence.map((record) => record.bodyId)).toEqual([VENUS_ID, MARS_ID]);
    expect(run.finalSnapshot.comparison.map((finding) => finding.attributeId)).toEqual([
      "orbitalRadius",
    ]);
  });

  it("carries the hint into the debrief without changing the verdict", () => {
    expect(run.finalSnapshot.hintsUsed).toBe(1);
    expect(run.finalSnapshot.debrief?.hintsUsed).toBe(1);
    expect(run.finalSnapshot.completion?.hintsUsed).toBe(1);
    expect(run.finalSnapshot.debrief?.verdict).toBe("supported");
    expect(run.finalSnapshot.debrief?.misconception).toBeNull();
  });

  it("replays identically and pins a golden digest", () => {
    const again = runMissionTrace({
      steps: DISTANCE_END_TO_END,
      bodies: PLANETARY_BODIES,
      seed: DISTANCE_SEED,
      missions: MISSIONS,
    });
    expect(again.serialized).toBe(run.serialized);
    expect(again.digest).toBe(run.digest);
    expect(run.digest).toBe("b81246d8");
  });
});

describe("golden trace: the domain refuses illegal actions out loud", () => {
  it("rejects capturing evidence that was never measured, with a reason", () => {
    const run = runMissionTrace({
      steps: [
        {
          note: "load the variant mission",
          intent: { kind: "loadMission", missionId: VARIANT_MISSION_ID, seed: 1_026_011 },
          expect: "applied",
        },
        {
          note: "try to capture before any measurement exists",
          intent: { kind: "captureEvidence" },
          expect: "rejected",
        },
        {
          note: "select a world",
          intent: { kind: "selectTarget", bodyId: TITAN_ID },
          expect: "applied",
        },
        {
          note: "try to measure with no instrument selected",
          intent: { kind: "measure", attributeId: "meanRadius" },
          expect: "rejected",
        },
        {
          note: "choose the instrument",
          intent: { kind: "selectInstrument", instrumentId: "radiusSounder" },
          expect: "applied",
        },
        {
          note: "try to capture before measuring, now that capture is legal",
          intent: { kind: "captureEvidence" },
          expect: "rejected",
        },
      ],
      bodies: PLANETARY_BODIES,
      seed: 1_026_011,
    });

    // Three refusals, each one explaining itself in the learner's terms rather
    // than silently doing nothing: an action out of phase, an action without a
    // target selection, and an empty notebook.
    expect(run.steps.map((step) => step.kind)).toEqual([
      "applied",
      "rejected",
      "applied",
      "rejected",
      "applied",
      "rejected",
    ]);
    expect(run.rejections).toHaveLength(3);
    expect(run.rejections[0]).toContain("not available while the mission is in");
    expect(run.rejections[1]).toContain("Choose a target world and an instrument");
    expect(run.rejections[2]).toContain("no measurement to capture");
    // A refusal changes nothing: no evidence, and it is not counted as progress —
    // three intents were accepted, three were not.
    expect(run.finalSnapshot.evidence).toEqual([]);
    expect(run.revisions).toBe(3);
  });

  it("cannot be completed by skipping straight to a claim", () => {
    const run = runMissionTrace({
      steps: [
        {
          note: "load the guided mission",
          intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
          expect: "applied",
        },
        { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
        {
          note: "draft the right answer immediately",
          intent: (snapshot) => ({
            kind: "draftClaim",
            draft: {
              attributeId: "meanRadius",
              subject: VENUS_ID,
              relation: "largerThan",
              object: MARS_ID,
              citedEvidenceIds: citedEvidenceIds(snapshot, GUIDED_SIZES_CLAIM_PAIRS),
            },
          }),
          expect: "rejected",
        },
      ],
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
    });

    // There is no claim to cite a measurement for yet, and the domain says so
    // rather than accepting an answer with nothing behind it.
    expect(run.steps[2]?.kind).toBe("rejected");
    expect(run.finalSnapshot.claim).toBeNull();
    expect(run.finalSnapshot.evaluation).toBeNull();
  });
});

describe("the state machine's current boundary", () => {
  it("reaches no phase without a forward move, on every recorded trace", () => {
    const run = runMissionTrace({
      steps: [
        {
          note: "load the guided mission",
          intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
          expect: "applied",
        },
        { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
        ...GUIDED_SURVEY,
        { note: "compare", intent: { kind: "compare" }, expect: "applied" },
      ],
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
    });

    const deadEnds = run.steps
      .map((step) => step.phase)
      .filter((phase) => forwardIntentsIn(phase).length === 0);
    expect(deadEnds).toEqual([]);
  });

  it("runs the frozen loop end to end, from brief to complete", () => {
    // PS-08 closed the boundary this test used to pin. The whole loop is reachable
    // now, and every phase it passes through still has a forward move, so no step of
    // the frozen path is a dead end.
    const steps: readonly TraceStep[] = [
      {
        note: "load the guided mission",
        intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED },
        expect: "applied",
      },
      { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
      ...GUIDED_SURVEY,
      { note: "compare", intent: { kind: "compare" }, expect: "applied" },
      {
        note: "draft",
        intent: (snapshot) => ({
          kind: "draftClaim",
          draft: {
            attributeId: "meanRadius",
            subject: VENUS_ID,
            relation: "largerThan",
            object: MARS_ID,
            citedEvidenceIds: citedEvidenceIds(snapshot, GUIDED_SIZES_CLAIM_PAIRS),
          },
        }),
        expect: "applied",
      },
      { note: "submit", intent: { kind: "submitClaim" }, expect: "applied" },
      { note: "open the debrief", intent: { kind: "openDebrief" }, expect: "applied" },
      { note: "complete", intent: { kind: "completeMission" }, expect: "applied" },
    ];
    const run = runMissionTrace({
      steps,
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
      missions: MISSIONS,
    });

    const phasesSeen = [...new Set(run.steps.map((step) => step.phase))];
    expect(phasesSeen).toEqual([
      "briefing",
      "targetSelection",
      "instrumentSelection",
      "observing",
      "evidenceCapture",
      "comparison",
      "claimDrafting",
      "claimSubmitted",
      "debrief",
      "complete",
    ]);

    const deadEnds = phasesSeen.filter((phase) => forwardIntentsIn(phase).length === 0);
    expect(deadEnds).toEqual([]);
    expect(forwardIntentsIn("claimSubmitted")).toContain("reviseClaim");
    expect(forwardIntentsIn("debrief")).toContain("completeMission");
    expect(forwardIntentsIn("complete")).toContain("reviseClaim");
  });

  it("takes every required observation in a trace from the mission's own list", () => {
    // A trace that measures something the mission does not require would prove the
    // state machine works while proving nothing about the shipped completion path.
    const guided = MISSIONS.find((mission) => mission.id === GUIDED_MISSION_ID);
    const required = new Set(
      guided?.requiredObservations.map((observation) => observation.bodyId) ?? [],
    );
    expect(required).toEqual(new Set(GUIDED_WORLDS));

    const surveyed = runMissionTrace({
      steps: [
        { note: "load the guided mission", intent: { kind: "loadMission", missionId: GUIDED_MISSION_ID, seed: GUIDED_SEED }, expect: "applied" },
        { note: "read the brief", intent: { kind: "beginBriefing" }, expect: "applied" },
        ...GUIDED_SURVEY,
      ],
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
    });

    for (const bodyId of GUIDED_WORLDS) {
      expect(citedEvidenceId(surveyed.finalSnapshot, bodyId, "meanRadius")).toBeTypeOf("string");
    }
  });
});
