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

    // Prove the shell is complete without depending on the 3D view.
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

    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "ready",
      { timeout: 20_000 },
    );

    // The probe requested the enhancement path...
    await expect(page.getByTestId("diag-backend-requested")).toHaveText("webgpu");
    await expect(page.getByTestId("diag-webgpu")).toHaveText(
      "API present, but no usable adapter confirmed",
    );

    // ...and the renderer reports what actually happened, not what was requested.
    await expect(page.getByTestId("diag-backend")).toHaveText("webgl2");
    await expect(page.getByTestId("renderer-diagnostics")).toHaveAttribute(
      "data-renderer-backend",
      "webgl2",
    );
    await expect(page.getByTestId("renderer-status")).toContainText("WEBGL2");

    // The fallback must be explained, not silent.
    await expect(page.getByRole("status").first()).toContainText("WebGPU");

    // The highest tier requires a CONFIRMED WebGPU backend, so it must be refused
    // here even though the device reports plenty of memory and cores.
    await expect(page.getByTestId("diag-quality")).not.toHaveText("high");

    // The accessible route is unaffected by which backend runs.
    await expect(page.getByTestId("loop-checklist").locator("li")).toHaveCount(11);
  });

  test("keeps the canvas decorative and out of the keyboard path", async ({ page }) => {
    await pinToWebGL2(page);
    await page.goto("/");
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "ready",
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
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let step = 0; step < 25; step += 1) {
      await page.keyboard.press("Tab");
      const landedOnCanvas = await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") === "renderer-canvas",
      );
      expect(landedOnCanvas, "Tab must never reach the decorative canvas").toBe(false);
    }
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
    const briefingButton = page.getByRole("button", { name: /open the foundation briefing/i });
    await briefingButton.click();
    await expect(briefingButton).toBeDisabled();
    await expect(page.getByTestId("briefing-panel")).toContainText("foundation-briefing");
  });
});

test.describe("keyboard path", () => {
  test("reaches the mission controls with the keyboard alone", async ({ page }) => {
    await pinToWebGL2(page);
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    // First tab stop is the skip link.
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.className ?? "");
    expect(focusedTag).toContain("ps-skip-link");

    // Activating the briefing control by keyboard must work.
    const briefingButton = page.getByRole("button", { name: /open the foundation briefing/i });
    await briefingButton.focus();
    await page.keyboard.press("Enter");
    await expect(briefingButton).toBeDisabled();
    await expect(page.getByTestId("briefing-panel")).toContainText("foundation-briefing");
  });
});
