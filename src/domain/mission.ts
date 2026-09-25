/**
 * Mission state model.
 *
 * Pure TypeScript transitions over a discriminated union — no state-machine
 * library (docs/TECHNOLOGY_DECISIONS.md §4). The phase list mirrors the learner
 * path in docs/UX_USER_FLOW.md §2-§3.
 *
 * Contractual properties enforced here:
 *  - every transition is explicit and testable;
 *  - every snapshot is JSON-serializable;
 *  - no phase is a dead end (each has at least one legal forward action), and a
 *    blocked action explains itself instead of failing silently;
 *  - domain transitions never consult renderer backend or quality tier, which is
 *    what makes gameplay invariant across them (docs/TECHNICAL_DESIGN.md §6-§7).
 *
 * PS-08 (GAME-372) owns the complete mission engine. PS-02 establishes the seam
 * and the invariants that engine must preserve.
 */

import { attributeDefinition, type AttributeId } from "./attributes";
import type { BodyId, BodyRecord } from "./bodies";
import type { MissionDefinition } from "./catalog";
import { createClaim, evaluateClaim, type Claim, type ClaimDraft, type ClaimEvaluation } from "./claims";
import { compareEvidence, type ComparativeFinding } from "./comparison";
import {
  buildCompletionSummary,
  buildMissionDebrief,
  type CompletionSummary,
  type MissionDebrief,
} from "./debrief";
import { captureEvidence, type EvidenceRecord } from "./evidence";
import { instrumentDefinition, measure, type InstrumentId, type MeasurementOutcome } from "./measurement";
import type { Seed } from "./random";

export type MissionPhase =
  | "unloaded"
  | "briefing"
  | "targetSelection"
  | "instrumentSelection"
  | "observing"
  | "evidenceCapture"
  | "comparison"
  | "claimDrafting"
  | "claimSubmitted"
  | "debrief"
  | "complete";

export const MISSION_PHASES: readonly MissionPhase[] = [
  "unloaded",
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
];

/** Mission state. The single source of truth for what is true (docs/TECHNICAL_DESIGN.md §4.3a). */
export interface MissionSnapshot {
  readonly phase: MissionPhase;
  readonly missionId: string | null;
  readonly seed: Seed;
  readonly selectedBodyId: BodyId | null;
  readonly selectedInstrumentId: InstrumentId | null;
  readonly lastMeasurement: MeasurementOutcome | null;
  readonly evidence: readonly EvidenceRecord[];
  readonly comparison: readonly ComparativeFinding[];
  readonly claim: Claim | null;
  readonly evaluation: ClaimEvaluation | null;
  /**
   * The debrief for the most recently submitted claim, once the learner opens it.
   * Content-driven and source-traceable; `null` until `openDebrief`.
   */
  readonly debrief: MissionDebrief | null;
  /**
   * The bounded completion summary, once the mission is finished. Counts and a
   * verdict only — no clock, no identity, no learner free text.
   */
  readonly completion: CompletionSummary | null;
  /** How many times a claim has been submitted, across revisions. */
  readonly claimAttempts: number;
  /** Monotonic count of applied intents; a stable, serializable revision marker. */
  readonly revision: number;
  /** How many hints have been requested. Hints never perform a required choice. */
  readonly hintsUsed: number;
}

export function initialMissionSnapshot(seed: Seed): MissionSnapshot {
  return {
    phase: "unloaded",
    missionId: null,
    seed,
    selectedBodyId: null,
    selectedInstrumentId: null,
    lastMeasurement: null,
    evidence: [],
    comparison: [],
    claim: null,
    evaluation: null,
    debrief: null,
    completion: null,
    claimAttempts: 0,
    revision: 0,
    hintsUsed: 0,
  };
}

export type MissionIntent =
  | { readonly kind: "loadMission"; readonly missionId: string; readonly seed: Seed }
  | { readonly kind: "beginBriefing" }
  | { readonly kind: "selectTarget"; readonly bodyId: BodyId }
  | { readonly kind: "selectInstrument"; readonly instrumentId: InstrumentId }
  | { readonly kind: "measure"; readonly attributeId: AttributeId }
  | { readonly kind: "captureEvidence" }
  | { readonly kind: "compare" }
  | { readonly kind: "draftClaim"; readonly draft: ClaimDraft }
  | { readonly kind: "citeEvidence"; readonly evidenceIds: readonly string[] }
  | { readonly kind: "submitClaim" }
  | { readonly kind: "openDebrief" }
  | { readonly kind: "completeMission" }
  | { readonly kind: "reviseClaim" }
  | { readonly kind: "requestHint" }
  | { readonly kind: "reset" };

