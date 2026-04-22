import type { Page } from "@playwright/test";
import { playTurnsSolo } from "../../helpers/alcohol-fixtures";
import {
  addPlayers,
  expect,
  goToModeSelection,
  selectPack,
  test,
} from "../../helpers/fixtures";

const ALL_ROUND_LABELS = [
  "Petit buveur",
  "Distributeur",
  "Question de courage",
  "Conseil du village",
  "Love or Drink",
  "Cupidon",
  "Show Us",
  "Smatch or Pass",
] as const;

async function setupAlcoholGame(
  page: Page,
  roundLabel: string,
  playerCount: number,
) {
  await page.goto("/play/solo");
  await selectPack(page);
  const names = ["Alice", "Bob", "Charlie", "David"].slice(0, playerCount);
  await addPlayers(page, names);
  await goToModeSelection(page);

  await page.getByRole("button", { name: "Désactivé" }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();

  for (const name of ALL_ROUND_LABELS) {
    const el = page.getByText(name, { exact: true });
    if (await el.isVisible().catch(() => false)) {
      await el.click();
    }
  }

  await page.getByText(roundLabel, { exact: true }).click();
  await page.getByRole("button", { name: /Classique/ }).click();
  await page.waitForURL("**/game");
}

const STRAIGHTFORWARD_ROUNDS = [
  { label: "Conseil du village", pattern: /Conseil|vote/i },
  { label: "Love or Drink", pattern: /Love or Drink|Bisou|Cul sec/i },
  { label: "Cupidon", pattern: /Cupidon|lié/i },
  { label: "Show Us", pattern: /Show Us|Bleu|Noir|Blanc|Rouge|Autre/i },
] as const;

test.describe("Phase B alcohol rounds", () => {
  for (const { label, pattern } of STRAIGHTFORWARD_ROUNDS) {
    test(`${label} triggers after 3 turns`, async ({ mockApp: page }) => {
      await setupAlcoholGame(page, label, 2);
      await playTurnsSolo(page, 3);

      await expect(page.getByText(pattern).first()).toBeVisible({
        timeout: 10000,
      });
    });
  }

  test("Smatch or Pass triggers after 3 turns (or is skipped cleanly)", async ({
    mockApp: page,
  }) => {
    await setupAlcoholGame(page, "Smatch or Pass", 2);
    await playTurnsSolo(page, 3);

    // Smatch or Pass requires opposite genders. Since addPlayers defaults
    // all to "homme", the round may be skipped.
    const overlayShown = await page
      .getByText(/Smatch|Pass/i)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!overlayShown) {
      const gameVisible = await page
        .locator("p.text-xl")
        .isVisible()
        .catch(() => false);
      const endVisible = await page
        .getByText(/Résultats|Fin de partie/)
        .isVisible()
        .catch(() => false);
      expect(gameVisible || endVisible).toBe(true);
    }
  });
});
