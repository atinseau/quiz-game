import {
  playTurnsSolo,
  startSoloAlcoholGame,
  soloTest as test,
  waitForRoundOverlay,
} from "../../helpers/alcohol-fixtures";
import { expect } from "../../helpers/fixtures";

test.describe("Alcohol mode — distributeur solo", () => {
  test("distributeur overlay appears after 3 turns with only distributeur enabled", async ({
    mockApp: page,
  }) => {
    await startSoloAlcoholGame(page, {
      players: ["Alice", "Bob"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: ["distributeur"],
    });

    await playTurnsSolo(page, 3);
    await waitForRoundOverlay(page, "distributeur", 15000);

    // If the current player is the distributor, player buttons will be visible.
    // In solo mode, myClerkId from roomStore is null so isDistributor may be false.
    const bobButton = page.getByRole("button", { name: /🍺 Bob/ });
    const hasPlayerButtons = await bobButton
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (hasPlayerButtons) {
      // Click Bob's button 3 times to distribute drinks
      await bobButton.click();
      await bobButton.click();
      await bobButton.click();

      // Verify a drink alert appears with "gorgée"
      await expect(page.getByText(/gorgée/).first()).toBeVisible({
        timeout: 8000,
      });
    } else {
      // Solo mode: distributor check uses roomStore.myClerkId which is null.
      // The overlay is still shown with the distributor's name — verify content.
      await expect(page.getByText("Distributeur !")).toBeVisible();
      await expect(page.getByText(/gorgée/)).toBeVisible();
    }
  });
});
