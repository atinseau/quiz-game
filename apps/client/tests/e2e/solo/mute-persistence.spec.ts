// Mute toggle on the landing page persists across page reloads via
// localStorage. Uses the default `page` fixture (no alcohol/game setup).

import { expect, test } from "../../helpers/fixtures";

test.describe("Mute toggle — persistence", () => {
  test("mute state persists in localStorage across page reload", async ({
    page,
  }) => {
    await page.route("**/api/question-packs**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"data":[]}',
      }),
    );
    await page.route("**/clerk.*.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.route("**/.well-known/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      }),
    );

    await page.goto("/");

    const muteBtn = page.locator('button[title="Couper le son"]');
    await muteBtn.waitFor({ timeout: 5000 });
    await expect(muteBtn).toBeVisible();

    await muteBtn.click();
    await expect(page.locator('button[title="Activer le son"]')).toBeVisible();

    const storedValue = await page.evaluate(() =>
      localStorage.getItem("quiz-muted"),
    );
    expect(storedValue).toBe("true");

    await page.reload();

    await page
      .locator('button[title="Activer le son"]')
      .waitFor({ timeout: 5000 });
    await expect(page.locator('button[title="Activer le son"]')).toBeVisible();

    await page.locator('button[title="Activer le son"]').click();
    await expect(page.locator('button[title="Couper le son"]')).toBeVisible();

    const storedValueAfter = await page.evaluate(() =>
      localStorage.getItem("quiz-muted"),
    );
    expect(storedValueAfter).toBe("false");
  });
});
