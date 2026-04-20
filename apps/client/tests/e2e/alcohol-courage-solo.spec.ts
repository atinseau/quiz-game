import {
  playTurnsSolo,
  startSoloAlcoholGame,
  soloTest as test,
  waitForRoundOverlay,
} from "../helpers/alcohol-fixtures";
import { expect } from "../helpers/fixtures";

test.describe("Question de courage — solo flow", () => {
  test("courage overlay appears, accept triggers question input, answer ends round", async ({
    mockApp: page,
  }) => {
    await startSoloAlcoholGame(page, {
      players: ["Alice"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: ["courage"],
    });

    await playTurnsSolo(page, 3);
    await waitForRoundOverlay(page, "courage", 10000);

    // Click "J'accepte !" to accept the challenge
    await page.getByRole("button", { name: "J'accepte !" }).click();

    // A text input should appear for the courage question
    const couragInput = page.getByPlaceholder("Ta réponse...");
    await couragInput.waitFor({ timeout: 5000 });
    await couragInput.fill("ma réponse de courage");
    await couragInput.press("Enter");

    // Verify either a drink alert or result message appears
    await expect(
      page
        .getByText(
          /boit|gorgée|CUL SEC|moitié|défi|Bonne réponse|Mauvaise réponse|a répondu au défi/,
        )
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
