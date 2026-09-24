import { defineConfig, devices } from "@playwright/test";

/**
 * Nested-host compatibility.
 *
 * The game must work beneath the games-site asset prefix
 * `/game-assets/planetary-survey/<version>/`, not at domain root
 * (docs/RELEASE_CONTRACT.md §4). This config serves the production build at
 * exactly that nested path, and `scripts/nested-host-server.mjs` refuses to serve
 * the app anywhere else — so a root-relative asset assumption fails here instead
 * of in production.
 */

const PORT = 5275;
const VERSION = "0.1.0";
const BASE_URL = `http://127.0.0.1:${PORT}/game-assets/planetary-survey/${VERSION}/`;

export default defineConfig({
  testDir: "tests/host",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium-nested",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
        },
      },
    },
  ],

  webServer: {
    command: `node scripts/nested-host-server.mjs`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { PORT: String(PORT), PLANETARY_SURVEY_VERSION: VERSION },
  },
});
