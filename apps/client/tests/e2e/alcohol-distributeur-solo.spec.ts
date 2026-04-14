import {
  addPlayers,
  answerCorrectly,
  answerIncorrectly,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../helpers/fixtures";

test.describe("Alcohol mode — distributeur solo", () => {
  test("distributeur overlay appears after 3 turns with only distributeur enabled", async ({
    mockApp: page,
  }) => {
    test.slow();

    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice", "Bob"]);
    await goToModeSelection(page);

    // Enable alcohol mode
    await page.getByRole("button", { name: "Désactivé" }).click();

    // Set frequency to 3
    await page.getByRole("button", { name: "3", exact: true }).click();

    // Disable all rounds except distributeur
    await page.getByText("Petit buveur").click();
    await page.getByText("Question de courage").click();
    await page.getByText("Conseil du village").click();
    await page.getByText("Love or Drink").click();
    await page.getByText("Cupidon").click();
    await page.getByText("Show Us").click();
    await page.getByText("Smatch or Pass").click();

    // Start classic mode
    await page.getByRole("button", { name: /Classique/ }).click();
    await page.waitForURL("**/game");

    // Answer 3 questions to trigger the distributeur special round
    for (let q = 0; q < 3; q++) {
      try {
        await answerCorrectly(page);
      } catch {
        await answerIncorrectly(page);
      }
      await page.waitForTimeout(300);

      const nextBtn = page.getByRole("button", { name: "Question suivante" });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
      await page.waitForTimeout(300);
    }

    // Wait for the Distributeur overlay to appear
    let distributeurVisible = false;
    for (let i = 0; i < 20; i++) {
      const visible = await page
        .getByText("Distributeur !")
        .isVisible()
        .catch(() => false);
      if (visible) {
        distributeurVisible = true;
        break;
      }
      await page.waitForTimeout(500);
    }

    expect(distributeurVisible).toBe(true);

    // If the current player is the distributor, player buttons will be visible
    // In solo mode, myClerkId from roomStore is null so isDistributor may be false
    const hasPlayerButtons = await page
      .getByRole("button", { name: /🍺 Bob/ })
      .isVisible()
      .catch(() => false);

    if (hasPlayerButtons) {
      // Click Bob's button 3 times to distribute drinks
      const bobButton = page.getByRole("button", { name: /🍺 Bob/ });
      await bobButton.click();
      await page.waitForTimeout(200);
      await bobButton.click();
      await page.waitForTimeout(200);
      await bobButton.click();
      await page.waitForTimeout(200);

      // Verify a drink alert appears with "gorgée"
      let drinkAlertVisible = false;
      for (let i = 0; i < 15; i++) {
        const alert = await page
          .getByText(/gorgée/)
          .isVisible()
          .catch(() => false);
        if (alert) {
          drinkAlertVisible = true;
          break;
        }
        await page.waitForTimeout(500);
      }

      expect(drinkAlertVisible).toBe(true);
    } else {
      // Solo mode: distributor check uses roomStore.myClerkId which is null.
      // The overlay is still shown with the distributor's name.
      // Verify the overlay content is correct.
      await expect(page.getByText("Distributeur !")).toBeVisible();
      // The overlay should mention gorgée(s) in the description
      await expect(page.getByText(/gorgée/)).toBeVisible();
    }
  });
});
