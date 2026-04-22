import {
  answerIncorrectly,
  expect,
  setupGame,
  test,
} from "../../helpers/fixtures";

test.describe("Voleur mode — steal mechanics", () => {
  test("steal succeeds after wrong answer", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice", "Bob"], mode: "Voleur" });

    // Answer wrong to trigger steal zone
    await answerIncorrectly(page);
    await expect(page.getByText("Mauvaise réponse")).toBeVisible();

    // Steal zone should be visible with other player's name
    await expect(
      page.getByText("Quelqu'un a répondu plus vite ?"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Bob" })).toBeVisible();

    // "Compter le point" should NOT be visible in voleur mode
    await expect(
      page.getByRole("button", { name: "Compter le point" }),
    ).not.toBeVisible();

    // Initiate steal
    await page.getByRole("button", { name: "Bob" }).click();

    // Confirm steal
    await expect(
      page.getByRole("button", { name: "Valider le vol" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Refuser" })).toBeVisible();

    await page.getByRole("button", { name: "Valider le vol" }).click();

    // Verify steal feedback
    await expect(page.getByText(/Bob vole.*pt.*Alice/)).toBeVisible();
  });

  test("steal refused penalizes stealer", async ({ mockApp: page }) => {
    await setupGame(page, { players: ["Alice", "Bob"], mode: "Voleur" });

    // Answer wrong
    await answerIncorrectly(page);

    // Initiate steal by Bob
    await page.getByRole("button", { name: "Bob" }).click();

    // Refuse the steal
    await page.getByRole("button", { name: "Refuser" }).click();

    // Verify failed steal feedback
    await expect(page.getByText(/Vol raté.*Bob perd/)).toBeVisible();
  });
});
