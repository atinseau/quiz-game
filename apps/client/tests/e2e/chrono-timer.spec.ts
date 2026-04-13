import {
  answerCorrectly,
  expect,
  nextQuestion,
  setupGame,
  test,
} from "../helpers/fixtures";

test.describe("Chrono mode — timer and timeout", () => {
  test("timer is visible and counting down", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Contre la montre" });

    // Timer badge should be visible
    await expect(page.getByText(/\d+s/)).toBeVisible();

    // Progress bar should be visible
    await expect(page.getByRole("progressbar")).toBeVisible();
  });

  test("answering stops the timer", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Contre la montre" });

    // Answer correctly
    await answerCorrectly(page);
    await expect(page.getByText("Correct")).toBeVisible();

    // Timer and progress bar should disappear after answer
    await expect(page.getByRole("progressbar")).not.toBeVisible();
  });

  test("timeout penalizes with -0.5 pts", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Contre la montre" });

    // Wait for timeout (15 seconds + buffer)
    await page.getByText("Temps écoulé").waitFor({ timeout: 20000 });

    // Should show timeout feedback
    await expect(page.getByText("Temps écoulé")).toBeVisible();

    // "Compter le point" should NOT appear in chrono mode
    await expect(
      page.getByRole("button", { name: "Compter le point" }),
    ).not.toBeVisible();

    // "Question suivante" should appear
    await expect(
      page.getByRole("button", { name: "Question suivante" }),
    ).toBeVisible();
  });

  test("timer resets on next question", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice"], mode: "Contre la montre" });

    await answerCorrectly(page);
    await nextQuestion(page);

    // Timer should restart
    await expect(page.getByText(/\d+s/)).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
  });
});
