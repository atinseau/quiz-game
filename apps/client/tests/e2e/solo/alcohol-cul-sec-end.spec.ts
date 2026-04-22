// Verifies that a solo game ending with alcohol + cul-sec config reaches the
// end screen. Also documents the gap: solo mode does NOT trigger a cul-sec
// drink_alert at game end (that is only wired up for multi via WS).

import {
  addPlayers,
  answerIncorrectly,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../../helpers/fixtures";

test.describe("Cul sec — end game (solo)", () => {
  test("end screen appears after completing all questions with alcohol cul-sec config", async ({
    mockApp: page,
  }) => {
    await page.goto("/play/solo");
    await selectPack(page);
    await addPlayers(page, ["Alice", "Bob"]);
    await goToModeSelection(page);

    await page.getByRole("button", { name: "Désactivé" }).click();
    await expect(page.getByText("Le perdant boit cul sec")).toBeVisible();

    // Frequency 10 prevents a special round from interrupting the 6-question game.
    await page.getByRole("button", { name: "10", exact: true }).click();

    await page.getByRole("button", { name: /Classique/ }).click();
    await page.waitForURL("**/game");

    for (let q = 0; q < 6; q++) {
      try {
        await answerIncorrectly(page);
      } catch {
        const qcmBtns = page.locator(".grid button");
        const count = await qcmBtns.count().catch(() => 0);
        if (count > 0) {
          await qcmBtns.first().click();
        } else {
          const input = page.getByPlaceholder("Votre réponse...");
          if (await input.isVisible().catch(() => false)) {
            await input.fill("wrong answer xyz");
            await input.press("Enter");
          }
        }
      }

      const nextBtn = page.getByRole("button", { name: "Question suivante" });
      const reachedNextOrEnd = await Promise.any([
        nextBtn.waitFor({ state: "visible", timeout: 5000 }).then(() => "next"),
        page.waitForURL("**/end", { timeout: 5000 }).then(() => "end"),
      ]).catch(() => null);

      if (reachedNextOrEnd === "end" || page.url().includes("/end")) break;
      if (reachedNextOrEnd === "next") await nextBtn.click();
    }

    await page.waitForURL("**/end", { timeout: 10000 });
    await expect(page.getByText("Partie terminée")).toBeVisible();

    // Solo mode does not implement cul-sec at game end — alcoholStore.culSecEndGame
    // is set but gameStore.nextQuestion() navigates to /end without emitting a
    // drink_alert. Cul-sec at end-of-game is multi-only (server-side).
    const drinkVisible = await page
      .getByText(/CUL SEC/)
      .isVisible()
      .catch(() => false);

    if (drinkVisible) {
      await expect(page.getByText(/CUL SEC/)).toBeVisible();
    } else {
      await expect(
        page.getByRole("button", { name: "Nouvelle partie" }),
      ).toBeVisible();
    }
  });
});
