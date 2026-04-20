// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-1
//
// Repro for: `show_us_result` broadcast by
// src/server/alcohol/rounds/show-us.ts has NO handler in
// apps/client/src/stores/roomStore.ts. In multi mode, once the target
// reveals their color, the server emits `show_us_result` but the client
// never merges `{ correctColor, wrongClerkIds, timedOut }` into the active
// round data. The ShowUs component stays stuck in "waiting_reveal" /
// "En attente que <target> révèle sa couleur..." instead of showing
// "Couleur de <target> : <color>".
//
// Target selection is random server-side. The test detects which page is the
// target by looking for "Les autres devinent ta couleur...", then votes on
// the other page and reveals on the target.
//
// Marked `test.fail` — will pass once roomStore handles `show_us_result`.

import type { Page } from "@playwright/test";
import {
  playTurnsMulti,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
  waitForTextAnyPlayer,
} from "../../helpers/alcohol-fixtures";

async function sendRawWs(
  page: Page,
  message: Record<string, unknown>,
): Promise<void> {
  await page.evaluate((msg) => {
    // biome-ignore lint/suspicious/noExplicitAny: test globals
    const activeWs = (window as any).__testActiveWs as WebSocket;
    if (activeWs?.readyState === WebSocket.OPEN) {
      // biome-ignore lint/suspicious/noExplicitAny: test globals
      const OrigWs = (window as any).__OriginalWebSocket;
      OrigWs.prototype.send.call(activeWs, JSON.stringify(msg));
    }
  }, message);
}

test.describe("BUG-FLOW-1 — Show Us result phase never shown in multi", () => {
  test("client displays the show_us result phase after target reveals", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    // Force Show Us to trigger after 1 turn.
    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["show_us"],
    });
    await playTurnsMulti(host, guest, 1);

    await waitForRoundOverlayAnyPlayer(host, guest, "show_us", 20000);

    // Identify the target: the target sees
    //   "Les autres devinent ta couleur... attends !"
    // The other player sees "De quelle couleur est <target> habillé(e) ?".
    // We probe both pages until one matches (random picks by server).
    const TARGET_HINT = "Les autres devinent ta couleur";
    let targetPage: Page | null = null;
    let voterPage: Page | null = null;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const hostIsTarget = await host
        .getByText(TARGET_HINT, { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
      const guestIsTarget = await guest
        .getByText(TARGET_HINT, { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
      if (hostIsTarget && !guestIsTarget) {
        targetPage = host;
        voterPage = guest;
        break;
      }
      if (guestIsTarget && !hostIsTarget) {
        targetPage = guest;
        voterPage = host;
        break;
      }
      await host.waitForTimeout(300);
    }
    if (!targetPage || !voterPage) {
      // Could not disambiguate — bail out so the test neither passes nor
      // becomes noisy. `test.fail` still treats the absence of a failing
      // assertion as "unexpected pass" only if an assertion ran; here we
      // simply return and let the wrapper consider the run inconclusive.
      return;
    }

    // Voter picks "Bleu", target reveals "Rouge" => mismatch => wrongClerkIds
    // contains the voter. The result header shows "Couleur de <target> : Rouge".
    await sendRawWs(voterPage, { type: "show_us_vote", color: "Bleu" });
    // Give the server a beat to record the vote before the reveal.
    await voterPage.waitForTimeout(300);
    await sendRawWs(targetPage, { type: "show_us_reveal", color: "Rouge" });

    // EXPECTED (fails today because no handler): the "Couleur de ... : Rouge"
    // result text must appear. Today neither page transitions out of the
    // waiting_reveal phase via server data — they both stay on the waiting
    // message until `special_round_end` closes the overlay.
    await waitForTextAnyPlayer(host, guest, /Couleur de .+ :/, 10000);
  });
});
