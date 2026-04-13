import {
  answerCorrectly,
  answerIncorrectly,
  expect,
  nextQuestion,
  setupGame,
  test,
} from "../helpers/fixtures";

test.describe("Combo scoring system", () => {
  test("consecutive correct answers build combo", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Classique" });

    // Q1 correct — +1pt, no combo text
    await answerCorrectly(page);
    await expect(page.getByText("Correct ! +1 pt")).toBeVisible();
    await nextQuestion(page);

    // Q2 correct — combo x2 (+1.5pts)
    await answerCorrectly(page);
    await expect(page.getByText(/Combo x2/)).toBeVisible();
    await nextQuestion(page);

    // Q3 correct — combo x3 (+2pts)
    await answerCorrectly(page);
    await expect(page.getByText(/Combo x3/)).toBeVisible();
  });

  test("wrong answer resets combo", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Classique" });

    // Build combo
    await answerCorrectly(page);
    await nextQuestion(page);
    await answerCorrectly(page);
    await expect(page.getByText(/Combo x2/)).toBeVisible();
    await nextQuestion(page);

    // Break combo
    await answerIncorrectly(page);
    await expect(page.getByText("Mauvaise réponse")).toBeVisible();
    await nextQuestion(page);

    // Next correct should restart at +1pt (no combo)
    await answerCorrectly(page);
    await expect(page.getByText("Correct ! +1 pt")).toBeVisible();
  });
});
