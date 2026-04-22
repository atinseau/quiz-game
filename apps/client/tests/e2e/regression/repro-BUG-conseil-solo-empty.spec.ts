// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-conseil-solo
//
// Regression guard for: in solo mode (`myClerkId === null`), `Conseil.tsx:41-43`
// used to fall back to `otherPlayers = allPlayers`, producing a self-vote button
// on 1-player solo. Fix filters out the local player; with a single player, the
// round is skipped (no valid voting targets).
//
// This test asserts that a 1-player solo conseil is either skipped or offers no
// self-vote button. Failure means the filter regressed.
//
// Note on the solo pattern: `checkTrigger` is hit inside `nextQuestion()` in
// `gameStore.ts`, so with `frequency=3` the round only fires on the transition
// from question #3 to #4. `playTurnsSolo` already handles this — it plays each
// turn until either the overlay appears or the next-question button was pressed.

import {
  expect,
  playTurnsSolo,
  ROUND_TITLES,
  startSoloAlcoholGame,
  soloTest as test,
} from "../../helpers/alcohol-fixtures";

test.describe("BUG-conseil-solo — Conseil is unusable with 1 solo player", () => {
  test("Conseil is skipped in solo with a single player", async ({
    mockApp: page,
  }) => {
    test.slow();

    await startSoloAlcoholGame(page, {
      players: ["Alice"],
      mode: "Classique",
      frequency: 3,
      enabledRounds: ["conseil"],
    });

    await playTurnsSolo(page, 3);

    // After turn 3, `gameStore` hits `checkTrigger` which returns "conseil".
    // EXPECTED behavior: the game should detect there aren't enough players
    // and skip the round, letting the game advance to question 4. Today the
    // Conseil overlay pops up with a self-vote button for Alice — unusable.
    //
    // Assertion: the Conseil overlay must never appear within 3s of the
    // trigger window. Today it does → this `not.toBeVisible` fails → test.fail
    // is satisfied. Once the guard is in place the overlay stays hidden, the
    // assertion passes, and Playwright reports "expected fail but passed".
    await expect(
      page.getByText(ROUND_TITLES.conseil, { exact: true }).first(),
    ).not.toBeVisible({ timeout: 3000 });
  });
});
