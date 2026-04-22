// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-courage-countdown-no-force
//
// Regression guard for: `QuestionDeCourage.tsx:34-49` used to have a purely
// cosmetic 10s countdown in the `decision` phase — when it hit 0 the interval
// cleared but no side effect ran, letting the round stall forever. Fix (FIX #6,
// 31b9d98) wires auto-refus: countdown hitting 0 auto-triggers `sendChoice(false)`.
//
// This test waits past 10s and asserts the decision buttons disappear (round
// progressed). Failure means auto-refus regressed.

import {
  expect,
  playTurnsSolo,
  startSoloAlcoholGame,
  soloTest as test,
  waitForRoundOverlay,
} from "../../helpers/alcohol-fixtures";

test.describe("BUG-courage-countdown-no-force — solo countdown doesn't auto-force refus", () => {
  test("solo courage forces refus when countdown reaches 0", async ({
    mockApp: page,
  }) => {
    test.slow();

    await startSoloAlcoholGame(page, {
      players: ["Alice"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: ["courage"],
    });

    await playTurnsSolo(page, 3);
    await waitForRoundOverlay(page, "courage");

    // Wait for the 10s countdown to expire (+ 1s margin).
    await page.waitForTimeout(11_000);

    // EXPECTED: neither decision button remains visible — an auto-refus
    // should have fired, closing the decision phase. Today both buttons
    // are still there, waiting for a click that may never come.
    const accept = page.getByRole("button", { name: "J'accepte !" });
    const refuse = page.getByRole("button", { name: /Je passe/ });

    const acceptVisible = await accept.isVisible().catch(() => false);
    const refuseVisible = await refuse.isVisible().catch(() => false);

    expect(acceptVisible || refuseVisible).toBe(false);
  });
});
