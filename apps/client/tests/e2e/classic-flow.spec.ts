import {
  answerCorrectly,
  answerIncorrectly,
  expect,
  nextQuestion,
  setupGame,
  test,
} from "../helpers/fixtures";

test.describe("Classic mode — full solo game flow", () => {
  test("complete a solo game from pack selection to end screen", async ({
    mockApp: page,
  }) => {
    await setupGame(page, { players: ["Alice"], mode: "Classique" });

    // Verify we're on the game page
    await expect(page).toHaveURL(/\/game/);

    // First question — answer correctly
    await answerCorrectly(page);
    await expect(page.getByText("Correct")).toBeVisible();

    // Score should show in solo header (SoloScore component)
    await nextQuestion(page);

    // Second question — answer wrong
    await answerIncorrectly(page);
    await expect(page.getByText("Mauvaise réponse")).toBeVisible();

    // "Compter le point" should be visible in classic mode
    await expect(
      page.getByRole("button", { name: "Compter le point" }),
    ).toBeVisible();

    await nextQuestion(page);

    // Complete remaining 4 questions
    for (let i = 0; i < 4; i++) {
      await answerCorrectly(page);
      await nextQuestion(page);
    }

    // Should be on end screen
    await expect(page).toHaveURL(/\/end/);
    await expect(page.getByText("Partie terminee")).toBeVisible();
    await expect(page.getByText("Ton score final")).toBeVisible();
    await expect(page.getByText("pts")).toBeVisible();

    // Click "Nouvelle partie" to reset
    await page.getByRole("button", { name: "Nouvelle partie" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
