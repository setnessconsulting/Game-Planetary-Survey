/**
 * The 11-step learner path, and its status derived from mission state.
 *
 * The steps are the frozen first-user path from docs/UX_USER_FLOW.md §2 — not an
 * invented progress bar. Status is DERIVED from the domain snapshot, so the UI
 * cannot show progress the domain does not agree with.
 *
 * PS-08 (GAME-372) owns the full mission engine; this derivation exists so the
 * foundation shell can prove the loop contract end to end without shipping
 * mission content, which GAME-364 forbids.
 */

import { markerGlyph } from "@/design/tokens";
import type { MissionSnapshot } from "@/domain/mission";

export type LoopStepId =
  | "load"
  | "briefing"
  | "chooseTarget"
  | "selectInstrument"
  | "observe"
  | "captureEvidence"
  | "compare"
  | "makeClaim"
  | "citeEvidence"
  | "debrief"
  | "reviseOrReplay";

export interface LoopStepDefinition {
  readonly id: LoopStepId;
  readonly index: number;
  readonly label: string;
  readonly description: string;
}

export const LOOP_STEPS: readonly LoopStepDefinition[] = [
  { id: "load", index: 1, label: "Load", description: "The workstation opens and the probe comes online." },
  { id: "briefing", index: 2, label: "Briefing", description: "Read what the survey is asking you to determine." },
  { id: "chooseTarget", index: 3, label: "Choose or approach a target", description: "Pick the world this question is about." },
  { id: "selectInstrument", index: 4, label: "Select an instrument", description: "Choose the instrument that can answer your question." },
  { id: "observe", index: 5, label: "Observe and measure", description: "Take the measurement and read the value with its unit." },
  { id: "captureEvidence", index: 6, label: "Capture evidence", description: "Keep the observation in your notebook. Keeping is a choice." },
  { id: "compare", index: 7, label: "Compare worlds", description: "Put at least two worlds' values side by side." },
  { id: "makeClaim", index: 8, label: "Make a claim", description: "State what the data says about the worlds' scale." },
  { id: "citeEvidence", index: 9, label: "Cite evidence", description: "Attach the observations that support the claim." },
  { id: "debrief", index: 10, label: "Receive debrief", description: "Find out how well the evidence backed the claim." },
  { id: "reviseOrReplay", index: 11, label: "Revise or replay", description: "Collect what you missed, or run a variant mission." },
];

export type LoopStepStatus = "done" | "active" | "pending";

export interface LoopStepState {
  readonly step: LoopStepDefinition;
  readonly status: LoopStepStatus;
  /** Short, honest note about why the step is in this state. */
  readonly note: string;
}

/**
 * Derive the status of every step from a mission snapshot.
 *
 * Pure. Nothing here consults the renderer, the quality tier, or the wall clock,
 * so the loop reads identically on WebGL2, on WebGPU, and at every quality tier.
 */
export function deriveLoopStatus(snapshot: MissionSnapshot): readonly LoopStepState[] {
  const measureDone = snapshot.lastMeasurement?.kind === "measured";
  const captured = snapshot.evidence.length > 0;
  const compared = snapshot.comparison.length > 0;
  const claimed = snapshot.claim !== null;
  const cited = (snapshot.claim?.citedEvidenceIds.length ?? 0) > 0;
  const evaluated = snapshot.evaluation !== null;
  const complete = snapshot.phase === "complete";

  const statusFor = (id: LoopStepId): { status: LoopStepStatus; note: string } => {
    switch (id) {
      case "load":
        return snapshot.missionId
          ? { status: "done", note: "Workstation online." }
          : {
              status: "active",
              note: "No mission is loaded. The authored missions exist and are source-cited, but this build does not load them yet.",
            };
      case "briefing":
        return snapshot.phase === "briefing"
          ? { status: "active", note: "Reading the survey question." }
          : snapshot.missionId
            ? { status: "done", note: "Brief accepted." }
            : { status: "pending", note: "Waiting for a mission." };
      case "chooseTarget":
        return snapshot.selectedBodyId
          ? { status: "done", note: "Target chosen." }
          : { status: "pending", note: "No target chosen." };
      case "selectInstrument":
        return snapshot.selectedInstrumentId
          ? { status: "done", note: "Instrument selected." }
          : { status: "pending", note: "No instrument selected." };
      case "observe":
        return measureDone
          ? { status: "done", note: "A value has been measured." }
          : { status: "pending", note: "No measurement taken yet." };
      case "captureEvidence":
        return captured
          ? { status: "done", note: `${snapshot.evidence.length} observation(s) kept.` }
          : { status: "pending", note: "The notebook is empty. Observing is not the same as keeping." };
      case "compare":
        return compared
          ? { status: "done", note: "At least two worlds compared." }
          : { status: "pending", note: "A comparison needs the same property from two worlds." };
      case "makeClaim":
        return claimed
          ? { status: "done", note: "Claim drafted." }
          : { status: "pending", note: "No claim drafted." };
      case "citeEvidence":
        return cited
          ? { status: "done", note: `${snapshot.claim?.citedEvidenceIds.length ?? 0} observation(s) cited.` }
          : { status: "pending", note: "An uncited claim cannot be submitted." };
      case "debrief":
        return evaluated
          ? { status: "done", note: "Debrief produced." }
          : { status: "pending", note: "Waiting for a submitted claim." };
      case "reviseOrReplay":
        return complete
          ? { status: "done", note: "Mission complete." }
          : { status: "pending", note: "Available after a debrief." };
      default: {
        const unreachable: never = id;
        throw new Error(`Unhandled loop step: ${String(unreachable)}`);
      }
    }
  };

  return LOOP_STEPS.map((step) => {
    const { status, note } = statusFor(step.id);
    return { step, status, note };
  });
}

/**
 * Non-color marker for a step status (docs/ACCESSIBILITY.md A-9).
 *
 * The glyph comes from `src/design/tokens.ts`, which is the single definition of
 * every required non-colour encoding. The brackets are presentation; the glyph is
 * the design token. Before this indirection the glyph was duplicated here and had
 * already drifted from the stylesheet: the tokens declared a middle dot for a
 * not-yet-reached step while this function drew an empty bracket.
 */
export function statusMarker(status: LoopStepStatus): string {
  switch (status) {
    case "done":
      return `[${markerGlyph("done")}]`;
    case "active":
      return `[${markerGlyph("active")}]`;
    case "pending":
      return `[${markerGlyph("pending")}]`;
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function statusLabel(status: LoopStepStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "active":
      return "Current";
    case "pending":
      return "Not yet";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}
