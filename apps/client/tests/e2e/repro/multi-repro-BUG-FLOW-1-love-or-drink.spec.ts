// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-1
//
// Repro for: `love_or_drink_result` broadcast by
// src/server/alcohol/rounds/love-or-drink.ts has NO handler in
// apps/client/src/stores/roomStore.ts. In multi mode, once a participant
// sends `love_or_drink_choice`, the server emits `love_or_drink_result` but
// the client never merges `{ choice, players }` into the active round data,
// so the LoveOrDrink component never renders the result text
// (e.g. "🍺 Cul sec !" on cul_sec, "💋 Bisou ! Trop mignon !" on bisou).
//
// Marked `test.fail` — will pass once roomStore handles `love_or_drink_result`.

import {
  playTurnsMulti,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
  waitForTextAnyPlayer,
} from "../../helpers/alcohol-fixtures";

test.describe("BUG-FLOW-1 — Love or Drink result phase never shown in multi", () => {
  test("client displays the love_or_drink result phase after a choice is sent", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    // Force Love or Drink to trigger after 1 turn.
    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["love_or_drink"],
    });
    await playTurnsMulti(host, guest, 1);

    await waitForRoundOverlayAnyPlayer(host, guest, "love_or_drink", 20000);

    // The server picks the 2 lowest-scorers as participants (ties: earliest
    // insertion order). With frequency=1 and fresh scores, both Alice and
    // Bob are participants. Either can send the choice; we use host.
    //
    // We bypass the UI and send `love_or_drink_choice: "cul_sec"` raw
    // through the tracked WS — mirrors the `sendStartGameWithAlcohol`
    // pattern from alcohol-fixtures.ts.
    await host.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test globals
      const activeWs = (window as any).__testActiveWs as WebSocket;
      if (activeWs?.readyState === WebSocket.OPEN) {
        // biome-ignore lint/suspicious/noExplicitAny: test globals
        const OrigWs = (window as any).__OriginalWebSocket;
        OrigWs.prototype.send.call(
          activeWs,
          JSON.stringify({
            type: "love_or_drink_choice",
            choice: "cul_sec",
          }),
        );
      }
    });

    // EXPECTED (fails today because no handler): the "🍺 Cul sec !" result
    // text must appear on at least one player's screen. Currently neither
    // page updates — both keep showing either the choice buttons (for the
    // two participants) or "En attente..." (for non-participants).
    await waitForTextAnyPlayer(host, guest, "🍺 Cul sec !", 10000);
  });
});