export type MissionIntentKind = MissionIntent["kind"];

/**
 * Everything a transition needs that is not itself domain state.
 *
 * `missions` is dependency injection, not content coupling: the domain must not
 * import `src/content/`, so the authored mission definitions are handed in by the
 * caller. A transition that needs mission wording (the debrief and the completion
 * summary) reports an honest rejection when the caller supplied none.
 */
export interface MissionContext {
  readonly bodies: readonly BodyRecord[];
  readonly missions?: readonly MissionDefinition[];
}

export type IntentResult =
  | {
      readonly kind: "applied";
      readonly snapshot: MissionSnapshot;
      /** Short, learner-facing confirmation of what changed. */
      readonly fact: string;
    }
  | {
      readonly kind: "rejected";
      readonly snapshot: MissionSnapshot;
      /** Why the action was not legal, in learner-facing language. */
      readonly reason: string;
    };

/**
 * Which phases each intent is legal in.
 *
 * Kept as data so legality is inspectable and directly testable rather than
 * scattered through conditionals. Exported because GAME-372's acceptance requires a
 * pure test over *every* legal/illegal transition: the test sweeps all intents
 * against this table, so a transition that quietly disagrees with its declaration
 * fails rather than being discovered in a playtest.
 */
export const LEGAL_PHASES: Readonly<Record<MissionIntentKind, readonly MissionPhase[]>> = {
  loadMission: ["unloaded", "complete"],
  beginBriefing: ["unloaded", "briefing"],
  // `claimDrafting` and `debrief` are survey phases too: a learner who needs one
  // more world before revising can go and get it without restarting
  // (docs/UX_USER_FLOW.md step 11 — "return to measurement").
  selectTarget: [
    "briefing",
    "targetSelection",
    "instrumentSelection",
    "observing",
    "evidenceCapture",
    "comparison",
    "claimDrafting",
    "debrief",
  ],
  selectInstrument: ["targetSelection", "instrumentSelection", "observing", "comparison", "claimDrafting"],
  measure: ["instrumentSelection", "observing", "comparison", "claimDrafting", "debrief"],
  captureEvidence: ["observing", "evidenceCapture"],
  compare: ["evidenceCapture", "comparison", "claimDrafting"],
  draftClaim: ["comparison", "claimDrafting", "debrief"],
  citeEvidence: ["claimDrafting"],
  submitClaim: ["claimDrafting"],
  openDebrief: ["claimSubmitted"],
  completeMission: ["debrief"],
  reviseClaim: ["claimSubmitted", "debrief", "complete"],
  requestHint: MISSION_PHASES,
  reset: MISSION_PHASES,
};

function rejection(snapshot: MissionSnapshot, reason: string): IntentResult {
  return { kind: "rejected", snapshot, reason };
}

function accept(snapshot: MissionSnapshot, patch: Partial<MissionSnapshot>, fact: string): IntentResult {
  return {
    kind: "applied",
    snapshot: { ...snapshot, ...patch, revision: snapshot.revision + 1 },
    fact,
  };
}

/** The loaded mission definition, when the caller supplied the catalogue. */
function missionFor(snapshot: MissionSnapshot, context: MissionContext): MissionDefinition | null {
  if (!snapshot.missionId) return null;
  return context.missions?.find((mission) => mission.id === snapshot.missionId) ?? null;
}

/** The verdict as a learner-facing word, used by the debrief transition's fact. */
function verdictWord(verdict: ClaimEvaluation["verdict"]): string {
  switch (verdict) {
    case "supported":
      return "Supported";
    case "contradicted":
      return "Contradicted";
    case "insufficient-evidence":
      return "Not yet checkable";
    default: {
      const unreachable: never = verdict;
      return unreachable;
    }
  }
}

/**
 * Apply an intent.
 *
 * Pure: the same snapshot, intent, and context always produce the same result.
 * An illegal intent returns an unchanged snapshot plus a learner-facing reason —
 * never a silent no-op, and never a thrown error the learner has to decode.
 */
