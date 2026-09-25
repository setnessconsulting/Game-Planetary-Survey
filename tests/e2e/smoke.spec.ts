/**
 * Real-browser renderer smoke test.
 *
 * This is the evidence that Babylon initializes and owns a live frame loop in a
 * REAL browser on the required WebGL2 baseline. A mocked canvas in a unit test
 * proves nothing about this, which is why GAME-364 requires a browser test — and
 * why mocks are never accepted as renderer evidence
 * (docs/ACCEPTANCE_EVIDENCE_MATRIX.md, "Renderer evidence").
 *
 * The frame counter is read from a DOM attribute the RENDERER writes, not from
 * React state. Seeing it advance is simultaneously proof that the frame loop runs
 * and proof that React is not driving it.
 *
 * Backend determinism: headless Chromium's WebGPU support varies by version and
 * flags, so each test PINS the environment it claims to cover instead of assuming
 * one. Otherwise a test named "WebGL2 baseline" could silently be exercising the
 * WebGPU path and prove nothing.
 */

import { expect, test, type Page } from "@playwright/test";

/** Hide the WebGPU API, so the required WebGL2 baseline is the only option. */
async function pinToWebGL2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
  });
}

/**
 * Expose a WebGPU API that cannot produce an adapter.
 *
 * This is not a synthetic edge case: browsers ship `navigator.gpu` while still
 * failing to hand out an adapter (blocklisted driver, software-only fallback). It
 * is exactly the situation in which reporting the probe's request as the running
 * backend would lie to the learner.
 */
async function pinToUnusableWebGPU(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: {
        requestAdapter: async () => null,
        getPreferredCanvasFormat: () => "bgra8unorm",
        wgslLanguageFeatures: new Set<string>(),
      },
    });
  });
}

/**
 * Does this environment actually provide WebGL2?
 *
 * Not every engine in CI can: headless Firefox and WebKit on Linux provide no WebGL2
 * (no GPU and no software GL), whereas Chromium reaches it through ANGLE/SwiftShader.
 * That is a property of the machine running the test, not of the game, so the
 * renderer assertions branch on this measurement instead of assuming an engine list.
 * Both branches assert a real contract, so neither can silently pass.
 */
