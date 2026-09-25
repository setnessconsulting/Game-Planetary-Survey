/**
 * Surface inventory tests (GAME-367).
 *
 * The inventory is a design artefact, so the risk is not that it is wrong — it is
 * that it drifts: a loop step renamed in the code, an obligation dropped from a
 * surface, a surface marked finished while it is not. These tests tie the inventory
 * to the shipped loop and to the accessibility contract on both sides, so a drift
 * fails rather than reading as a tidy document.
 */

import { describe, expect, it } from "vitest";

import { SURFACES } from "@/design/surfaces";
import { DESIGN_TOKENS } from "@/design/tokens";
import { LOOP_STEPS } from "@/ui/loopSteps";

function surface(id: string) {
  const found = SURFACES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No surface ${id}`);
  return found;
}

describe("the inventory covers the frozen learner path", () => {
  it("gives every one of the eleven steps exactly one owning surface", () => {
    const claimed = SURFACES.filter((entry) => entry.kind === "loop-step").map(
      (entry) => entry.loopStep,
    );
    expect(new Set(claimed).size).toBe(claimed.length);
    expect([...claimed].sort()).toEqual(LOOP_STEPS.map((step) => step.id).sort());
    expect(claimed).toHaveLength(11);
  });

  it("keeps global states out of the step ownership", () => {
    // Loading, fallback, and reduced motion can occur during any step. If one of
    // them claimed a step, that step would lose the surface that owns it.
    const globals = SURFACES.filter((entry) => entry.kind === "global-state");
    expect(globals.length).toBeGreaterThanOrEqual(2);
    for (const entry of globals) {
      expect(entry.loopStep, entry.id).toBeNull();
      expect(LOOP_STEPS.map((step) => step.id)).not.toContain(entry.id);
    }
  });

  it("declares at least two states per surface, with a non-colour signal for each", () => {
    for (const entry of SURFACES) {
      expect(entry.states.length, entry.id).toBeGreaterThanOrEqual(2);
      const ids = entry.states.map((state) => state.id);
      expect(new Set(ids).size, entry.id).toBe(ids.length);
      for (const state of entry.states) {
        expect(state.nonColorSignal.trim().length, `${entry.id}.${state.id}`).toBeGreaterThan(10);
        expect(state.description.trim().length, `${entry.id}.${state.id}`).toBeGreaterThan(20);
      }
    }
  });

  it("states a non-colour encoding for every surface", () => {
    // docs/ACCESSIBILITY.md A-9. This is the rule most easily lost in a redesign,
    // so it is a required field rather than a note in the design document.
    for (const entry of SURFACES) {
      expect(entry.nonColorEncoding.trim().length, entry.id).toBeGreaterThan(20);
    }
  });
});

describe("accessibility obligations are attached to the surfaces that owe them", () => {
  it("gives every surface that shows visual data a text or table equivalent (A-13)", () => {
    const visual = SURFACES.filter((entry) => entry.showsVisualData);
    expect(visual.length).toBeGreaterThanOrEqual(4);
    for (const entry of visual) {
      expect(entry.textualEquivalent, entry.id).toBeTruthy();
      expect(entry.textualEquivalent!.trim().length, entry.id).toBeGreaterThan(30);
    }
  });

  it("gives every surface that uses the 3D view a non-precision alternative (A-14)", () => {
    const threeD = SURFACES.filter((entry) => entry.usesThreeDView);
    expect(threeD.map((entry) => entry.id).sort()).toEqual([
      "comparison",
      "observe-measure",
      "target-selection",
    ]);
    for (const entry of threeD) {
      expect(entry.nonPrecisionAlternative, entry.id).toBeTruthy();
    }
  });

  it("keeps the observation step's reading available without a renderer", () => {
    // The governing principle of the accessibility contract: the viewport may
    // enhance understanding and must never be the only route to required evidence.
    const observe = surface("observe-measure");
    expect(observe.textualEquivalent).toContain("value, unit, significant figures, and source id");
    expect(observe.nonPrecisionAlternative).toContain("with no renderer at all");
  });

  it("makes every interactive surface account for touch and keyboard (A-1, A-3)", () => {
    const interactive = SURFACES.filter((entry) => entry.interactive);
    expect(interactive.length).toBeGreaterThanOrEqual(6);
    for (const entry of interactive) {
      expect(entry.touchTarget, entry.id).toBeTruthy();
      expect(entry.keyboard.trim().length, entry.id).toBeGreaterThan(20);
    }
  });

  it("does not claim a touch target for a surface with nothing to touch", () => {
    for (const entry of SURFACES.filter((candidate) => !candidate.interactive)) {
      expect(entry.touchTarget, entry.id).toBeNull();
    }
  });

  it("names only declared motion tokens, so no surface can inline a duration", () => {
    const known = new Set(DESIGN_TOKENS.map((token) => token.name));
    for (const entry of SURFACES) {
      for (const name of entry.motionTokens) {
        expect(known.has(name), `${entry.id} uses ${name}`).toBe(true);
        expect(DESIGN_TOKENS.find((token) => token.name === name)?.group, name).toBe("motion");
      }
    }
    // Every surface that animates at all must respect the reduced-motion contract,
    // which is only possible because it names tokens instead of literals.
    expect(SURFACES.some((entry) => entry.motionTokens.length > 0)).toBe(true);
  });
});

describe("maturity is reported honestly", () => {
  it("separates what ships from what is only specified", () => {
    const implemented = SURFACES.filter((entry) => entry.maturity === "implemented");
    const specified = SURFACES.filter((entry) => entry.maturity === "specified");
    const partial = SURFACES.filter((entry) => entry.maturity === "partial");
    expect(implemented.length + specified.length + partial.length).toBe(SURFACES.length);
    // Downstream loop steps remain specified until their owning stories land.
    expect(specified.length).toBeGreaterThan(0);
  });

  it("makes every unfinished surface name what is missing and who owns it", () => {
    for (const entry of SURFACES.filter((candidate) => candidate.maturity !== "implemented")) {
      expect(entry.knownGap, entry.id).toBeTruthy();
      expect(entry.knownGap!.trim().length, entry.id).toBeGreaterThan(30);
    }
  });

  it("keeps no stale gap on a surface that ships", () => {
    for (const entry of SURFACES.filter((candidate) => candidate.maturity === "implemented")) {
      expect(entry.knownGap, entry.id).toBeNull();
    }
  });

  it("documents the mission-state-machine gaps the trace suite found", () => {
    // Open constraints 6 and 7 in docs/STATUS.md. They are owned by PS-08, and a
    // design document that omitted them would present the loop as finished.
    expect(surface("debrief").knownGap).toContain("PS-08");
    expect(surface("revise-replay").knownGap).toContain("constraint 6");
    expect(surface("revise-replay").knownGap).toContain("constraint 7");
  });

  it("does not describe the fallback as an error the learner caused", () => {
    const fallback = surface("renderer-fallback");
    expect(fallback.purpose).toContain("non-precision alternative");
    expect(fallback.states.every((state) => !/\berror\b/i.test(state.label))).toBe(true);
  });
});
