// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-love-or-drink-double-alert
//
// Regression guard for: `LoveOrDrink.tsx:38-45` used to loop over `players` in
// solo `cul_sec`, emitting one `DrinkAlert` per participant. Two participants →
// two fullscreen overlays (`fixed inset-0 z-[100]`) stacked, only the top one
// dismissable. Fix (FIX #7, 11a72cc) emits a single aggregated alert.
//
// This test asserts a single DrinkAlert is visible at a time in solo cul_sec.

import {
  countDrinkAlerts,
  expect,
  playTurnsSolo,
  startSoloAlcoholGame,
  soloTest as test,
  waitForRoundOverlay,
} from "../../helpers/alcohol-fixtures";

test.describe("BUG-love-or-drink-double-alert — solo cul_sec stacks 2 fullscreen overlays", () => {
  test("solo cul_sec shows a single aggregated drink alert", async ({
    mockApp: page,
  }) => {
    test.slow();

    await startSoloAlcoholGame(page, {
      players: ["Alice", "Bob"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: ["love_or_drink"],
    });

    await playTurnsSolo(page, 3);
    await waitForRoundOverlay(page, "love_or_drink");

    // Trigger the cul_sec branch via the UI. `LoveOrDrink` always renders
    // the choice buttons for the solo player (isParticipant is true).
    await page.getByRole("button", { name: /Cul sec/ }).click();

    // Give `addDrinkAlert` time to push every alert into the store before
    // we count the rendered overlays. `setTimeout(endActiveRound, 5000)`
    // hasn't fired yet — both alerts should be on screen together.
    await page.waitForTimeout(500);

    const count = await countDrinkAlerts(page);
    // EXPECTED: at most 1 aggregated alert on screen. Today: 2 stacked.
    expect(count).toBeLessThanOrEqual(1);
  });
});
