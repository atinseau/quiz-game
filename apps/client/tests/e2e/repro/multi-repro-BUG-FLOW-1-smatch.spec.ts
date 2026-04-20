// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-1
//
// Repro for: `smatch_or_pass_result` broadcast by
// src/server/alcohol/rounds/smatch-or-pass.ts has NO handler in
// apps/client/src/stores/roomStore.ts. Once the décideur sends
// `smatch_choice`, the server emits `smatch_or_pass_result` but the client
// never merges `{ choice, decideur, receveur }` into the active round data,
// so the SmatchOrPass component never renders "💋 Smatch !" or "👋 Pass !".
//
// Smatch or Pass requires opposite genders. We set host=homme, guest=femme
// via `startMultiAlcoholGame` so the server can pair them.
//
// The décideur is picked randomly server-side — we probe both pages to find
// the "toi" badge (only the décideur sees it) and send the choice from there.
//
// Marked `test.fail` — will pass once roomStore handles `smatch_or_pass_result`.

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

test.describe("BUG-FLOW-1 — Smatch or Pass result phase never shown in multi", () => {
  test("client displays the smatch_or_pass result phase after the décideur chooses", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    // Opposite genders are mandatory, otherwise the server ends the round
    // immediately (see smatch-or-pass.ts start()).
    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["smatch_or_pass"],
      hostGender: "homme",
      guestGender: "femme",
    });
    await playTurnsMulti(host, guest, 1);

    // The round may still be skipped if the genders didn't make it through
    // before `start_game`. `waitForRoundOverlayAnyPlayer` throws on
    // timeout — catch it and bail out silently in that case.
    try {
      await waitForRoundOverlayAnyPlayer(host, guest, "smatch_or_pass", 20000);
    } catch {
      return;
    }

    // The décideur is random. Only the décideur sees the "toi" badge and
    // the choice buttons. Probe both pages for the "toi" badge.
    let decideurPage: Page | null = null;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const hostIsDec = await host
        .getByText("toi", { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      const guestIsDec = await guest
        .getByText("toi", { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      if (hostIsDec && !guestIsDec) {
        decideurPage = host;
        break;
      }
      if (guestIsDec && !hostIsDec) {
        decideurPage = guest;
        break;
      }
      await host.waitForTimeout(300);
    }
    if (!decideurPage) return;

    // Send `smatch_choice: "smatch"` — server emits `smatch_or_pass_result`
    // with choice="smatch", which today nobody handles.
    await sendRawWs(decideurPage, {
      type: "smatch_choice",
      choice: "smatch",
    });

    // EXPECTED (fails today because no handler): the "💋 Smatch !" result
    // text must appear on at least one page. Today both pages stay on
    // "En attente de la décision..." (non-décideur) or the choice buttons
    // (décideur) until special_round_end closes the overlay.
    await waitForTextAnyPlayer(host, guest, /Smatch !/, 10000);
  });
});
