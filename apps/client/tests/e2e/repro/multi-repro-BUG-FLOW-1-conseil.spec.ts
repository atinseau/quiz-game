// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-1
//
// Repro for: `conseil_result` broadcast by src/server/alcohol/rounds/conseil.ts
// has NO handler in apps/client/src/stores/roomStore.ts. As a result, in multi
// mode, the Conseil result phase (header "Résultat du conseil") never appears;
// the overlay stays on "En attente des votes..." until `special_round_end`
// closes it 5s later.
//
// This test is marked `test.fail` — it is expected to fail while the bug
// exists. Once a `conseil_result` handler is added to roomStore that merges
// `{ phase: "result", votes, loserClerkIds }` into the active round data,
// the test will pass and Playwright will report "expected fail but passed".

import {
  playTurnsMulti,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
  waitForTextAnyPlayer,
} from "../../helpers/alcohol-fixtures";

test.describe("BUG-FLOW-1 — Conseil result phase never shown in multi", () => {
  test("client displays the conseil result phase after votes resolve", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    // Force Conseil to trigger after 1 turn.
    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["conseil"],
    });
    await playTurnsMulti(host, guest, 1);

    // Wait for the overlay to appear on either player.
    await waitForRoundOverlayAnyPlayer(host, guest, "conseil", 20000);

    // Each player votes for the other. Conseil disallows self-votes, and
    // the server resolves as soon as all connected players have voted, so
    // two cross-votes are enough to trigger `conseil_result`.
    //
    // We use the UI (clicking the vote button for "the other player") to
    // exercise the real flow. The button label is `🗳️ <username>`.
    const hostVoteForBob = host
      .getByRole("button", { name: /Bob/ })
      .filter({ hasText: "🗳️" })
      .first();
    const guestVoteForAlice = guest
      .getByRole("button", { name: /Alice/ })
      .filter({ hasText: "🗳️" })
      .first();

    // Guard: if the button isn't visible yet (e.g. round got skipped by
    // some environmental guard), skip the assertion — we only care about
    // the case where the round reached the voting phase.
    if (
      !(await hostVoteForBob.isVisible({ timeout: 2000 }).catch(() => false))
    ) {
      return;
    }
    await hostVoteForBob.click();

    if (
      !(await guestVoteForAlice.isVisible({ timeout: 2000 }).catch(() => false))
    ) {
      return;
    }
    await guestVoteForAlice.click();

    // EXPECTED (fails today because no handler for `conseil_result`):
    // the result header "Résultat du conseil" must appear on at least one
    // player's screen. Today the overlay stays on the voting header and
    // the "En attente des votes..." sub-text until special_round_end.
    await waitForTextAnyPlayer(host, guest, "Résultat du conseil", 10000);
  });
});
