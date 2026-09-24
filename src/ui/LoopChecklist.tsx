/**
 * The canonical loop, as a checklist the learner can read.
 *
 * Status is derived from domain state (`loopSteps.ts`), never tracked separately,
 * so the UI cannot claim progress the domain disagrees with. Status is shown with
 * a text marker and a text label so it never depends on color alone
 * (docs/ACCESSIBILITY.md A-9).
 */

import { statusLabel, statusMarker, type LoopStepState } from "./loopSteps";

export interface LoopChecklistProps {
  readonly steps: readonly LoopStepState[];
}

export function LoopChecklist({ steps }: LoopChecklistProps) {
  return (
    <section aria-labelledby="loop-heading" data-testid="loop-checklist">
      <h2 id="loop-heading">Survey loop</h2>
      <p>
        The same loop runs every mission. Steps become available as the survey progresses.
      </p>
      <ol>
        {steps.map(({ step, status, note }) => (
          <li key={step.id} data-step={step.id} data-status={status}>
            <span aria-hidden="true" className="ps-loop-marker">
              {statusMarker(status)}
            </span>{" "}
            <strong>{step.label}</strong>{" "}
            <span className="ps-loop-status">
              <span className="ps-visually-hidden">Status: </span>
              {statusLabel(status)}
            </span>
            <br />
            <span className="ps-muted">{note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
