import { expect, test } from "../helpers/fixtures";

test.describe("Mode choice screen", () => {
  test("shows solo and multi-device options", async ({ mockApp: page }) => {
    await page.goto("/play");

    await expect(page.getByText(/Comment tu veux jouer/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Un seul appareil/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Créer une partie/ }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Rejoindre/ })).toBeVisible();
  });

  test("solo button navigates to /play/solo", async ({ mockApp: page }) => {
    await page.goto("/play");
    await page.getByRole("button", { name: /Un seul appareil/ }).click();
    await page.waitForURL("**/play/solo");

    // Should see the pack selection (HomeScreen)
    await expect(page.getByText("Pack Test", { exact: true })).toBeVisible();
  });

  test("join button navigates to /play/join", async ({ mockApp: page }) => {
    await page.goto("/play");
    await page.getByRole("button", { name: /Rejoindre/ }).click();
    await page.waitForURL("**/play/join");

    await expect(page.getByText(/Rejoindre une partie/)).toBeVisible();
    await expect(page.getByPlaceholder("Ex: A3K9F2")).toBeVisible();
  });
});
