/**
 * The guided-mission production vertical slice (GAME-373 / PS-09).
 *
 * GAME-373 requires one complete guided mission, a full loop playable end to end,
 * and science / UX / accessibility / real-render / performance evidence — before
 * content expansion is allowed. This suite is the real-browser half of that
 * evidence. It plays `survey-001-sizes` the way the brief asks: all three worlds
 * measured and captured, compared, claimed, cited, submitted, debriefed, completed.
 *
 * What each test is for:
 *
 *  - the live renderer path: the whole slice with Babylon running on the required
 *    WebGL2 baseline, with an axe scan at every phase and a frame-loop check;
 *  - the keyboard path: the same slice with no pointer input at all;
 *  - the degraded path: the same slice with **no 3D backend**, because every
 *    measurement, comparison, and claim has to be reachable without the renderer;
 *  - the mission-target rule (D-40): a supported claim that leaves one of the
 *    mission's own required observations uncited must not be reported as a met
 *    target, and the debrief must name what is missing;
 *  - the recovery: from that state, revision keeps the claim and the citations, the
 *    survey controls come back, and the missing world can be measured without
 *    restarting.
 *
 * ## What this file does NOT prove
 *
 * Chromium here renders through ANGLE/SwiftShader — software rasterization. That is
 * enough to prove the renderer *works* in a real browser, and it is what the frame
 * numbers below are measured on, but it is NOT visual-quality or performance
 * qualification. `docs/PERFORMANCE_AND_DEVICE_BUDGETS.md` §2.3 and §11 require a real
 * GPU or representative device for that, and `ACCEPTANCE_EVIDENCE_MATRIX.md` forbids
 * automation from claiming human evidence (target-age playtest, screen-reader
 * experience, science approval). Those remain outstanding. See
 * `docs/SLICE_QUALIFICATION.md`.
 *
 * This file runs in the chromium project only: it is the reference engine for the
 * WebGL2 baseline, and the other engines in CI have no software GL. Cross-engine
 * proof of the same semantic route lives in `tests/e2e/accessibility.spec.ts`,
 * which runs on all three engines.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const GUIDED_MISSION_ID = "survey-001-sizes";

/** The three worlds `survey-001-sizes` requires, in the brief's order. */
const REQUIRED_WORLDS = [
  { id: "moon", label: "Moon" },
  { id: "mars", label: "Mars" },
  { id: "venus", label: "Venus" },
] as const;

/** Hide the WebGPU API, so the required WebGL2 baseline is the only option. */
async function pinToWebGL2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
  });
}

