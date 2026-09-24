import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser verification for Planetary Survey.
 *
 * The renderer smoke test must run in a real browser: a mocked canvas proves
 * nothing about Babylon initializing on WebGL2. Headless Chromium reaches WebGL2
 * through ANGLE/SwiftShader software rasterization, which exercises the real
 * engine and the real WebGL2 code path.
 *
 * Software rasterization is acceptable evidence that the renderer *works*.
 * It is NOT accepted as evidence of visual quality or performance; those require
 * a real GPU/device observation (docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §2.3,
 * docs/RENDERING_QUALITY_STRATEGY.md §11).
 */
const PORT = 5274;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            // Permit software WebGL in headless Chromium so the WebGL2 baseline
            // path is genuinely exercised rather than skipped.
            "--enable-unsafe-swiftshader",
            "--use-gl=angle",
            "--use-angle=swiftshader",
          ],
        },
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testMatch: /(smoke|accessibility)\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: /(smoke|accessibility)\.spec\.ts/,
    },
  ],

  webServer: {
    // `--host 127.0.0.1` is required: Vite binds IPv6 `localhost` by default, and
    // a health check against 127.0.0.1 would otherwise never come up.
    command: `npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
