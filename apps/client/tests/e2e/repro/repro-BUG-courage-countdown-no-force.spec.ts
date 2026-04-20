// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-courage-countdown-no-force
//
// Repro for: `QuestionDeCourage.tsx:34-49` — the 10s countdown in the
// `decision` phase is purely cosmetic. When it reaches 0 the interval is
// cleared but no side effect runs (no auto-refus, no `sendChoice(false)`,
// no overlay transition). "J'accepte !" and "Je passe..." remain clickable
// indefinitely, so a solo player can stall the round forever.
//
// Expected fix: when the countdown hits 0 in solo (or for the current
// decision-maker in multi), auto-trigger `sendChoice(false)` so the round
// progresses and the drink alert is issued, matching the on-screen prompt
// "Accepte le défi ou bois la moitié de ton verre".
//
// Marked `test.fail` — will flip to passing once auto-refus is wired.

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
