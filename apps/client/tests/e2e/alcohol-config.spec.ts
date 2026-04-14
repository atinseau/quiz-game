import {
  addPlayers,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../helpers/fixtures";

test.describe("Alcohol config UI", () => {
  test("mode soirée toggle and config appear after mode selection", async ({
    mockApp: page,
  }) => {
    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice"]);
    await goToModeSelection(page);

    // Mode Soirée card should be visible (disabled by default)
    await expect(page.getByText("Mode Soirée")).toBeVisible();
    await expect(page.getByRole("button", { name: "Désactivé" })).toBeVisible();

    // Activate it
    await page.getByRole("button", { name: "Désactivé" }).click();

    // Config should expand
    await expect(page.getByRole("button", { name: /Activé/ })).toBeVisible();
    await expect(page.getByText("Manche spéciale tous les")).toBeVisible();
    await expect(page.getByText("Manches actives")).toBeVisible();

    // Default frequency should be 5
    // The button "5" should have a different style (active)
    const freq5 = page.getByRole("button", { name: "5", exact: true });
    await expect(freq5).toBeVisible();

    // Rounds should be visible
    await expect(page.getByText("Petit buveur")).toBeVisible();
    await expect(page.getByText("Distributeur")).toBeVisible();
    await expect(page.getByText("Question de courage")).toBeVisible();

    // Phase B rounds should be visible and enabled
    await expect(page.getByText("Conseil du village")).toBeVisible();
    await expect(page.getByText("Love or Drink")).toBeVisible();
    await expect(page.getByText("Cupidon")).toBeVisible();
    await expect(page.getByText("Show Us")).toBeVisible();
    await expect(page.getByText("Smatch or Pass")).toBeVisible();

    // Cul sec toggle should be visible
    await expect(page.getByText("Le perdant boit cul sec")).toBeVisible();
  });

  test("changing frequency updates the display", async ({ mockApp: page }) => {
    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice"]);
    await goToModeSelection(page);

    // Activate mode soirée
    await page.getByRole("button", { name: "Désactivé" }).click();

    // Change frequency to 3
    await page.getByRole("button", { name: "3", exact: true }).click();

    // Text should update
    await expect(page.getByText(/tous les.*3.*tours/)).toBeVisible();
  });

  test("disabling mode soirée hides the config", async ({ mockApp: page }) => {
    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice"]);
    await goToModeSelection(page);

    // Activate
    await page.getByRole("button", { name: "Désactivé" }).click();
    await expect(page.getByText("Manches actives")).toBeVisible();

    // Deactivate
    await page.getByRole("button", { name: /Activé/ }).click();
    await expect(page.getByText("Manches actives")).not.toBeVisible();
  });
});
