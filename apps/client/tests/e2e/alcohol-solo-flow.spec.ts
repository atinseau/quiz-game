import {
  addPlayers,
  answerCorrectly,
  answerIncorrectly,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../helpers/fixtures";

test.describe("Alcohol mode — solo", () => {
  test("special round triggers after configured frequency", async ({
    mockApp: page,
  }) => {
    test.slow();
    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice"]);
    await goToModeSelection(page);

    // Enable alcohol mode
    await page.getByRole("button", { name: "Désactivé" }).click();

    // Set frequency to 3
    await page.getByRole("button", { name: "3", exact: true }).click();

    // Select classic mode and start
    await page.getByRole("button", { name: /Classique/ }).click();
    await page.waitForURL("**/game");

    // Answer 3 questions to trigger a special round
    for (let q = 0; q < 3; q++) {
      try {
        await answerCorrectly(page);
      } catch {
        await answerIncorrectly(page);
      }
      await page.waitForTimeout(500);

      // Check if special round appeared before clicking next
      const hasOverlay = await page
        .getByText(/Petit buveur|Distributeur|Question de courage/)
        .isVisible()
        .catch(() => false);
      if (hasOverlay) {
        // Special round triggered — test passes
        expect(hasOverlay).toBe(true);
        return;
      }

      // Click next question if available
      const nextBtn = page.getByRole("button", {
        name: "Question suivante",
      });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
      await page.waitForTimeout(500);

      // Check again after next question
      const hasOverlay2 = await page
        .getByText(/Petit buveur|Distributeur|Question de courage/)
        .isVisible()
        .catch(() => false);
      if (hasOverlay2) {
        expect(hasOverlay2).toBe(true);
        return;
      }
    }

    // Check one more time for the overlay or drink alert
    let specialRoundSeen = false;
    for (let i = 0; i < 10; i++) {
      const overlay = await page
        .getByText(/Petit buveur|Distributeur|Question de courage/)
        .isVisible()
        .catch(() => false);
      const drinkAlert = await page
        .getByText(/boit une gorgée|gorgée|CUL SEC|moitié du verre/)
        .isVisible()
        .catch(() => false);
      if (overlay || drinkAlert) {
        specialRoundSeen = true;
        break;
      }
      await page.waitForTimeout(500);
    }

    expect(specialRoundSeen).toBe(true);
  });

  test("drink alert appears for petit buveur", async ({ mockApp: page }) => {
    test.slow();
    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice", "Bob"]);
    await goToModeSelection(page);

    // Enable alcohol with only petit_buveur, frequency 3
    await page.getByRole("button", { name: "Désactivé" }).click();
    await page.getByRole("button", { name: "3", exact: true }).click();

    // Disable all rounds except petit_buveur
    await page.getByText("Distributeur").click();
    await page.getByText("Question de courage").click();
    await page.getByText("Conseil du village").click();
    await page.getByText("Love or Drink").click();
    await page.getByText("Cupidon").click();
    await page.getByText("Show Us").click();
    await page.getByText("Smatch or Pass").click();

    // Start classic mode
    await page.getByRole("button", { name: /Classique/ }).click();
    await page.waitForURL("**/game");

    // Answer 3 questions to trigger petit buveur
    for (let q = 0; q < 3; q++) {
      try {
        await answerCorrectly(page);
      } catch {
        await answerIncorrectly(page);
      }
      await page.waitForTimeout(500);
      const nextBtn = page.getByRole("button", {
        name: "Question suivante",
      });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
      await page.waitForTimeout(500);
    }

    // Should see petit buveur overlay or drink alert
    let seen = false;
    for (let i = 0; i < 15; i++) {
      const overlay = await page
        .getByText("Petit buveur")
        .isVisible()
        .catch(() => false);
      const alert = await page
        .getByText(/boit une gorgée/)
        .isVisible()
        .catch(() => false);
      if (overlay || alert) {
        seen = true;
        break;
      }
      await page.waitForTimeout(500);
    }

    expect(seen).toBe(true);
  });
});
