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

  it("loads an authored mission and exposes target selection", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("load-mission-survey-001-sizes"));
    expect(screen.getByTestId("briefing-title").textContent).toContain("Order the rocky worlds");
    expect(screen.getByTestId("target-selection")).toBeTruthy();
    fireEvent.click(screen.getByTestId("select-target-mars"));
    expect(screen.getByTestId("select-target-mars").getAttribute("aria-pressed")).toBe("true");
  });

  it("exposes quality, motion, and audio preferences", () => {
    render(<App />);
    expect(screen.getByLabelText(/presentation quality/i)).toBeTruthy();
    expect(screen.getByLabelText(/reduce motion/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /mute sound/i }).getAttribute("aria-pressed")).toBe(
      "false",
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
    const mute = screen.getByRole("button", { name: /mute sound/i });
    fireEvent.click(mute);
    const unmute = screen.getByRole("button", { name: /unmute sound/i });
    expect(unmute.getAttribute("aria-pressed")).toBe("true");
  });
});
