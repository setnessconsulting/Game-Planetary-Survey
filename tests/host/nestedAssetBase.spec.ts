/**
 * Nested base-path compatibility.
 *
 * Proves the built artifact works beneath the exact games-site asset prefix, with
 * every asset resolved relative to that prefix and no request escaping it. This is
 * the static-host contract from docs/PERFORMANCE_AND_DEVICE_BUDGETS.md §8 and
 * docs/RELEASE_CONTRACT.md §4.
 */

import { expect, test } from "@playwright/test";

const VERSION = "0.1.0";
const PREFIX = `/game-assets/planetary-survey/${VERSION}/`;

test.describe("games-site nested base path", () => {
  test("boots and renders the 3D view from the versioned prefix", async ({ page }) => {
    // Pin the WebGL2 baseline so this test is about the base path, not about which
    // backend the host browser happens to prefer (tests/e2e/smoke.spec.ts owns that).
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
    });

    const failed: string[] = [];
    const escaped: string[] = [];

    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/") && !url.pathname.startsWith(PREFIX)) {
        escaped.push(url.pathname);
      }
      if (response.status() >= 400) {
        failed.push(`${response.status()} ${url.pathname}`);
      }
    });

    await page.goto("./");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planetary Survey");
    await expect(page.getByTestId("renderer-viewport")).toHaveAttribute(
      "data-viewport-state",
      "ready",
      { timeout: 20_000 },
    );
    await expect(page.getByTestId("diag-backend")).toHaveText("webgl2");

    expect(failed, `unexpected failed requests: ${failed.join(", ")}`).toEqual([]);
    expect(
      escaped,
      `these requests escaped the version prefix, so the build assumed domain-root deployment: ${escaped.join(", ")}`,
    ).toEqual([]);
  });

  test("serves the entry document on a direct deep load", async ({ page }) => {
    // A direct load of the nested entry must work without the outer shell.
    const response = await page.goto("./index.html");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Planetary Survey");
  });

  test("does not serve the game at domain root", async ({ request }) => {
    // The host deliberately refuses root serving, which is what makes the escaped
    // request assertion above meaningful.
    const response = await request.get(`http://127.0.0.1:5275/planetary-survey/`);
    expect(response.status()).toBe(404);
  });
});
