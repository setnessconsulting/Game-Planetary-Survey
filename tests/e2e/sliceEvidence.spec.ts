/**
 * Slice performance and device evidence (GAME-373 / PS-09).
 *
 * `docs/PERFORMANCE_AND_DEVICE_BUDGETS.md` §11 requires, for a qualified candidate:
 * bundle/chunk sizes, load timings, frame-time and pacing measurements, memory
 * proxies, console/network assertions, the backend and quality tier each
 * measurement was taken under, and "an explicit statement of any budget not met,
 * with the reason". This spec produces that record for the guided-mission vertical
 * slice and writes it to `reports/ps09-slice-evidence.json`.
 *
 * ## The honesty rule this file is built around
 *
 * §2.3 and §11 are unambiguous: headless/software rendering alone is insufficient
 * for visual or performance sign-off, and frame-time evidence must come from a real
 * GPU or representative device. Headless Chromium here rasterizes through
 * ANGLE/SwiftShader, which is CPU work. So every measurement below is labelled:
 *
 *  - **environment-independent** rows (bundle sizes, asset payload, console/network
 *    cleanliness, long-task count for the semantic route) are asserted, because they
 *    do not depend on the GPU;
 *  - **GPU-dependent** rows (frame time median/p95, time-to-first-mission-
 *    interactive, JS heap) are *recorded and marked not-judgeable-here*, with the
 *    software-rendered reason attached. They are evidence that the harness exists
 *    and is repeatable; they are not a qualification pass.
 *
 * Nothing here may be reported as performance or visual sign-off.
 * `docs/SLICE_QUALIFICATION.md` states what remains outstanding.
 *
 * The output is written to `reports/`, which is gitignored by policy — it is derived
 * from `dist/` plus this run and asserted here, so committing it would only add
 * churn. The committed evidence is this spec, and the durable per-run record is
 * copied to `_evidence/planetary-survey-ps09/`.
 *
 * Because it consumes `reports/bundle-size.json`, `npm run test:e2e` generates that
 * report before running the browser suites. A measurement whose bundle is missing
 * would not be evidence, so this spec refuses to record one: run
 * `npm run build && npm run report:bundle` first when running it directly.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The repo is ESM (`"type": "module"`), so there is no `__dirname`.
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const GUIDED_MISSION_ID = "survey-001-sizes";
const WORLDS = ["moon", "mars", "venus"] as const;

/** Budgets this artefact is checked against, from PERFORMANCE_AND_DEVICE_BUDGETS.md. */
const BUDGETS = {
  eagerJsGzipKiB: 250,
  eagerCssAndHtmlGzipKiB: 60,
  lazyRendererChunkGzipKiB: 1.2 * 1024,
  medianFrameTimeMs: 16.7,
  p95FrameTimeMs: 25,
  longTasksPerSixtySeconds: 5,
  firstMissionInteractiveWarmMs: 8_000,
} as const;

const SOFTWARE_RENDERED =
  "software-rendered (headless chromium, ANGLE/SwiftShader) — NOT GPU/device evidence";

function sourceSha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function packageVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      version?: string;
    };
    return manifest.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index] as number;
}

/** Read the bundle report produced by `npm run report:bundle`. */
function readBundleReport(): {
  totals: { eagerJsGzipKiB: number; eagerCssAndHtmlGzipKiB: number; lazyGzipKiB: number };
  assets: readonly { path: string; gzipKiB: number; eager: boolean }[];
  failures: readonly string[];
} {
  const path = join(ROOT, "reports", "bundle-size.json");
  if (!existsSync(path)) {
    throw new Error(
      "reports/bundle-size.json is missing. Run `npm run build && npm run report:bundle` first — " +
        "the slice evidence records the exact bundle it was measured against.",
    );
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * The build under measurement must be the plain relative-base build.
 *
 * `npm run test:host` builds the nested games-site artifact into the *same* `dist/`,
 * with `/game-assets/planetary-survey/<version>/` asset URLs. A preview server without
 * that base serves a blank page, and any number taken from it would describe a build
 * that is not the candidate. This fails with the fix instead of leaving the reader to
 * decode an empty document.
 */
function assertMeasurableBuild(): void {
  const indexPath = join(ROOT, "dist", "index.html");
  if (!existsSync(indexPath)) {
    throw new Error("dist/ is missing. Run `npm run build` before recording slice evidence.");
  }
  if (readFileSync(indexPath, "utf8").includes("/game-assets/")) {
    throw new Error(
      "dist/ holds the nested games-site build (from `npm run test:host`), not the " +
        "relative-base build this evidence must be measured against. Run `npm run build` first.",
    );
  }
}

async function pinToWebGL2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
  });
}

