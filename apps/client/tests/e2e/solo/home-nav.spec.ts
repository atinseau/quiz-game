import {
  addPlayers,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../../helpers/fixtures";

test.describe("Home page navigation and setup", () => {
  test("pack cards display with name, description, and question count", async ({
    mockApp: page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Pack Test", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Pack de test avec questions variées"),
    ).toBeVisible();
    await expect(page.getByText("6 questions")).toBeVisible();

    await expect(
      page.getByRole("heading", { name: "Pack Test 2" }),
    ).toBeVisible();
    await expect(page.getByText("3 questions")).toBeVisible();
  });

  test("search filters packs", async ({ mockApp: page }) => {
    const searchInput = page.getByPlaceholder("Rechercher un pack...");
    await searchInput.fill("Test 2");

    // Only Pack Test 2 should be visible
    await expect(
      page.getByRole("button", { name: /Pack Test 2/ }),
    ).toBeVisible();
    // Pack Test (without 2) should be hidden — check that the first pack's heading is gone
    await expect(
      page.getByRole("heading", { name: "Pack Test", exact: true }),
    ).not.toBeVisible();

    // Clear search
    await searchInput.clear();
    await expect(
      page.getByRole("heading", { name: "Pack Test", exact: true }),
    ).toBeVisible();
  });

  test("player management works", async ({ mockApp: page }) => {
    await selectPack(page);

    // Continue button should be disabled
    await expect(
      page.getByRole("button", { name: "Choisir le mode de jeu" }),
    ).toBeDisabled();
    await expect(page.getByText("Ajoute au moins un joueur")).toBeVisible();

    // Add player
    await addPlayers(page, ["Alice"]);
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choisir le mode de jeu" }),
    ).toBeEnabled();

    // Remove player
    await page
      .locator("button")
      .filter({ has: page.locator("svg.size-3\\.5") })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Choisir le mode de jeu" }),
    ).toBeDisabled();
  });

  test("back navigation works between steps", async ({ mockApp: page }) => {
    await selectPack(page);
    await addPlayers(page, ["Alice"]);

    // Go back to packs
    await page.getByRole("button", { name: "Changer de pack" }).click();
    await expect(page.getByText("Choisis ton pack de questions")).toBeVisible();

    // Go forward again
    await selectPack(page);
    await addPlayers(page, ["Alice"]);
    await goToModeSelection(page);

    // Go back to players
    await page.getByRole("button", { name: "Retour aux joueurs" }).click();
    await expect(page.getByText("Qui joue")).toBeVisible();
  });

  test("Voleur mode requires 2+ players", async ({ mockApp: page }) => {
    await selectPack(page);
    await addPlayers(page, ["Alice"]);
    await goToModeSelection(page);

    // Voleur should not be visible
    await expect(page.getByRole("button", { name: /Classique/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Contre la montre/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Voleur/ }),
    ).not.toBeVisible();

    // Go back and add second player
    await page.getByRole("button", { name: "Retour aux joueurs" }).click();
    await addPlayers(page, ["Bob"]);
    await goToModeSelection(page);

    // Voleur should now be visible
    await expect(page.getByRole("button", { name: /Voleur/ })).toBeVisible();
  });
});
