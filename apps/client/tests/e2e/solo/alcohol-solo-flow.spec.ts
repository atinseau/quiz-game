import {
  playTurnsSolo,
  ROUND_TITLES,
  startSoloAlcoholGame,
  soloTest as test,
} from "../../helpers/alcohol-fixtures";
import { expect } from "../../helpers/fixtures";

const ANY_ROUND_OR_ALERT = new RegExp(
  [
    ...Object.values(ROUND_TITLES).map((t) =>
      t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ),
    "[Bb]oire une gorgée",
    "cul-sec",
    "moitié du verre",
  ].join("|"),
);

test.describe("Alcohol mode — solo", () => {
  // Only rounds that fully work with a single solo player. Conseil / Cupidon /
  // Smatch-or-Pass / Show-Us / Love-or-Drink require 2+ participants or
  // opposite-gender pairs and are no-ops (or stuck) in 1-player solo.
  const SOLO_COMPATIBLE_ROUNDS = [
    "petit_buveur",
    "distributeur",
    "courage",
  ] as const;

  test("special round triggers after configured frequency", async ({
    mockApp: page,
  }) => {
    await startSoloAlcoholGame(page, {
      players: ["Alice"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: [...SOLO_COMPATIBLE_ROUNDS],
    });

    await playTurnsSolo(page, 3);

    await expect(page.getByText(ANY_ROUND_OR_ALERT).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("drink alert appears for petit buveur", async ({ mockApp: page }) => {
    await startSoloAlcoholGame(page, {
      players: ["Alice", "Bob"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: ["petit_buveur"],
    });

    await playTurnsSolo(page, 3);

    await expect(
      page.getByText(/Petit buveur|[Bb]oire une gorgée/).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
