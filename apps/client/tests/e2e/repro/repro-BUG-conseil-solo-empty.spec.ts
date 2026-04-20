// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-conseil-solo
//
// Repro for: in solo mode (`myClerkId === null`), `Conseil.tsx:41-43` falls back
// to `otherPlayers = allPlayers` instead of filtering out the local player. With
// a single solo player (Alice), `allPlayers` is `[Alice]`, so `otherPlayers` is
// `[Alice]` and the only vote button is a self-vote. The "conseil" result then
// deterministically designates the only player — unusable and not fun.
//
// Expected fix: either skip the round when fewer than 2 distinct voting targets
// exist, or randomize the designee so the round has any game value.
//
// Marked `test.fail` — will flip to passing once the component no longer shows
// a self-vote button in a 1-player solo conseil round.
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
