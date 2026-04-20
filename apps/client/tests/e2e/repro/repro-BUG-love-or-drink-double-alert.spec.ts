// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-love-or-drink-double-alert
//
// Repro for: `LoveOrDrink.tsx:38-45` — in solo mode the `cul_sec` branch loops
// over `players` and calls `addDrinkAlert` once per participant. With 2
// participants, 2 fullscreen `DrinkAlert` overlays stack on top of each other
// (both `fixed inset-0 z-[100]`), creating a buggy UX where only the last one
// can be dismissed naturally.
//
// Expected fix: emit a single aggregated alert (e.g. "Alice et Bob boivent —
// cul sec !") instead of one per player, matching the `result === "cul_sec"`
// text already rendered inside the overlay itself.
//
// Marked `test.fail` — will flip to passing once a single alert is emitted.

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