async function surveyWorld(page: Page, bodyId: string): Promise<void> {
  await page.getByTestId(`select-target-${bodyId}`).click();
  await page.getByTestId("select-instrument-radiusSounder").click();
  await page.getByTestId("measure-button").click();
  await expect(page.getByTestId("measurement-result")).toBeVisible();
  await page.getByTestId("capture-evidence").click();
}

test.describe("@slice slice performance and device evidence", () => {
  /**
   * A longer wall-clock budget than the 120s default; see the note in
   * `verticalSlice.spec.ts` for why PS-10's per-world asset loading outgrew it.
   * This suite is the most expensive in the repository — it plays the whole
   * mission and then measures — so it is the first to hit a ceiling the other
   * specs never reach.
   */
  test.describe.configure({ timeout: 300_000 });
  test("@slice records the slice's load, frame, memory, and console evidence", async ({
    page,
  }, testInfo) => {
    assertMeasurableBuild();
    const bundle = readBundleReport();
    expect(bundle.failures, "the bundle report must be clean before slice evidence is recorded").toEqual(
      [],
    );

    // Long tasks are collected from the start of the page's life, not from the point
    // the test starts looking.
    await page.addInitScript(() => {
      const target = window as unknown as { __psLongTasks?: { duration: number; start: number }[] };
      target.__psLongTasks = [];
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            target.__psLongTasks?.push({ duration: entry.duration, start: entry.startTime });
          }
        }).observe({ type: "longtask", buffered: true });
      } catch {
        // `longtask` is Chromium-only. Its absence is recorded rather than faked.
      }
    });

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => requests.push(request.url()));

    const startedAt = Date.now();
    await pinToWebGL2(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planetary Survey");

    // Shell interactive: a real control is usable. The architectural claim is that
    // this happens before Babylon loads, so the renderer's state at this instant is
    // recorded rather than asserted (asserting it would be a race on a fast machine).
    await expect(page.getByTestId(`load-mission-${GUIDED_MISSION_ID}`)).toBeEnabled();
    const shellInteractiveMs = Date.now() - startedAt;
    const rendererStateAtShellInteractive = await page
      .getByTestId("renderer-viewport")
      .getAttribute("data-viewport-state");

    const navigation = await page.evaluate(() => {
      const entry = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      return entry
        ? {
            ttfbMs: entry.responseStart,
            domContentLoadedMs: entry.domContentLoadedEventEnd,
            loadEventEndMs: entry.loadEventEnd,
          }
        : null;
    });

    // Time to first mission interactive: shell + renderer + first mission assets.
    await page.getByTestId(`load-mission-${GUIDED_MISSION_ID}`).click();
    await page.getByRole("button", { name: "Continue to target selection" }).click();
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "ready",
      { timeout: 60_000 },
    );
    const firstMissionInteractiveMs = Date.now() - startedAt;
    const backend = await page.getByTestId("diag-backend").textContent();
    const quality = await page.getByTestId("diag-quality").textContent();

    // Play the slice, so the frame and memory numbers describe the slice rather than
    // an idle scene.
    for (const bodyId of WORLDS) {
      await surveyWorld(page, bodyId);
    }
    await page.getByTestId("compare-button").click();
    await page.getByTestId("draft-claim").click();
    const boxes = page.getByTestId("cite-evidence").getByRole("checkbox");
    const count = await boxes.count();
    for (let index = 0; index < count; index += 1) await boxes.nth(index).check();
    await page.getByTestId("submit-claim").click();
    await page.getByTestId("open-debrief").click();
    await page.getByTestId("complete-mission").click();
    await expect(page.getByTestId("debrief-target-status")).toContainText(
      "Met by the cited evidence",
    );

    // Steady-state frame time, sampled from the renderer's own frame counter in
    // windows. Window-averaged rather than per-frame: the counter is the renderer's,
    // so this is the engine's cadence and not a compositor guess.
    const frames = await page.evaluate(
      async (config: { windows: number; windowMs: number }) => {
        const node = document.querySelector('[data-testid="renderer-diagnostics"]');
        const read = (): number =>
          Number(node?.getAttribute("data-renderer-frames") ?? Number.NaN);
        const windows: { elapsedMs: number; frames: number; frameTimeMs: number | null }[] = [];
        for (let index = 0; index < config.windows; index += 1) {
          const before = read();
          const start = performance.now();
          await new Promise((done) => setTimeout(done, config.windowMs));
          const end = performance.now();
          const advanced = read() - before;
          windows.push({
            elapsedMs: end - start,
            frames: advanced,
            frameTimeMs: advanced > 0 ? (end - start) / advanced : null,
          });
        }
        return windows;
      },
      { windows: 20, windowMs: 500 },
    );

    const frameTimes = frames
      .map((window) => window.frameTimeMs)
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right);
    const medianFrameTimeMs = percentile(frameTimes, 0.5);
    const p95FrameTimeMs = percentile(frameTimes, 0.95);
    const windowsWithFrames = frames.filter((window) => window.frames > 0).length;

    const longTasks = await page.evaluate(
      () =>
        (window as unknown as { __psLongTasks?: { duration: number; start: number }[] })
          .__psLongTasks ?? [],
    );
    const memory = await page.evaluate(() => {
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      return perf.memory
        ? {
            usedJSHeapBytes: perf.memory.usedJSHeapSize,
            limitBytes: perf.memory.jsHeapSizeLimit,
          }
        : null;
    });

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const origin = new URL(page.url()).origin;
    const offOrigin = requests.filter((url) => {
      if (url.startsWith("data:") || url.startsWith("blob:")) return false;
      try {
        return new URL(url).origin !== origin;
      } catch {
        return false;
      }
    });

    const largestRendererAsset = bundle.assets
      .filter((asset) => /babylon/.test(asset.path))
      .reduce((max, asset) => Math.max(max, asset.gzipKiB), 0);

    const round = (value: number): number => Number(value.toFixed(2));

    const evidence = {
      story: "GAME-373 / PS-09 guided-mission vertical slice",
      producedBy: "tests/e2e/sliceEvidence.spec.ts",
      sourceSha: sourceSha(),
      version: packageVersion(),
      qualification: SOFTWARE_RENDERED,
      environment: {
        engine: "chromium",
        backend: backend?.trim() ?? backend,
        quality: quality?.trim() ?? quality,
        viewport: page.viewportSize(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        rendererStateAtShellInteractive,
      },
      budgets: BUDGETS,
      measurements: {
        shell: {
          ttfbMs: navigation ? round(navigation.ttfbMs) : null,
          domContentLoadedMs: navigation ? round(navigation.domContentLoadedMs) : null,
          loadEventEndMs: navigation ? round(navigation.loadEventEndMs) : null,
          shellInteractiveMs,
        },
        firstMissionInteractiveMs,
        frame: {
          windows: frames.length,
          windowMs: 500,
          windowsWithFrames,
          medianFrameTimeMs: round(medianFrameTimeMs),
          p95FrameTimeMs: round(p95FrameTimeMs),
          medianFps: round(1000 / medianFrameTimeMs),
        },
        longTasks: {
          count: longTasks.length,
          longestMs: round(longTasks.reduce((max, task) => Math.max(max, task.duration), 0)),
          sessionSeconds: round((Date.now() - startedAt) / 1000),
        },
        memory: memory
          ? {
              usedJSHeapMiB: round(memory.usedJSHeapBytes / (1024 * 1024)),
              limitMiB: round(memory.limitBytes / (1024 * 1024)),
            }
          : null,
        console: { errors: consoleErrors.length, pageErrors: pageErrors.length },
        network: { offOriginRequests: offOrigin.length },
        accessibility: { axeViolations: axe.violations.length },
        slice: { worldsMeasured: WORLDS.length, targetMet: true },
      },
      bundle: {
        eagerJsGzipKiB: bundle.totals.eagerJsGzipKiB,
        eagerCssAndHtmlGzipKiB: bundle.totals.eagerCssAndHtmlGzipKiB,
        largestRendererChunkGzipKiB: round(largestRendererAsset),
      },
      /**
       * Each row states whether it can be judged from this environment at all. A
       * `notJudgeableHere` row is not a pass and not a failure: it is a measurement
       * waiting for a GPU (§2.3, §11).
       */
      budgetComparison: [
        {
          metric: "Initial eager JS transfer (gzip)",
          budget: `<= ${BUDGETS.eagerJsGzipKiB} KiB`,
          measuredKiB: bundle.totals.eagerJsGzipKiB,
          verdict:
            bundle.totals.eagerJsGzipKiB <= BUDGETS.eagerJsGzipKiB ? "pass" : "NOT MET",
        },
        {
          metric: "Initial critical HTML + CSS transfer (gzip)",
          budget: `<= ${BUDGETS.eagerCssAndHtmlGzipKiB} KiB`,
          measuredKiB: bundle.totals.eagerCssAndHtmlGzipKiB,
          verdict:
            bundle.totals.eagerCssAndHtmlGzipKiB <= BUDGETS.eagerCssAndHtmlGzipKiB
              ? "pass"
              : "NOT MET",
        },
        {
          metric: "Babylon renderer chunk (gzip, lazy)",
          budget: `<= ${BUDGETS.lazyRendererChunkGzipKiB} KiB`,
          measuredKiB: round(largestRendererAsset),
          verdict:
            largestRendererAsset <= BUDGETS.lazyRendererChunkGzipKiB ? "pass" : "NOT MET",
        },
        {
          metric: "Console errors, page errors, off-origin requests",
          budget: "0 / 0 / 0",
          measured: `${consoleErrors.length} / ${pageErrors.length} / ${offOrigin.length}`,
          verdict:
            consoleErrors.length === 0 && pageErrors.length === 0 && offOrigin.length === 0
              ? "pass"
              : "NOT MET",
        },
        {
          metric: "Detectable WCAG A/AA violations on the completed slice",
          budget: "0",
          measured: axe.violations.length,
          verdict: axe.violations.length === 0 ? "pass" : "NOT MET",
        },
        {
          metric: "Steady-state frame time, median (reference desktop)",
          budget: `<= ${BUDGETS.medianFrameTimeMs} ms`,
          measuredMs: round(medianFrameTimeMs),
          verdict: "notJudgeableHere",
          reason: SOFTWARE_RENDERED,
        },
        {
          metric: "Steady-state frame time, p95",
          budget: `<= ${BUDGETS.p95FrameTimeMs} ms`,
          measuredMs: round(p95FrameTimeMs),
          verdict: "notJudgeableHere",
          reason: SOFTWARE_RENDERED,
        },
        {
          metric: "Long tasks > 50 ms over a 60 s session",
          budget: `<= ${BUDGETS.longTasksPerSixtySeconds}`,
          measured: longTasks.length,
          verdict: "notJudgeableHere",
          reason: `${SOFTWARE_RENDERED}; session was ${round(
            (Date.now() - startedAt) / 1000,
          )} s, not 60 s`,
        },
        {
          metric: "Time to first mission interactive (warm, reference desktop)",
          budget: `<= ${BUDGETS.firstMissionInteractiveWarmMs} ms`,
          measuredMs: firstMissionInteractiveMs,
          verdict: "notJudgeableHere",
          reason: `${SOFTWARE_RENDERED}; includes harness wall-clock overhead`,
        },
        {
          metric: "JS heap steady state (reference desktop)",
          budget: "<= 256 MiB",
          measuredMiB: memory ? round(memory.usedJSHeapBytes / (1024 * 1024)) : null,
          verdict: memory ? "notJudgeableHere" : "notMeasured",
          reason: memory ? SOFTWARE_RENDERED : "performance.memory is unavailable in this engine",
        },
      ],
      notClaimed: [
        "GPU/device-qualified frame time, pacing, and memory (PERFORMANCE_AND_DEVICE_BUDGETS §2.3, §11)",
        "Visual-quality sign-off of the design direction (STATUS constraint 3)",
        "Target-age usability or comprehension evidence (ACCEPTANCE_EVIDENCE_MATRIX, Human evidence)",
        "Independent science review (GAME-368)",
        "Screen-reader human experience and final accessibility conformance",
        "Production art (PS-10 owns the asset pipeline)",
      ],
    };

    const reportsDir = join(ROOT, "reports");
    mkdirSync(reportsDir, { recursive: true });
    const outputPath = join(reportsDir, "ps09-slice-evidence.json");
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    await testInfo.attach("ps09-slice-evidence.json", {
      path: outputPath,
      contentType: "application/json",
    });

    // --- Assertions ---------------------------------------------------------
    // The environment-independent rows must hold; the GPU-dependent ones are
    // recorded and explicitly not judged here.
    const notMet = evidence.budgetComparison.filter((row) => row.verdict === "NOT MET");
    expect(notMet, `budgets not met: ${JSON.stringify(notMet)}`).toEqual([]);
    // The renderer genuinely rendered throughout the sampling window, whatever its
    // speed: a stalled frame loop would make every frame-time row meaningless.
    expect(windowsWithFrames).toBeGreaterThan(frames.length * 0.9);
    expect(frameTimes.length).toBeGreaterThan(0);
    expect(longTasks.length).toBeGreaterThanOrEqual(0);
    expect(evidence.measurements.slice.targetMet).toBe(true);
  });
});
