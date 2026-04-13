import {
  answerCorrectly,
  answerIncorrectly,
  expect,
  nextQuestion,
  setupGame,
  test,
} from "../helpers/fixtures";

test.describe("Classic mode — multiplayer with force point", () => {
  test("turns alternate and force point works", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice", "Bob"], mode: "Classique" });

    // Verify scoreboard shows both players
    const scoreboard = page.locator("div").filter({ hasText: "Scores" }).last();
    await expect(scoreboard).toBeVisible();
    await expect(scoreboard.getByText("Alice")).toBeVisible();
    await expect(scoreboard.getByText("Bob")).toBeVisible();

    // First turn — check player displayed
    const firstPlayer = await page.locator("p.text-2xl").textContent();
    expect(["Alice", "Bob"]).toContain(firstPlayer?.trim());

    // Answer correctly on first turn
    await answerCorrectly(page);
    await expect(page.getByText("Correct")).toBeVisible();
    await nextQuestion(page);

    // Second turn — different player
    const secondPlayer = await page.locator("p.text-2xl").textContent();
    expect(secondPlayer?.trim()).not.toBe(firstPlayer?.trim());

    // Answer wrong
    await answerIncorrectly(page);

    // Force the point
    await expect(
      page.getByRole("button", { name: "Compter le point" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Compter le point" }).click();

    // Feedback should confirm forced point
    await expect(page.getByText(/Point forcé/)).toBeVisible();
  });

  test("end screen shows sorted leaderboard", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice", "Bob"], mode: "Classique" });

    // Play through all 6 questions
    for (let i = 0; i < 6; i++) {
      await answerCorrectly(page);
      await nextQuestion(page);
    }

    // End screen
    await expect(page).toHaveURL(/\/end/);
    await expect(page.getByText("Voici le classement final")).toBeVisible();

    // Both players should appear
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
    await expect(page.getByText("pts").first()).toBeVisible();
  });
});