async function hasWebGL2(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2");
      if (!context) return false;
      const lose = (canvas as HTMLCanvasElement & { loseContext?: () => void }).loseContext;
      if (typeof lose === "function") lose.call(canvas);
      return true;
    } catch {
      return false;
    }
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
      if (
        typeof contextId === "string" &&
        (contextId.startsWith("webgl") || contextId === "webgpu")
      ) {
        return null;
      }
      return (original as (...args: unknown[]) => unknown).call(this, contextId, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test.describe("planetary survey shell", () => {
  test("the required WebGL2 baseline is genuinely present in the reference engine", async ({
    page,
  }, testInfo) => {
    // Chromium is the reference engine for the WebGL2 baseline, and it reaches WebGL2
    // through ANGLE/SwiftShader. If that ever stops being true here, the renderer
    // assertions below would quietly start exercising the degraded branch instead of
    // the baseline, so this fails loudly rather than letting coverage evaporate.
    test.skip(
      testInfo.project.name !== "chromium",
      "Chromium is the WebGL2 reference engine; other engines lack software WebGL in CI.",
    );
    await page.goto("/");
    expect(
      await hasWebGL2(page),
      "the WebGL2 baseline must remain available in the reference engine",
    ).toBe(true);
  });

  test("boots, renders the shell, and drives a live frame loop on the WebGL2 baseline", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await pinToWebGL2(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planetary Survey");

    if (await hasWebGL2(page)) {
      // The renderer must actually reach the ready state in a real browser.
      await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
        "data-viewport-state",
        "ready",
        { timeout: 20_000 },
      );

      // WebGPU is pinned off above, so this is the required WebGL2 baseline.
      await expect(page.getByTestId("renderer-status")).toContainText("WEBGL2");
      await expect(page.getByTestId("diag-backend")).toHaveText("webgl2");
      await expect(page.getByTestId("diag-backend-requested")).toHaveText("webgl2");

      const diagnostics = page.getByTestId("renderer-diagnostics");
      await expect(diagnostics).toHaveAttribute("data-renderer-backend", "webgl2");

      // Prove the frame loop is genuinely running (and therefore owned by Babylon).
      const first = Number(await diagnostics.getAttribute("data-renderer-frames"));
      await page.waitForTimeout(1200);
      const second = Number(await diagnostics.getAttribute("data-renderer-frames"));
      expect(second).toBeGreaterThan(first);

      // Load a mission and confirm camera/scale diagnostics update.
      await page.getByTestId("load-mission-survey-001-sizes").click();
      await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
        "data-scale-mode",
        "comparativeNonLiteral",
      );
      await expect(page.getByTestId("diag-camera")).toHaveText("systemComparison");
      await expect(diagnostics).toHaveAttribute("data-renderer-camera", "systemComparison");
      await page.getByTestId("select-target-mars").click();
      await expect(page.getByTestId("diag-scale")).toHaveText("bodyRelative");
      await expect(page.getByTestId("reset-camera")).toBeVisible();
    } else {
      // This environment has no WebGL2, so the contract under test is the honest
      // degradation one. Asserting it here keeps the branch meaningful instead of
      // skipping, which would hide a regression in the degraded path.
      await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
        "data-viewport-state",
        "unavailable",
        { timeout: 20_000 },
      );
      await expect(page.getByTestId("renderer-overlay")).toContainText(
        "cannot start the 3D survey view",
      );
      await expect(page.getByTestId("diag-backend")).toHaveText("unavailable");
    }

    // Prove the shell is complete and usable either way.
    await expect(page.getByTestId("briefing-panel")).toBeVisible();
    await expect(page.getByTestId("evidence-notebook")).toBeVisible();
    await expect(page.getByTestId("loop-checklist").locator("li")).toHaveCount(11);

    expect(pageErrors, `unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
    expect(consoleErrors, `unexpected console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("falls back to the WebGL2 baseline when WebGPU is exposed but unusable", async ({
    page,
  }) => {
    await pinToUnusableWebGPU(page);
    await page.goto("/");

    // The probe requested the enhancement path in every environment...
    await expect(page.getByTestId("diag-backend-requested")).toHaveText("webgpu");
    await expect(page.getByTestId("diag-webgpu")).toHaveText(
      "API present, but no usable adapter confirmed",
    );

    if (await hasWebGL2(page)) {
      await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
        "data-viewport-state",
        "ready",
        { timeout: 20_000 },
      );

      // ...and the renderer reports what actually happened, not what was requested.
      await expect(page.getByTestId("diag-backend")).toHaveText("webgl2");
      await expect(page.getByTestId("renderer-diagnostics")).toHaveAttribute(
        "data-renderer-backend",
        "webgl2",
      );
      await expect(page.getByTestId("renderer-status")).toContainText("WEBGL2");

      // The highest tier requires a CONFIRMED backend, so it must be refused here even
      // though the device may report plenty of memory and cores.
      await expect(page.getByTestId("diag-quality")).not.toHaveText("high");
    } else {
      // WebGPU is exposed but unusable AND there is no WebGL2. The app only discovers
      // this by trying, so the honest terminal state is "failed" (with an explanation)
      // rather than "unavailable", which means "we knew before trying". Either way it
      // must not report a backend as in use, because nothing is rendering.
      await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
        "data-viewport-state",
        /failed|unavailable/,
        { timeout: 20_000 },
      );
      await expect(page.getByTestId("renderer-overlay")).toBeVisible();
      await expect(page.getByTestId("diag-backend")).toHaveText("unavailable");

      // The failed attempt must not be reported as a working backend.
      await expect(page.getByTestId("diag-quality")).not.toHaveText("high");
    }

    // The fallback or the refusal must be explained, not silent.
    await expect(page.getByRole("status").first()).toContainText("WebGPU");

    // The accessible route is unaffected by which backend runs.
    await expect(page.getByTestId("loop-checklist").locator("li")).toHaveCount(11);
  });

  test("keeps the canvas decorative and out of the keyboard path", async ({ page }) => {
    await pinToWebGL2(page);
    await page.goto("/");
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      /ready|unavailable/,
      { timeout: 20_000 },
    );

    const canvas = page.getByTestId("renderer-canvas");
    await expect(canvas).toHaveAttribute("aria-hidden", "true");

    // Babylon makes the canvas focusable by setting tabindex="1". The renderer
    // deliberately neutralises that. `tabindex="-1"` is still correct: it takes the
    // canvas out of the tab order, which is the actual requirement.
    const tabindex = await canvas.getAttribute("tabindex");
    expect(
      tabindex === null || tabindex === "-1",
      `the canvas must not be in the tab order (tabindex=${tabindex})`,
    ).toBe(true);

    // Behavioural proof, not just an attribute: tabbing must never land on it.
    //
    // The focus log is collected in the page, and read once at the end. Doing a
    // round-trip per press instead made this test 25 browser round-trips against a
    // live software-rasterized frame loop, which turned a 3-second test into a
    // 60-second timeout whenever a sibling worker was rendering — a measurement of
    // the machine rather than of the tab order.
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      (window as unknown as { __psFocusLog: (string | null)[] }).__psFocusLog = [];
      document.addEventListener(
        "focusin",
        (event) => {
          const log = (window as unknown as { __psFocusLog: (string | null)[] }).__psFocusLog;
          log.push((event.target as Element | null)?.getAttribute("data-testid") ?? null);
        },
        { capture: true },
      );
    });

    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press("Tab");
    }

    const focusLog = await page.evaluate(
      () => (window as unknown as { __psFocusLog: (string | null)[] }).__psFocusLog,
    );
    expect(focusLog.length).toBeGreaterThan(0);
    expect(focusLog, "Tab must never reach the decorative canvas").not.toContain(
      "renderer-canvas",
    );
  });

  test("degrades honestly when no 3D backend is available, and stays usable", async ({ page }) => {
    await pinToNoRenderer(page);
    await page.goto("/");

    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "unavailable",
    );
    await expect(page.getByTestId("renderer-overlay")).toContainText(
      "cannot start the 3D survey view",
    );
    await expect(page.getByTestId("diag-backend")).toHaveText("unavailable");

    // The accessible route must be fully intact without a renderer.
    await expect(page.getByTestId("briefing-panel")).toBeVisible();
    await expect(page.getByTestId("evidence-notebook")).toBeVisible();
    await expect(page.getByTestId("loop-checklist").locator("li")).toHaveCount(11);

    // And the mission loop must still function with no renderer at all.
    const missionButton = page.getByTestId("load-mission-survey-001-sizes");
    await missionButton.click();
    await expect(missionButton).toBeDisabled();
    await expect(page.getByTestId("briefing-panel")).toContainText("survey-001-sizes");

    await page.getByTestId("select-target-mars").click();
    await page.getByTestId("select-instrument-radiusSounder").click();
    await page.getByTestId("measure-button").click();
    await expect(page.getByTestId("measurement-result")).toBeVisible();
    await page.getByTestId("capture-evidence").click();
    await expect(page.getByTestId("notebook-table")).toContainText("Mars");
    await expect(page.getByTestId("notebook-table")).toContainText("Radius sounder");
  });
});

test.describe("keyboard path", () => {
  test("reaches the mission controls with the keyboard alone", async ({ page }) => {
    await pinToWebGL2(page);
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // First tab stop is the skip link. This is a real cross-engine assertion: plain
    // links are not in WebKit's sequential focus order, so it only holds because the
    // link carries an explicit tabindex (src/ui/App.tsx).
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.className ?? "");
    expect(focusedTag).toContain("ps-skip-link");

    // Activating a mission load control by keyboard must work.
    const missionButton = page.getByTestId("load-mission-survey-001-sizes");
    await missionButton.focus();
    await page.keyboard.press("Enter");
    await expect(missionButton).toBeDisabled();
    await expect(page.getByTestId("briefing-panel")).toContainText("survey-001-sizes");
  });

  test("the skip link actually moves focus past the repeated header", async ({ page }) => {
    await pinToWebGL2(page);
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    // A skip link that only scrolls is not a bypass mechanism; focus must land in the
    // main region, otherwise the learner's next Tab returns to the header they were
    // trying to skip.
    const focusedId = await page.evaluate(() => document.activeElement?.id ?? null);
    expect(focusedId).toBe("main");
  });
});
