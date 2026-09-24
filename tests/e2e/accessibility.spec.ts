/**
 * Automated accessibility coverage.
 *
 * IMPORTANT: this is coverage, not sign-off. Automated checks may never be
 * reported as accessibility approval (docs/ACCESSIBILITY.md §6). Manual
 * keyboard, screen-reader, low-vision, and target-age review remain human
 * evidence owned by PS-07 / PS-12 / PS-14.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("automated accessibility", () => {
  test("@a11y has no detectable WCAG A/AA violations on the shell", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations,
      results.violations
        .map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length} nodes)`)
        .join("\n"),
    ).toEqual([]);
  });

  test("@a11y has no detectable violations after the mission advances", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open the foundation briefing/i }).click();
    await expect(page.getByTestId("briefing-panel")).toContainText("foundation-briefing");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations,
      results.violations.map((violation) => `${violation.id}: ${violation.help}`).join("\n"),
    ).toEqual([]);
  });

  test("@a11y exposes a visible focus indicator", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.keyboard.press("Tab");

    const outline = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return null;
      const styles = getComputedStyle(element as Element);
      return {
        width: styles.outlineWidth,
        style: styles.outlineStyle,
        color: styles.outlineColor,
      };
    });

    expect(outline).not.toBeNull();
    expect(outline?.style).not.toBe("none");
    expect(Number.parseFloat(outline?.width ?? "0")).toBeGreaterThan(0);
  });

  test("@a11y reflows without horizontal overflow at 320 CSS px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "primary content must not scroll horizontally at 320px").toBeLessThanOrEqual(1);

    await expect(page.getByTestId("briefing-panel")).toBeVisible();
    await expect(page.getByTestId("evidence-notebook")).toBeVisible();
  });

  test("@a11y stays usable at 200% text scaling", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "200% text scaling must not create horizontal scrolling").toBeLessThanOrEqual(1);

    // A required control must remain reachable and clickable at 200%.
    const briefingButton = page.getByRole("button", { name: /open the foundation briefing/i });
    await expect(briefingButton).toBeVisible();
    await briefingButton.click();
    await expect(briefingButton).toBeDisabled();
  });

  test("@a11y honours reduced motion and keeps every route available", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("heading", { level: 1 }).waitFor();

    const motionToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--ps-motion-base").trim(),
    );
    expect(motionToken).toBe("1ms");

    // Reduced motion must not remove evidence routes.
    await expect(page.getByTestId("evidence-notebook")).toBeVisible();
    await expect(page.getByTestId("loop-checklist").locator("li")).toHaveCount(11);
  });

  test("@a11y needs no color to read the loop state", async ({ page }) => {
    await page.goto("/");
    const firstStep = page.getByTestId("loop-checklist").locator("li").first();
    // A text marker and a text label carry the state, independent of color.
    await expect(firstStep).toContainText("[");
    await expect(firstStep).toContainText("Status:");
  });
});
