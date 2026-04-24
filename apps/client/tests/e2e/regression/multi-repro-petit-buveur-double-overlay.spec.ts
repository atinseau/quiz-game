// Regression guards for petit_buveur — the DrinkAlert should fire exactly
// once, and there should be no secondary overlay behind it.
//
// Bug 1: client used to mount BOTH `<SpecialRoundOverlay>` (z-90 card) AND
// fullscreen `<DrinkAlert>` (z-100). Fixed by removing petit_buveur from the
// client round registry.
//
// Bug 2: with N tied losers the server used to emit N `drink_alert` messages.
// The FIFO queue replayed the bounce-in animation once per message, so the
// user saw the overlay appear / disappear N times in a row. Fixed by
// aggregating the drinkers into a single message server-side.

import {
  expect,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { submitAnswerViaWs } from "../../helpers/multi-fixtures";

test.describe("petit_buveur — single overlay only", () => {
  test("renders DrinkAlert without a PetitBuveur card behind it", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["petit_buveur"],
    });

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 });

    await submitAnswerViaWs(host, "__WRONG_ANSWER__");

    const victim = await waitForRoundOverlayAnyPlayer(
      host,
      guest,
      "petit_buveur",
      20000,
    );

    // DrinkAlert is mounted now.
    await victim.waitForTimeout(500);

    // The DrinkAlert message matches ROUND_TITLES.petit_buveur ("boit une gorgée").
    const drinkAlertCount = await victim
      .locator("button.fixed.inset-0")
      .count();
    expect(drinkAlertCount).toBe(1);

    // The removed PetitBuveur card had a "Petit buveur !" heading. It must
    // not be rendered anywhere on the page.
    const petitBuveurCardVisible = await victim
      .getByText("Petit buveur !", { exact: true })
      .isVisible()
      .catch(() => false);
    expect(petitBuveurCardVisible).toBe(false);
  });

  test("does not replay the bounce-in animation for each tied loser", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    // Same setup as above — 2 players, wrong answer keeps score 0-0 → both
    // are min-score losers → server used to emit two drink_alerts.
    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["petit_buveur"],
    });

    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 });
    await submitAnswerViaWs(host, "__WRONG_ANSWER__");

    const victim = await waitForRoundOverlayAnyPlayer(
      host,
      guest,
      "petit_buveur",
      20000,
    );

    const drinkAlert = victim.locator("button.fixed.inset-0");

    // First (and only) DrinkAlert should mount and then dismiss.
    await drinkAlert.waitFor({ state: "visible", timeout: 10000 });
    await drinkAlert.waitFor({ state: "detached", timeout: 10000 });

    // EXPECTED: no second animation. Poll briefly — if a queued alert
    // re-mounts within ~1.5s, the FIFO replay bug has regressed.
    const reappeared = await drinkAlert
      .waitFor({ state: "visible", timeout: 1500 })
      .then(() => true)
      .catch(() => false);
    expect(reappeared).toBe(false);
  });
});
