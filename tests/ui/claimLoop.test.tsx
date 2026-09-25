/**
 * The claim loop, from the learner's point of view (GAME-372).
 *
 * jsdom has no GPU, so this also proves the loop is a complete route without a
 * renderer: claim, citation, debrief, completion, hints, and revision all work with
 * the viewport unavailable. The real-browser path is tests/e2e/accessibility.spec.ts.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/ui/App";

/** Measure and capture one world the way the loop requires. */
function survey(bodyId: string): void {
  fireEvent.click(screen.getByTestId(`select-target-${bodyId}`));
  fireEvent.click(screen.getByTestId("select-instrument-radiusSounder"));
  fireEvent.click(screen.getByTestId("measure-button"));
  fireEvent.click(screen.getByTestId("capture-evidence"));
}

describe("the claim loop in the shell", () => {
  it("drafts, cites, submits, debriefs, and completes a mission", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    // The guided mission's completion path is all three worlds (D-40): the Moon is
    // part of its claim target even though the claim only compares Mars and Venus.
    survey("moon");
    survey("mars");
    survey("venus");
    fireEvent.click(screen.getByTestId("compare-button"));

    // The claim form composes the mission's target claim from named parts.
    expect(screen.getByTestId("claim-draft-sentence").textContent).toContain("Venus");
    fireEvent.click(screen.getByTestId("draft-claim"));
    expect(screen.getByTestId("claim-current").textContent).toContain("Venus");

    // Cite every captured world, then submit.
    const cite = screen.getByTestId("cite-evidence");
    const boxes = within(cite).getAllByRole("checkbox");
    expect(boxes).toHaveLength(3);
    for (const box of boxes) fireEvent.click(box);
    expect(screen.getByTestId("cite-count").textContent).toContain("Cited 3 of 3");

    fireEvent.click(screen.getByTestId("submit-claim"));
    expect(screen.getByTestId("claim-submitted")).toBeTruthy();
    fireEvent.click(screen.getByTestId("open-debrief"));

    const debrief = screen.getByTestId("debrief");
    expect(within(debrief).getByTestId("debrief-verdict").textContent).toContain("Supported");
    expect(within(debrief).getByTestId("debrief-dimensions").textContent).toContain(
      "Both worlds cited",
    );
    // The debrief names where a sourced fact came from.
    expect(within(debrief).getByTestId("debrief-facts").textContent).toContain("source register");

    fireEvent.click(screen.getByTestId("complete-mission"));
    expect(screen.getByTestId("debrief-completion").textContent).toContain(
      "Met by the cited evidence",
    );
  });

  it("says a supported claim did not meet the mission target while evidence is missing", () => {
    // The F-1 case in the shell: the claim is supported on the two worlds it cites,
    // but the mission also asks for the Moon, so the target is not met and the
    // debrief names what is still needed rather than claiming a finish.
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    survey("mars");
    survey("venus");
    fireEvent.click(screen.getByTestId("compare-button"));
    fireEvent.click(screen.getByTestId("draft-claim"));
    for (const box of within(screen.getByTestId("cite-evidence")).getAllByRole("checkbox")) {
      fireEvent.click(box);
    }
    fireEvent.click(screen.getByTestId("submit-claim"));
    fireEvent.click(screen.getByTestId("open-debrief"));
    expect(screen.getByTestId("debrief-verdict").textContent).toContain("Supported");

    fireEvent.click(screen.getByTestId("complete-mission"));
    expect(screen.getByTestId("debrief-target-status").textContent).toContain(
      "Supported, but not met",
    );
    const missing = screen.getByTestId("debrief-missing-evidence").textContent ?? "";
    expect(missing).toContain("Moon");
    expect(missing).toContain("Mean radius");
    // The raw observation key is never shown to a learner.
    expect(missing).not.toContain("moon.meanRadius");
  });

  it("recovers from a short target by measuring the missing world and re-citing", () => {
    // The whole point of the D-40 rule: when a supported claim does not meet the
    // mission's target, the learner must be able to go and get the missing
    // observation. Revision keeps the claim and its citations (D-36), and the survey
    // controls are offered again from `claimDrafting` (UX step 11) — the domain
    // always allowed it, the shell used to disable it.
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    survey("mars");
    survey("venus");
    fireEvent.click(screen.getByTestId("compare-button"));
    fireEvent.click(screen.getByTestId("draft-claim"));
    for (const box of within(screen.getByTestId("cite-evidence")).getAllByRole("checkbox")) {
      fireEvent.click(box);
    }
    fireEvent.click(screen.getByTestId("submit-claim"));
    fireEvent.click(screen.getByTestId("open-debrief"));
    fireEvent.click(screen.getByTestId("complete-mission"));
    expect(screen.getByTestId("debrief-target-status").textContent).toContain(
      "Supported, but not met",
    );

    fireEvent.click(screen.getByTestId("revise-claim"));
    survey("moon");
    expect(screen.getByTestId("notebook-table").textContent).toContain("Moon");
    fireEvent.click(screen.getByTestId("compare-button"));

    // The revision kept both earlier citations; only the new observation is added.
    expect(screen.getByTestId("cite-count").textContent).toContain("Cited 2 of 3");
    const uncited = within(screen.getByTestId("cite-evidence"))
      .getAllByRole("checkbox")
      .filter((box) => !(box as HTMLInputElement).checked);
    expect(uncited).toHaveLength(1);
    fireEvent.click(uncited[0] as HTMLElement);
    expect(screen.getByTestId("cite-count").textContent).toContain("Cited 3 of 3");

    fireEvent.click(screen.getByTestId("submit-claim"));
    fireEvent.click(screen.getByTestId("open-debrief"));
    fireEvent.click(screen.getByTestId("complete-mission"));
    expect(screen.getByTestId("debrief-target-status").textContent).toContain(
      "Met by the cited evidence",
    );
    expect(screen.queryByTestId("debrief-missing-evidence")).toBeNull();
  });

  it("refuses an uncited claim with an explanation, then revises in place", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    survey("mars");
    survey("venus");
    fireEvent.click(screen.getByTestId("compare-button"));
    fireEvent.click(screen.getByTestId("draft-claim"));

    // An uncited claim can be submitted, and is refused with an explanation.
    fireEvent.click(screen.getByTestId("submit-claim"));
    expect(screen.getByTestId("claim-submitted-verdict").textContent).toContain(
      "cannot be checked",
    );

    // Revision reopens the claim in place: no new reading is required (D-36).
    fireEvent.click(screen.getByTestId("revise-after-submit"));
    expect(screen.getByTestId("claim-form")).toBeTruthy();
    fireEvent.click(screen.getByTestId("draft-claim"));
    expect(screen.getByTestId("claim-current")).toBeTruthy();
    // Nothing measured was discarded.
    expect(screen.getByTestId("notebook-table").textContent).toContain("Venus");
  });

  it("reveals hints one at a time and never performs a choice", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    expect(screen.getByTestId("hints-count").textContent).toContain("0 of 3 hints shown");

    fireEvent.click(screen.getByTestId("request-hint"));
    expect(screen.getByTestId("hints-count").textContent).toContain("1 of 3 hints shown");
    expect(screen.getByTestId("hints-list").textContent).toContain("Read the brief again");

    // A hint changes nothing: no claim exists and no target is chosen by it.
    expect(screen.queryByTestId("claim-current")).toBeNull();
    expect(screen.queryByTestId("claim-form")).toBeTruthy();
  });
});
