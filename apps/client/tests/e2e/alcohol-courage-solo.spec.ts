import {
  addPlayers,
  answerCorrectly,
  answerIncorrectly,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../helpers/fixtures";

test.describe("Question de courage — solo flow", () => {
  test("courage overlay appears, accept triggers question input, answer ends round", async ({
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

    // Disable petit_buveur and distributeur — keep only courage
    await page.getByText("Petit buveur").click();
    await page.getByText("Distributeur").click();

    // Start classic mode
    await page.getByRole("button", { name: /Classique/ }).click();
    await page.waitForURL("**/game");

    // Answer 3 questions to trigger a courage round
    for (let q = 0; q < 3; q++) {
      try {
        await answerCorrectly(page);
      } catch {
        await answerIncorrectly(page);
      }
      await page.waitForTimeout(300);

      // Check for courage overlay before clicking next
      const hasOverlay = await page
        .getByText("Question de courage !")
        .isVisible()
        .catch(() => false);
      if (hasOverlay) break;

      const nextBtn = page.getByRole("button", { name: "Question suivante" });
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
      }
      await page.waitForTimeout(300);
    }

    // Wait for the courage overlay to appear
    await page.getByText("Question de courage !").waitFor({ timeout: 8000 });

    // Verify the overlay text
    await expect(page.getByText("Question de courage !")).toBeVisible();

    // Click "J'accepte !" to accept the challenge
    await page.getByRole("button", { name: "J'accepte !" }).click();

    // A text input should appear for the courage question
    const couragInput = page.getByPlaceholder("Ta réponse...");
    await couragInput.waitFor({ timeout: 5000 });
    await couragInput.fill("ma réponse de courage");
    await couragInput.press("Enter");

    // Verify either a drink alert or result message appears
    const resultVisible = await Promise.race([
      page
        .getByText(
          /boit|gorgée|CUL SEC|moitié|défi|Bonne réponse|Mauvaise réponse/,
        )
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByText(/a répondu au défi/)
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false),
    ]);

    expect(resultVisible).toBe(true);
  });
});
