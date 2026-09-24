/**
 * Golden mission traces: recorded intent sequences, replayed with no renderer.
 *
 * PS-04 requires "golden mission traces/fixtures independent of presentation",
 * and the acceptance criterion behind it is that mission fixtures are
 * deterministic and testable without Babylon or React. A trace is the strongest
 * form of that: a *whole learner path* — every intent, in order, including the
 * rejections — replayed through `applyIntent` and digested. If a domain change
 * alters any step, the digest moves.
 *
 * Three traces are recorded for the shipped content, and they are chosen to be a
 * set rather than a happy path:
 *
 *  - `GUIDED_HONEST_TRACE` — the guided mission played correctly, ending in
 *    `supported`;
 *  - `UNCITED_TRACE` — both worlds measured, but only one cited. Same data, worse
 *    citation, and the verdict must say so;
 *  - `CONTRADICTED_TRACE` — every required observation measured *and* cited, with
 *    the relation stated backwards. The verdict must follow the data rather than
 *    the confidence of the citation.
 *
 * The middle two are what make the first one mean anything: without them, a
 * `supported` verdict proves only that the machinery can say yes.
 *
 * ## A note on where a trace currently ends
 *
 * Every trace stops at `claimSubmitted`. No intent in `src/domain/mission.ts`
 * transitions into `debrief` or `complete`, so a mission whose claim is supported
 * nonetheless cannot reach a completed state today. That is PS-08's state machine
 * (scoring and debrief are explicitly its scope), and it is asserted rather than
 * papered over in `tests/content/missionTrace.test.ts` so the gap is a recorded
 * requirement rather than a surprise: a fixture that could not reach the end of
 * the frozen loop would otherwise be mistaken for a fixture that did.
 */

import { canonicalJson, digestOf } from "@/domain/canonical";
import type { BodyRecord } from "@/domain/bodies";
import { evidenceForAttribute, type EvidenceRecord } from "@/domain/evidence";
import {
  applyIntent,
  initialMissionSnapshot,
  type MissionIntent,
  type MissionPhase,
  type MissionSnapshot,
} from "@/domain/mission";
import type { Seed } from "@/domain/random";

/**
 * A step whose intent may be computed from the run so far.
 *
 * Citation ids are minted during the run — a record's id is the observation's
 * identity, not something an author can type — so a recorded claim has to look up
 * what the notebook actually holds. Making that a function of the snapshot keeps
 * the trace honest: it cannot cite an id that the run did not produce.
 */
export type TraceIntent = MissionIntent | ((snapshot: MissionSnapshot) => MissionIntent);

export interface TraceStep {
  /** Why this step is in the trace, in the author's words. */
  readonly note: string;
  readonly intent: TraceIntent;
  /**
   * Whether the learner's action is expected to be accepted. A rejection is a
   * recorded expectation, not a failure: an illegal action that is silently
   * ignored is a defect, so the trace asserts the refusal too.
   */
  readonly expect: "applied" | "rejected";
}

export interface TraceStepResult {
  readonly note: string;
  readonly kind: "applied" | "rejected";
  /** The learner-facing fact or reason produced by the transition. */
  readonly detail: string;
  readonly phase: MissionPhase;
  readonly revision: number;
}

export interface MissionTraceResult {
  readonly steps: readonly TraceStepResult[];
  readonly finalSnapshot: MissionSnapshot;
  readonly finalPhase: MissionPhase;
  readonly revisions: number;
  /** Learner-facing reasons, in order, for every step the domain refused. */
  readonly rejections: readonly string[];
  /** Canonical serialization of the whole path: step log plus final snapshot. */
  readonly serialized: string;
  readonly digest: string;
}

/** Replay a recorded trace. Pure: same steps, same bodies, same seed, same digest. */
export function runMissionTrace(input: {
  readonly steps: readonly TraceStep[];
  readonly bodies: readonly BodyRecord[];
  readonly seed: Seed;
}): MissionTraceResult {
  const context = { bodies: input.bodies };
  const results: TraceStepResult[] = [];
  const rejections: string[] = [];
  let snapshot = initialMissionSnapshot(input.seed);

  for (const step of input.steps) {
    const intent = typeof step.intent === "function" ? step.intent(snapshot) : step.intent;
    const outcome = applyIntent(snapshot, intent, context);
    snapshot = outcome.snapshot;

    const detail = outcome.kind === "applied" ? outcome.fact : outcome.reason;
    if (outcome.kind === "rejected") rejections.push(detail);

    results.push({
      note: step.note,
      kind: outcome.kind,
      detail,
      phase: snapshot.phase,
      revision: snapshot.revision,
    });
  }

  const serialized = canonicalJson({
    steps: results.map((result) => ({
      note: result.note,
      kind: result.kind,
      detail: result.detail,
      phase: result.phase,
    })),
    finalSnapshot: snapshot,
  });

  return {
    steps: results,
    finalSnapshot: snapshot,
    finalPhase: snapshot.phase,
    revisions: snapshot.revision,
    rejections,
    serialized,
    digest: digestOf(JSON.parse(serialized) as unknown),
  };
}

/** The notebook id for one world's measurement of one property, if it has one. */
export function citedEvidenceId(
  snapshot: MissionSnapshot,
  bodyId: string,
  attributeId: EvidenceRecord["attributeId"],
): string | undefined {
  return evidenceForAttribute(snapshot.evidence, attributeId).find(
    (record) => record.bodyId === bodyId,
  )?.id;
}

/**
 * Citation ids for a set of (world, property) pairs.
 *
 * Returns only what the notebook can defend. A trace that asks for a citation the
 * run never produced yields fewer ids, which is exactly how `UNCITED_TRACE` is
 * written: it omits a world deliberately, and the domain is expected to notice.
 */
export function citedEvidenceIds(
  snapshot: MissionSnapshot,
  pairs: readonly (readonly [string, EvidenceRecord["attributeId"]])[],
): readonly string[] {
  const ids: string[] = [];
  for (const [bodyId, attributeId] of pairs) {
    const id = citedEvidenceId(snapshot, bodyId, attributeId);
    if (id !== undefined) ids.push(id);
  }
  return ids;
}