/** Remove every 3D backend, so the honest-failure path is genuinely reached. */
async function pinToNoRenderer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patched(
      this: HTMLCanvasElement,
      contextId: string,
      ...rest: unknown[]
    ) {
      if (typeof contextId === "string" && (contextId.startsWith("webgl") || contextId === "webgpu")) {
        return null;
      }
      return (original as (...args: unknown[]) => unknown).call(this, contextId, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

/**
 * Open the app and start watching it.
 *
 * The console/network gate is `docs/PERFORMANCE_AND_DEVICE_BUDGETS.md` §9 (zero
 * uncaught exceptions, zero unexpected console errors, zero unexpected
 * third-party network requests) applied to the slice rather than to the shell: v1
 * is local-first, so a request to any other origin is a privacy-surface violation
 * and not a slow asset.
 */
async function openSlice(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planetary Survey");

  return {
    assertClean(context: string): void {
      const origin = new URL(page.url()).origin;
      const offOrigin = requests.filter((url) => {
        if (url.startsWith("data:") || url.startsWith("blob:")) return false;
        try {
          return new URL(url).origin !== origin;
        } catch {
          return false;
        }
      });
      expect(offOrigin, `${context}: unexpected off-origin requests`).toEqual([]);
      expect(pageErrors, `${context}: unexpected page errors`).toEqual([]);
      expect(consoleErrors, `${context}: unexpected console errors`).toEqual([]);
    },
  };
}

/** An axe scan is coverage, never sign-off (docs/ACCESSIBILITY.md §6). */
async function expectNoAccessibilityViolations(page: Page, phase: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations,
    `${phase}: ${results.violations
      .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
      .join("\n")}`,
  ).toEqual([]);
}

/** Load the guided mission and accept its brief. */
async function loadGuidedMission(page: Page): Promise<void> {
  await page.getByTestId(`load-mission-${GUIDED_MISSION_ID}`).click();
  await expect(page.getByTestId("briefing-panel")).toContainText(GUIDED_MISSION_ID);
  await page.getByRole("button", { name: "Continue to target selection" }).click();
}

/** Measure one world and keep the reading, the way the loop requires. */
async function surveyWorld(page: Page, bodyId: string, label: string): Promise<void> {
  await page.getByTestId(`select-target-${bodyId}`).click();
  await page.getByTestId("select-instrument-radiusSounder").click();
  await page.getByTestId("measure-button").click();
  // The reading is text with its unit before it is kept — never the canvas.
  await expect(page.getByTestId("measurement-result")).toBeVisible();
  await page.getByTestId("capture-evidence").click();
  await expect(page.getByTestId("notebook-table")).toContainText(label);
}

/** Survey every world the guided mission requires. */
async function surveyAllRequiredWorlds(page: Page): Promise<void> {
  // With no 3D backend there is no canvas and therefore no art to assert; the
  // loop still has to complete, which is the point of that pass.
  const expectsArt = await hasLiveBackend(page);
  for (const world of REQUIRED_WORLDS) {
    await surveyWorld(page, world.id, world.label);
    if (expectsArt) {
      await expectProductionArtLoaded(page, world.id);
    }
  }
}

/**
 * Assert the body's production art is actually on screen.
 *
 * The slice proved the *loop* for five stories without ever proving that a
 * world was drawn, because a renderer sitting on its untextured fallback sphere
 * looks identical to one showing a body. That is how a glTF 2.0 loader that
 * was never registered went unnoticed: the mission still completed, and the
 * screenshot still had a planet in it. `psArtBody` is the observable that
 * distinguishes the two, and checking it here is what makes "production art
 * ships" part of the gate rather than a claim in a document.
 */
async function expectProductionArtLoaded(page: Page, bodyId: string): Promise<void> {
  // The DOM attribute is the kebab-case form; `dataset.psArtBody` is the JS
  // alias for the same thing.
  await expect(page.getByTestId("renderer-canvas")).toHaveAttribute(
    "data-ps-art-body",
    bodyId,
    { timeout: 30_000 },
  );
  // An empty note list means nothing fell back: mesh, albedo, normal map, and
  // environment all loaded.
  await expect(page.getByTestId("renderer-canvas")).toHaveAttribute("data-ps-art-notes", "");
}

/** True when a live 3D backend exists, so production art can be expected. */
async function hasLiveBackend(page: Page): Promise<boolean> {
  return (await page.getByTestId("renderer-viewport").getAttribute("data-viewport-state")) === "ready";
}

/** Draft the mission's target claim, citing every observation offered. */
async function draftAndCiteEveryRecord(page: Page): Promise<void> {
  await page.getByTestId("draft-claim").click();
  await expect(page.getByTestId("claim-current")).toBeVisible();
  const boxes = page.getByTestId("cite-evidence").getByRole("checkbox");
  const count = await boxes.count();
  for (let index = 0; index < count; index += 1) {
    await boxes.nth(index).check();
  }
  await expect(page.getByTestId("cite-count")).toContainText(`Cited ${count} of ${count}`);
}

/** Submit, open the debrief, and complete the mission. */
async function submitDebriefAndComplete(page: Page, expectSupported = true): Promise<void> {
  await page.getByTestId("submit-claim").click();
  await expect(page.getByTestId("claim-submitted")).toBeVisible();
  await page.getByTestId("open-debrief").click();
  if (expectSupported) {
    await expect(page.getByTestId("debrief-verdict")).toContainText("Supported");
  }
  await page.getByTestId("complete-mission").click();
  await expect(page.getByTestId("debrief-completion")).toBeVisible();
}

test.describe("@slice the guided-mission vertical slice", () => {
  test("@slice plays the whole guided mission on a live WebGL2 renderer", async ({
    page,
  }, testInfo) => {
    await pinToWebGL2(page);
    const slice = await openSlice(page);

    // The renderer really runs, on the required baseline, in a real browser.
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "ready",
      { timeout: 30_000 },
    );
    await expect(page.getByTestId("diag-backend")).toHaveText("webgl2");
    const diagnostics = page.getByTestId("renderer-diagnostics");

    await loadGuidedMission(page);
    await expectNoAccessibilityViolations(page, "briefing");

    await surveyAllRequiredWorlds(page);
    await expect(page.getByTestId("notebook-table").locator("tbody tr")).toHaveCount(3);

    await page.getByTestId("compare-button").click();
    await expect(page.getByTestId("comparison-table-meanRadius")).toBeVisible();
    await expect(page.getByTestId("comparison-statement-meanRadius")).toContainText(
      "largest to smallest",
    );
    await expectNoAccessibilityViolations(page, "comparison");

    await draftAndCiteEveryRecord(page);
    await expectNoAccessibilityViolations(page, "citation");

    const framesBeforeComplete = Number(await diagnostics.getAttribute("data-renderer-frames"));
    await page.getByTestId("submit-claim").click();
    await expect(page.getByTestId("claim-submitted-verdict")).toContainText("support this claim");
    await expectNoAccessibilityViolations(page, "claim submitted");

    await page.getByTestId("open-debrief").click();
    // The debrief reports dimensions and attributes the verdict to the learner's
    // own three observations, before any completion summary exists.
    await expect(page.getByTestId("debrief-verdict")).toContainText("Supported");
    await expect(page.getByTestId("debrief-dimensions")).toContainText("Both worlds cited");
    await expect(page.getByTestId("debrief-supporting").locator("li")).toHaveCount(3);
    await expect(page.getByTestId("debrief-values").locator("tbody tr")).toHaveCount(2);
    await expect(page.getByTestId("debrief-facts").locator("li")).toHaveCount(3);
    await expect(page.getByTestId("debrief-missing-evidence")).toHaveCount(0);
    await expect(page.getByTestId("debrief-completion")).toHaveCount(0);
    await expectNoAccessibilityViolations(page, "debrief");

    await page.getByTestId("complete-mission").click();
    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Met by the cited evidence",
    );
    await expect(page.getByTestId("debrief-completion")).toContainText(
      "3 of 3 the mission requires",
    );
    await expect(page.getByTestId("debrief-completion")).toContainText("1 submission");
    await expect(page.getByRole("status").first()).toContainText("Mission complete");
    await expectNoAccessibilityViolations(page, "complete");

    // The frame loop ran across the whole slice: the renderer did not stall while the
    // learner worked. Software-rendered numbers, so this is a liveness check, not a
    // frame-time budget.
    const framesAfterComplete = Number(await diagnostics.getAttribute("data-renderer-frames"));
    expect(framesAfterComplete).toBeGreaterThan(framesBeforeComplete);

    await testInfo.attach("slice-renderer-diagnostics.json", {
      body: JSON.stringify(
        {
          qualification: "software-rendered (ANGLE/SwiftShader) — NOT GPU/device evidence",
          backend: await diagnostics.getAttribute("data-renderer-backend"),
          quality: await page.getByTestId("diag-quality").textContent(),
          cameraMode: await page.getByTestId("diag-camera").textContent(),
          framesBeforeComplete,
          framesAfterComplete,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    slice.assertClean("live renderer slice");
  });

  test("@slice runs the same slice with the keyboard alone", async ({ page }) => {
    await pinToWebGL2(page);
    const slice = await openSlice(page);
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      /ready|unavailable/,
      { timeout: 30_000 },
    );

    const press = async (testId: string): Promise<void> => {
      const control = page.getByTestId(testId);
      await expect(control).toBeEnabled();
      await control.focus();
      await page.keyboard.press("Enter");
    };

    await press(`load-mission-${GUIDED_MISSION_ID}`);
    const brief = page.getByRole("button", { name: "Continue to target selection" });
    await expect(brief).toBeEnabled();
    await brief.focus();
    await page.keyboard.press("Enter");

    for (const world of REQUIRED_WORLDS) {
      await press(`select-target-${world.id}`);
      await press("select-instrument-radiusSounder");
      await press("measure-button");
      await press("capture-evidence");
    }

    await press("compare-button");
    await press("draft-claim");

    // Checkboxes are toggled with the space bar, never the pointer.
    const boxes = page.getByTestId("cite-evidence").getByRole("checkbox");
    await expect(boxes).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await boxes.nth(index).focus();
      await page.keyboard.press("Space");
    }
    await expect(page.getByTestId("cite-count")).toContainText("Cited 3 of 3");

    await press("submit-claim");
    await expect(page.getByTestId("claim-submitted")).toBeVisible();
    await press("open-debrief");
    await expect(page.getByTestId("debrief-verdict")).toContainText("Supported");
    await press("complete-mission");
    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Met by the cited evidence",
    );

    await expectNoAccessibilityViolations(page, "keyboard slice, complete");
    slice.assertClean("keyboard slice");
  });

  test("@slice completes the slice with no 3D backend at all", async ({ page }) => {
    await pinToNoRenderer(page);
    const slice = await openSlice(page);

    // No backend, honestly reported, and the overlay says the evidence route is
    // unaffected — which this test then holds it to.
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "unavailable",
    );
    await expect(page.getByTestId("renderer-overlay")).toContainText(
      "cannot start the 3D survey view",
    );

    await loadGuidedMission(page);
    await surveyAllRequiredWorlds(page);
    await page.getByTestId("compare-button").click();
    await expect(page.getByTestId("comparison-table-meanRadius")).toBeVisible();
    await draftAndCiteEveryRecord(page);
    await submitDebriefAndComplete(page);

    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Met by the cited evidence",
    );
    await expectNoAccessibilityViolations(page, "degraded slice, complete");
    slice.assertClean("degraded slice");
  });

  test("@slice does not report the mission target met while a required world is uncited", async ({
    page,
  }) => {
    // The F-1 rule (D-40) as the learner sees it. A supported claim on two of the
    // three worlds is still supported — and is still not the mission's target.
    await pinToWebGL2(page);
    const slice = await openSlice(page);

    await loadGuidedMission(page);
    await surveyWorld(page, "mars", "Mars");
    await surveyWorld(page, "venus", "Venus");
    await page.getByTestId("compare-button").click();
    await draftAndCiteEveryRecord(page);
    await submitDebriefAndComplete(page);

    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Supported, but not met",
    );
    const missing = page.getByTestId("debrief-missing-evidence");
    await expect(missing).toContainText("Moon");
    await expect(missing).toContainText("Mean radius");
    // A learner never reads a raw observation key.
    await expect(missing).not.toContainText("moon.meanRadius");
    await expect(page.getByTestId("debrief-completion")).toContainText("2 of 3");
    // And it is information, not a failure: revision is offered.
    await expect(page.getByTestId("revise-claim")).toBeEnabled();

    await expectNoAccessibilityViolations(page, "short target");
    slice.assertClean("short target");
  });

  test("@slice recovers from a short target by measuring the world it was missing", async ({
    page,
  }) => {
    // The D-36 / D-40 path together, in a real browser: revision keeps the claim and
    // the citations, the survey controls come back, and the missing world is measured
    // without restarting. This is docs/UX_USER_FLOW.md step 11.
    await pinToWebGL2(page);
    const slice = await openSlice(page);

    await loadGuidedMission(page);
    await surveyWorld(page, "mars", "Mars");
    await surveyWorld(page, "venus", "Venus");
    await page.getByTestId("compare-button").click();
    await draftAndCiteEveryRecord(page);
    await submitDebriefAndComplete(page);
    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Supported, but not met",
    );

    await page.getByTestId("revise-claim").click();
    await expect(page.getByTestId("claim-form")).toBeVisible();
    // The two earlier citations survived the revision.
    await expect(page.getByTestId("cite-count")).toContainText("Cited 2 of 2");

    await surveyWorld(page, "moon", "Moon");
    await page.getByTestId("compare-button").click();
    await expect(page.getByTestId("cite-count")).toContainText("Cited 2 of 3");
    // Read the checkbox states rather than assuming them: the record the learner has
    // not cited yet must be the world they just measured.
    const boxes = page.getByTestId("cite-evidence").getByRole("checkbox");
    await expect(boxes).toHaveCount(3);
    const checkedStates = [0, 1, 2].map((index) => boxes.nth(index).isChecked());
    const resolved = await Promise.all(checkedStates);
    expect(resolved.filter(Boolean)).toHaveLength(2);
    const uncitedIndex = resolved.indexOf(false);
    expect(uncitedIndex).toBe(2);
    await expect(boxes.nth(uncitedIndex).locator("xpath=..")).toContainText("Moon");
    await boxes.nth(uncitedIndex).check();
    await expect(page.getByTestId("cite-count")).toContainText("Cited 3 of 3");

    await page.getByTestId("submit-claim").click();
    await page.getByTestId("open-debrief").click();
    await page.getByTestId("complete-mission").click();
    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Met by the cited evidence",
    );
    await expect(page.getByTestId("debrief-completion")).toContainText("2 submissions");

    await expectNoAccessibilityViolations(page, "recovered slice, complete");
    slice.assertClean("recovered slice");
  });
});
