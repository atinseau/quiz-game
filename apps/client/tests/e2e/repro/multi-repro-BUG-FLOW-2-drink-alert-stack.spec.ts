// See docs/superpowers/specs/2026-04-19-special-rounds-audit.md -> BUG-FLOW-2
//
// Repro for: `broadcastDrinkAlert` (src/server/alcohol/framework.ts:49-70)
// emits one `drink_alert` message per target player. Each message makes the
// client push a new entry into `drinkAlerts[]` (alcoholStore), and the
// Game/MultiGameScreen renders ONE fullscreen `<DrinkAlert>` per entry:
//
//   <button class="fixed inset-0 z-[100] ...">
//
// Whenever two or more players drink at the same time (e.g. `petit_buveur`
// with tied losers, `love_or_drink` on `cul_sec`, Cupidon propagation), the
// client stacks multiple fullscreen overlays on top of each other.
//
// This test forces `petit_buveur` in a 2-player game where both scores are
// still 0 at the trigger moment, so the server picks BOTH players as losers
// and emits two `drink_alert` messages. The client ends up with 2 overlays
// stacked on `button.fixed.inset-0` (the helper `countDrinkAlerts` counts
// exactly those nodes).
//
// Marked `test.fail` — will pass once DrinkAlert rendering is changed to a
// single stacked/toast queue instead of N fullscreen overlays.

import {
  countDrinkAlerts,
  expect,
  ROUND_TITLES,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { submitAnswerViaWs } from "../../helpers/multi-fixtures";

test.describe("BUG-FLOW-2 — multiple drink_alerts stack fullscreen", () => {
  test("petit_buveur with tied losers shows a single drink alert at a time", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    // Force petit_buveur to trigger after 1 turn.
    // Classic mode + answer wrong to keep the score 0-0.
    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["petit_buveur"],
    });

    // Wait for the first question to be rendered.
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 });

    // In classic mode only the current (first) player's answer counts. The
    // first player in the rotation is the host (Alice). We submit a wrong
    // string via WS so the answer is always "wrong" regardless of the
    // question type (qcm/vrai_faux/texte) — this guarantees score stays 0.
    // `submitAnswerViaWs` uses the original WebSocket.send to bypass the
    // test helper's suppression of duplicate messages.
    await submitAnswerViaWs(host, "__WRONG_ANSWER_FOR_REPRO__");

    // turn_result broadcast + 3s NEXT_QUESTION_DELAY + checkTrigger → petit_buveur.
    // Both players are still at 0 → 2 losers → 2 drink_alert broadcasts.
    const victim = await waitForRoundOverlayAnyPlayer(
      host,
      guest,
      "petit_buveur",
      20000,
    );

    // Give the server a beat to emit the drink_alert messages that follow
    // `special_round_start`. The round start broadcast + the two drink_alert
    // broadcasts are effectively synchronous server-side, but the client WS
    // handler still needs a tick to update the store and re-render.
    await victim
      .getByText(ROUND_TITLES.petit_buveur, { exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 5000 });
    await victim.waitForTimeout(500);

    // EXPECTED (fails today because one fullscreen overlay is mounted per
    // drink_alert message): at most one DrinkAlert fullscreen overlay is
    // mounted at a time. `countDrinkAlerts` counts `button.fixed.inset-0`
    // nodes — one per <DrinkAlert>.
    const count = await countDrinkAlerts(victim);
    expect(count).toBeLessThanOrEqual(1);
  });
});
