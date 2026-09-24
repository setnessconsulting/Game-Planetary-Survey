/**
 * React binding for the pure mission state machine.
 *
 * React owns *semantic* mission state — which phase the learner is in, what is in
 * the notebook — and nothing else. It does not own the 3D frame loop, and it does
 * not own scientific truth: every value here came out of a pure domain
 * transition (docs/TECHNICAL_DESIGN.md §4).
 *
 * The reducer work is done OUTSIDE the `setState` updater on purpose, so React's
 * development-mode double invocation cannot double-apply an intent.
 */

import { useCallback, useRef, useState } from "react";

import {
  applyIntent,
  initialMissionSnapshot,
  type IntentResult,
  type MissionContext,
  type MissionIntent,
  type MissionSnapshot,
} from "@/domain/mission";

export interface UseMissionResult {
  readonly snapshot: MissionSnapshot;
  /** The most recent applied fact or rejection reason, for announcement. */
  readonly message: string;
  readonly dispatch: (intent: MissionIntent) => IntentResult;
}

export function useMission(context: MissionContext, seed = 0): UseMissionResult {
  const [snapshot, setSnapshot] = useState<MissionSnapshot>(() => initialMissionSnapshot(seed));
  const [message, setMessage] = useState(
    "Planetary Survey foundation shell ready. No mission content is loaded yet.",
  );

  const snapshotRef = useRef(snapshot);
  const contextRef = useRef(context);
  contextRef.current = context;

  const dispatch = useCallback((intent: MissionIntent): IntentResult => {
    const result = applyIntent(snapshotRef.current, intent, contextRef.current);
    snapshotRef.current = result.snapshot;
    setSnapshot(result.snapshot);
    setMessage(result.kind === "applied" ? result.fact : result.reason);
    return result;
  }, []);

  return { snapshot, message, dispatch };
}
