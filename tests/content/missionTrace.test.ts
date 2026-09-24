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
import { GUIDED_MISSION_ID, RELIEF_MISSION_ID, VARIANT_MISSION_ID } from "@/content/missions";
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
  instrumentId: "radiusSounder" | "altimeter",
  attributeId: "meanRadius" | "surfaceRelief",
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
  ];

  const run = runMissionTrace({ steps: trace, bodies: PLANETARY_BODIES, seed: GUIDED_SEED });

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
    const again = runMissionTrace({ steps: trace, bodies: PLANETARY_BODIES, seed: GUIDED_SEED });
    expect(again.serialized).toBe(run.serialized);
    expect(again.digest).toBe(run.digest);
  });

  it("pins a golden digest for the whole path", () => {
    // Recompute deliberately. This covers the step log and the final snapshot, so
    // it moves when the state machine, the claim contract, or a measured value
    // changes — which is the point of a trace over a snapshot.
    expect(run.digest).toBe("28f1af12");
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
    // The recovery path the state machine actually supports: revise, re-measure
    // (one instrument reading, no new survey), compare, draft citing both, submit.
    // Nothing is re-surveyed and no measurement is lost.
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
          note: "re-read one world, which is what revision currently requires",
          intent: { kind: "measure", attributeId: "meanRadius" },
          expect: "applied",
        },
        { note: "compare again", intent: { kind: "compare" }, expect: "applied" },
        {
          note: "draft again, citing both worlds from the existing notebook",
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
    // Recovery cost two extra readings and no lost evidence: the notebook still
    // holds exactly the two worlds it held before.
    expect(revised.finalSnapshot.evidence).toHaveLength(2);
  });

  it("records that revising a claim currently forces a redundant re-measurement", () => {
    // `reviseClaim` returns the learner to `observing`, where `draftClaim` is not
    // legal — so fixing a citation that was simply incomplete costs one extra
    // instrument reading and one extra comparison, even though the notebook already
    // holds everything the revised claim needs. This is a state-machine rough edge
    // and it belongs to PS-08, which owns revision and debrief; it is pinned here
    // so the guided-mission slice cannot ship with it unnoticed.
    const run = runMissionTrace({
      steps: [
        ...trace,
        { note: "revise the claim", intent: { kind: "reviseClaim" }, expect: "applied" },
        {
          note: "try to draft the corrected citation straight away",
          intent: { kind: "draftClaim", draft: { attributeId: "meanRadius", subject: VENUS_ID, relation: "largerThan", object: MARS_ID, citedEvidenceIds: [] } },
          expect: "rejected",
        },
      ],
      bodies: PLANETARY_BODIES,
      seed: GUIDED_SEED,
    });

    // The refusal proves the edge: the learner is back in the field, holding a
    // notebook that already answers the question, and cannot redraft from there.
    expect(run.finalPhase).toBe("observing");
    expect(run.rejections).toHaveLength(1);
    expect(run.rejections[0]).toContain("not available while the mission is in");
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

  it("records exactly how far a mission can get today", () => {
    // A trace can end with a supported claim and still be unable to finish the
    // mission: `debrief` and `complete` are modelled but nothing transitions into
    // them, so the frozen loop's last two steps are not implemented. That is PS-08's
    // scope (scoring and debrief), so it is pinned here rather than invented by a
    // content story — a content fixture that quietly stopped at a supported claim
    // would read as a complete loop.
    const phasesSeen = [
      ...new Set(
        runMissionTrace({
          steps: [
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
          ],
          bodies: PLANETARY_BODIES,
          seed: GUIDED_SEED,
        }).steps.map((step) => step.phase),
      ),
    ];

    expect(phasesSeen).toEqual([
      "briefing",
      "targetSelection",
      "instrumentSelection",
      "observing",
      "evidenceCapture",
      "comparison",
      "claimDrafting",
      "claimSubmitted",
    ]);
    expect(phasesSeen).not.toContain("debrief");
    expect(phasesSeen).not.toContain("complete");
    expect(forwardIntentsIn("claimSubmitted")).toContain("reviseClaim");
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
