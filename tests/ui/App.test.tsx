/**
 * Application shell behaviour, from the learner's point of view.
 *
 * jsdom has no GPU, so this file also proves the honest-failure contract: with no
 * renderer, the briefing, the notebook, and the whole evidence route must still
 * work (docs/ACCESSIBILITY.md §1). The REAL renderer path is covered by
 * tests/e2e/smoke.spec.ts in a real browser.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "@/ui/App";
import { LOOP_STEPS } from "@/ui/loopSteps";

describe("App shell", () => {
  it("renders the survey identity and the provenance disclosure", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Planetary Survey");
    expect(screen.getByTestId("foundation-note").textContent).toContain(
      "Independent science review is still outstanding",
    );
  });

  it("exposes a skip link as the first focus stop", () => {
    render(<App />);
    const skip = screen.getByRole("link", { name: /skip to the survey workstation/i });
    expect(skip.getAttribute("href")).toBe("#main");
  });

  it("provides a polite live region for announcements", () => {
    render(<App />);
    const statuses = screen.getAllByRole("status");
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses[0]?.getAttribute("aria-live")).toBe("polite");
  });

  it("shows every step of the frozen loop", () => {
    render(<App />);
    const checklist = screen.getByTestId("loop-checklist");
    expect(checklist.querySelectorAll("li")).toHaveLength(LOOP_STEPS.length);
    expect(checklist.textContent).toContain("Cite evidence");
    expect(checklist.textContent).toContain("Revise or replay");
  });

  it("renders the evidence notebook as a real table with an empty state", () => {
    render(<App />);
    expect(screen.getByTestId("notebook-empty-state")).toBeTruthy();
    const table = screen.getByTestId("notebook-table");
    expect(table.tagName).toBe("TABLE");
    expect(table.querySelectorAll("th")).toHaveLength(5);
    expect(table.textContent).toContain("Source");
  });

  it("reports authored-and-sourced separately from science-reviewed", () => {
    render(<App />);
    const status = screen.getByTestId("content-status").textContent ?? "";
    expect(status).toContain("every value cited in the source register");
    expect(status).toContain("Independent science review is outstanding");
    expect(status).not.toContain("Independent science review is complete");
    expect(screen.getByTestId("briefing-empty-state").textContent).toContain(
      "independent science review is still outstanding",
    );
  });

  it("loads an authored mission and runs the survey-to-capture path", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    expect(screen.getByTestId("briefing-title").textContent).toContain("Order the rocky worlds");
    expect(screen.getByTestId("target-selection")).toBeTruthy();

    fireEvent.click(screen.getByTestId("select-target-mars"));
    expect(screen.getByTestId("select-target-mars").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("target-properties-table").textContent).toContain("Mean radius");
    expect(screen.getByTestId("target-properties-table").textContent).toMatch(/Published value available/);

    fireEvent.click(screen.getByTestId("select-instrument-radiusSounder"));
    expect(screen.getByTestId("select-instrument-radiusSounder").getAttribute("aria-pressed")).toBe(
      "true",
    );

    fireEvent.change(screen.getByTestId("measure-attribute"), {
      target: { value: "meanRadius" },
    });
    fireEvent.click(screen.getByTestId("measure-button"));
    expect(screen.getByTestId("measurement-result").textContent).toContain("km");
    expect(screen.getByTestId("measurement-review-status").textContent).toContain("unreviewed");

    fireEvent.click(screen.getByTestId("capture-evidence"));
    expect(screen.queryByTestId("notebook-empty-state")).toBeNull();
    expect(screen.getByTestId("notebook-table").textContent).toContain("Mars");
    expect(screen.getByTestId("notebook-table").textContent).toContain("Radius sounder");
    expect(screen.getByTestId("comparison-insufficient").textContent).toMatch(/at least 2 worlds/i);
    expect(screen.getByTestId("compare-button").hasAttribute("disabled")).toBe(true);
  });

  it("compares two captured worlds on a ranked table", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));

    for (const bodyId of ["mars", "venus"] as const) {
      fireEvent.click(screen.getByTestId(`select-target-${bodyId}`));
      fireEvent.click(screen.getByTestId("select-instrument-radiusSounder"));
      fireEvent.change(screen.getByTestId("measure-attribute"), {
        target: { value: "meanRadius" },
      });
      fireEvent.click(screen.getByTestId("measure-button"));
      fireEvent.click(screen.getByTestId("capture-evidence"));
    }

    expect(screen.getByTestId("comparison-ready")).toBeTruthy();
    fireEvent.click(screen.getByTestId("compare-button"));
    expect(screen.getByTestId("comparison-table-meanRadius").textContent).toContain("Venus");
    expect(screen.getByTestId("comparison-table-meanRadius").textContent).toContain("Mars");
    expect(screen.getByTestId("comparison-statement-meanRadius").textContent).toMatch(
      /largest to smallest/i,
    );
    expect(screen.getByTestId("comparison-chart-meanRadius")).toBeTruthy();
  });

  it("offers proportional share columns for relief comparisons", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-002-surface-relief"));

    for (const bodyId of ["mars", "venus"] as const) {
      fireEvent.click(screen.getByTestId(`select-target-${bodyId}`));
      fireEvent.click(screen.getByTestId("select-instrument-altimeter"));
      fireEvent.change(screen.getByTestId("measure-attribute"), {
        target: { value: "surfaceRelief" },
      });
      fireEvent.click(screen.getByTestId("measure-button"));
      fireEvent.click(screen.getByTestId("capture-evidence"));
    }

    fireEvent.click(screen.getByTestId("compare-button"));
    expect(screen.getByTestId("comparison-finding-surfaceRelief").getAttribute("data-proportional")).toBe(
      "true",
    );
    expect(screen.getByTestId("comparison-share-surfaceRelief-mars").textContent).toMatch(/%/);
  });

  it("explains an unsupported measurement instead of inventing a value", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    fireEvent.click(screen.getByTestId("select-target-moon"));
    fireEvent.click(screen.getByTestId("select-instrument-radiusSounder"));
    fireEvent.change(screen.getByTestId("measure-attribute"), {
      target: { value: "equatorialRadius" },
    });
    fireEvent.click(screen.getByTestId("measure-button"));
    expect(screen.getByTestId("measurement-unavailable").textContent).toMatch(
      /No authoritative value/i,
    );
    expect(screen.getByTestId("capture-evidence").hasAttribute("disabled")).toBe(true);
  });

  it("runs measure when Enter submits the observe form", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    fireEvent.click(screen.getByTestId("select-target-venus"));
    fireEvent.click(screen.getByTestId("select-instrument-radiusSounder"));
    const form = screen.getByTestId("measure-button").closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(screen.getByTestId("measurement-result")).toBeTruthy();
  });

  it("exposes quality, motion, and audio preferences", () => {
    render(<App />);
    expect(screen.getByLabelText(/presentation quality/i)).toBeTruthy();
    expect(screen.getByLabelText(/reduce motion/i)).toBeTruthy();
    // Audio starts muted (docs/ACCESSIBILITY.md A-10), so the control on offer
    // is the one that turns sound ON.
    expect(screen.getByRole("button", { name: /unmute sound/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

describe("honest renderer failure", () => {
  it("reports the unavailable state instead of showing a blank viewport", () => {
    render(<App />);
    expect(screen.getByTestId("renderer-viewport").getAttribute("data-viewport-state")).toBe(
      "unavailable",
    );
    expect(screen.getByTestId("renderer-overlay").textContent).toContain(
      "cannot start the 3D survey view",
    );
  });

  it("keeps the canvas decorative so a screen reader never depends on it", () => {
    render(<App />);
    const canvas = screen.getByTestId("renderer-canvas");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    // `tabindex="-1"` is the renderer's deliberate response to Babylon making the
    // canvas focusable. Either state keeps it out of the tab order, which is the
    // actual requirement; the real-browser probe is tests/e2e/smoke.spec.ts.
    const tabindex = canvas.getAttribute("tabindex");
    expect(tabindex === null || tabindex === "-1").toBe(true);
  });

  it("still allows the full evidence route with no renderer at all", () => {
    render(<App />);
    // Every surface that carries required evidence is present and semantic.
    expect(screen.getByTestId("briefing-panel")).toBeTruthy();
    expect(screen.getByTestId("evidence-notebook")).toBeTruthy();
    expect(screen.getByTestId("loop-checklist")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /evidence without the 3d view/i })).toBeTruthy();
  });

  it("separates the backend in use from the backend merely requested", () => {
    render(<App />);
    // jsdom has no GPU, so the renderer settles on "unavailable" and the system
    // check must say so rather than echoing the probe's request as fact.
    expect(screen.getByTestId("diag-backend").textContent).toBe("unavailable");
    expect(screen.getByTestId("diag-backend-requested").textContent).toBe("unavailable");
    expect(screen.getByTestId("diag-quality").textContent).toBe("standard");
  });

  it("never offers the highest tier without a confirmed backend", () => {
    // jsdom exposes no WebGPU at all here, but the point is the invariant: the most
    // expensive presentation tier is unreachable while no backend is confirmed.
    render(<App />);
    expect(screen.getByTestId("diag-webgpu").textContent).toBe("not available");
    expect(screen.getByTestId("diag-quality").textContent).not.toBe("high");
  });
});

describe("mission controls", () => {
  it("advances the shell through the briefing and announces the outcome", () => {
    render(<App />);
    const openMission = screen.getByTestId("load-mission-survey-001-sizes");
    fireEvent.click(openMission);

    expect(openMission.hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("briefing-panel").textContent).toContain("survey-001-sizes");
    expect(screen.getAllByRole("status")[0]?.textContent).toContain("Mission loaded");
  });

  it("lets the learner change the presentation quality", () => {
    render(<App />);
    const select = screen.getByLabelText(/presentation quality/i);
    fireEvent.change(select, { target: { value: "reduced" } });
    expect(screen.getByTestId("diag-quality").textContent).toBe("reduced");
  });

  it("toggles mute and reflects it in the accessible state", () => {
    render(<App />);
    // Muted by default, so the first press turns sound on.
    const unmute = screen.getByRole("button", { name: /unmute sound/i });
    fireEvent.click(unmute);
    const mute = screen.getByRole("button", { name: /mute sound/i });
    expect(mute.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(mute);
    expect(
      screen.getByRole("button", { name: /unmute sound/i }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("says sound is optional rather than promising cues that do not exist", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /unmute sound/i }));
    // The old copy promised nothing ("no audio cues are authored yet"). PS-10
    // ships real cues, so the status must state the property that actually
    // matters: nothing you must read is only in the sound.
    expect(screen.getByRole("status").textContent ?? "").toMatch(/optional|nothing you need to read/i);
  });
});