export function applyIntent(
  snapshot: MissionSnapshot,
  intent: MissionIntent,
  context: MissionContext,
): IntentResult {
  const legal = LEGAL_PHASES[intent.kind];
  if (!legal.includes(snapshot.phase)) {
    return rejection(
      snapshot,
      `That action is not available while the mission is in “${snapshot.phase}”.`,
    );
  }

  switch (intent.kind) {
    case "reset":
      return accept(snapshot, initialMissionSnapshot(snapshot.seed), "Mission reset.");

    case "requestHint":
      return accept(
        snapshot,
        { hintsUsed: snapshot.hintsUsed + 1 },
        "Hint requested. Hints point at what to look at next; they never make a scientific choice for you.",
      );

    case "loadMission":
      return accept(
        { ...initialMissionSnapshot(intent.seed), phase: "briefing" },
        { missionId: intent.missionId },
        "Mission loaded. Read the brief, then choose a world to survey.",
      );

    case "beginBriefing":
      return accept(snapshot, { phase: "targetSelection" }, "Choose a world to survey.");

    case "selectTarget": {
      const body = context.bodies.find((candidate) => candidate.id === intent.bodyId);
      if (!body) {
        return rejection(snapshot, "That world is not in this survey's catalogue.");
      }
      return accept(
        snapshot,
        { selectedBodyId: body.id, phase: "instrumentSelection", selectedInstrumentId: null, lastMeasurement: null },
        `Target set to ${body.displayName}. Choose the instrument that answers your question.`,
      );
    }

    case "selectInstrument": {
      const instrument = instrumentDefinition(intent.instrumentId);
      if (!instrument) {
        return rejection(snapshot, "That instrument is not carried by this probe.");
      }
      return accept(
        snapshot,
        { selectedInstrumentId: instrument.id, phase: "observing", lastMeasurement: null },
        `${instrument.label} selected. Its purpose: ${instrument.purpose}`,
      );
    }

    case "measure": {
      if (!snapshot.selectedBodyId || !snapshot.selectedInstrumentId) {
        return rejection(snapshot, "Choose a target world and an instrument before measuring.");
      }
      const outcome = measure(
        {
          instrumentId: snapshot.selectedInstrumentId,
          bodyId: snapshot.selectedBodyId,
          attributeId: intent.attributeId,
          seed: snapshot.seed,
        },
        context.bodies,
      );
      if (outcome.kind === "unavailable") {
        // Honest failure: the snapshot records that the measurement was attempted
        // and unavailable, so the UI can explain the gap rather than show a blank.
        return accept(
          snapshot,
          { lastMeasurement: outcome, phase: "observing" },
          outcome.explanation,
        );
      }
      return accept(
        snapshot,
        { lastMeasurement: outcome, phase: "evidenceCapture" },
        `Measured ${attributeDefinition(intent.attributeId).label.toLowerCase()}. Capture it to keep it as evidence.`,
      );
    }

    case "captureEvidence": {
      if (!snapshot.lastMeasurement) {
        return rejection(snapshot, "There is no measurement to capture yet.");
      }
      const result = captureEvidence(snapshot.evidence, snapshot.lastMeasurement);
      if (result.kind === "rejected") {
        return rejection(
          snapshot,
          result.rejection.kind === "already-captured"
            ? "That observation is already in the notebook."
            : result.rejection.explanation,
        );
      }
      return accept(
        snapshot,
        { phase: "comparison", lastMeasurement: null, evidence: result.records },
        "Evidence captured. Compare worlds before making a claim.",
      );
    }

    case "compare": {
      const findings = compareEvidence(snapshot.evidence);
      if (findings.length === 0) {
        return rejection(
          snapshot,
          "A comparison needs measurements of the same property from at least two worlds.",
        );
      }
      const summary = findings
        .map((finding) => `${attributeDefinition(finding.attributeId).label} across ${finding.entries.length} worlds`)
        .join("; ");
      return accept(
        snapshot,
        { comparison: findings, phase: "claimDrafting" },
        `Comparison ready: ${summary}.`,
      );
    }

    case "draftClaim":
      return accept(
        snapshot,
        {
          claim: createClaim(intent.draft),
          phase: "claimDrafting",
          // A new draft invalidates any previous verdict, debrief, or completion: a
          // stale debrief must never be readable as this claim's.
          evaluation: null,
          debrief: null,
          completion: null,
        },
        "Claim drafted. Cite the observations behind it before submitting.",
      );

    case "citeEvidence": {
      if (!snapshot.claim) {
        return rejection(snapshot, "Draft a claim before attaching evidence to it.");
      }
      const known = new Set(snapshot.evidence.map((record) => record.id));
      const unknown = intent.evidenceIds.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        return rejection(
          snapshot,
          `${unknown.length} cited observation${
            unknown.length === 1 ? " is" : "s are"
          } not in the notebook, so it cannot support the claim.`,
        );
      }
      const claim = createClaim({
        attributeId: snapshot.claim.attributeId,
        basis: snapshot.claim.basis,
        subject: snapshot.claim.subject,
        relation: snapshot.claim.relation,
        object: snapshot.claim.object,
        citedEvidenceIds: [...intent.evidenceIds],
      });
      const count = claim.citedEvidenceIds.length;
      return accept(
        snapshot,
        { claim, evaluation: null, debrief: null, completion: null },
        count === 0
          ? "Citation cleared. A claim with no cited evidence cannot be supported."
          : `Claim now cites ${count} observation${count === 1 ? "" : "s"}. Submit it when the citation is complete.`,
      );
    }

    case "submitClaim": {
      if (!snapshot.claim) {
        return rejection(snapshot, "Draft a claim before submitting it.");
      }
      const evaluation = evaluateClaim(snapshot.claim, snapshot.evidence);
      return accept(
        snapshot,
        {
          evaluation,
          phase: "claimSubmitted",
          claimAttempts: snapshot.claimAttempts + 1,
          debrief: null,
          completion: null,
        },
        evaluation.explanation,
      );
    }

    case "openDebrief": {
      if (!snapshot.claim || !snapshot.evaluation) {
        return rejection(snapshot, "Submit a claim before opening the debrief.");
      }
      const mission = missionFor(snapshot, context);
      if (!mission) {
        return rejection(
          snapshot,
          "The mission's own debrief facts are not loaded, so no debrief can be built.",
        );
      }
      const debrief = buildMissionDebrief({
        mission,
        claim: snapshot.claim,
        evaluation: snapshot.evaluation,
        records: snapshot.evidence,
        hintsUsed: snapshot.hintsUsed,
        claimAttempts: snapshot.claimAttempts,
      });
      return accept(
        snapshot,
        { debrief, phase: "debrief" },
        `${verdictWord(debrief.verdict)}. Read the debrief to see how the evidence backs this claim.`,
      );
    }

    case "completeMission": {
      if (!snapshot.debrief) {
        return rejection(snapshot, "Open the debrief before completing the mission.");
      }
      const mission = missionFor(snapshot, context);
      if (!mission) {
        return rejection(snapshot, "The mission definition is not loaded, so completion cannot be recorded.");
      }
      const completion = buildCompletionSummary({
        mission,
        missionId: mission.id,
        seed: snapshot.seed,
        evaluation: snapshot.evaluation,
        claim: snapshot.claim,
        evidence: snapshot.evidence,
        hintsUsed: snapshot.hintsUsed,
        claimAttempts: snapshot.claimAttempts,
      });
      return accept(
        snapshot,
        { completion, phase: "complete" },
        completion.targetMet
          ? "Mission complete. The claim target was supported by your own cited evidence."
          : "Mission complete. The debrief records what the evidence showed — you can still revise.",
      );
    }

    case "reviseClaim":
      // Revision is redraft-in-place (STATUS constraint 7): the notebook and the
      // claim are kept, and only the stale verdict is cleared, so fixing an
      // incomplete citation costs no extra instrument reading.
      return accept(
        snapshot,
        {
          phase: "claimDrafting",
          evaluation: null,
          debrief: null,
          completion: null,
        },
        "Claim reopened. Adjust the citation or collect more evidence, then submit again — nothing you measured was discarded.",
      );

    default: {
      const unreachable: never = intent;
      return rejection(snapshot, `Unhandled intent: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Phases in which at least one non-hint intent is legal. Used to prove no dead ends. */
export function forwardIntentsIn(phase: MissionPhase): readonly MissionIntentKind[] {
  return (Object.keys(LEGAL_PHASES) as MissionIntentKind[]).filter(
    (kind) => kind !== "requestHint" && kind !== "reset" && LEGAL_PHASES[kind].includes(phase),
  );
}
