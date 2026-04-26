// Repro: the `courage_result` used to show only "Bonne/Mauvaise réponse"
// and a generic DrinkAlert on top that hid everything. Everyone (other
// players included) should see the answer the chosen player submitted AND
// the correct answer — so the group can laugh and everyone learns.
//
// Fix: the DrinkAlert itself now renders the given/correct answer inline
// (details dispatcher keyed by `kind`), so a single 4s overlay carries
// everything needed without occluding a second card.

import {
  expect,
  startMultiAlcoholGame,
  multiTest as test,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { sendAppWsMessage } from "../../helpers/multi-fixtures";

test.describe("courage: result overlay shows the submitted + correct answer", () => {
  test("wrong answer is shown to all players with the correct one next to it", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    await startMultiAlcoholGame(host, guest, {
      frequency: 1,
      enabledRounds: ["courage"],
    });

    // Wait for the courage overlay on either player (server randomly picks
    // one of them). Both pages render the same overlay.
    await host
      .locator("p.text-xl")
      .waitFor({ state: "visible", timeout: 10000 });

    // Trigger the special round by answering a turn.
    await sendAppWsMessage(host, { type: "submit_answer", answer: "x" });

    await waitForRoundOverlayAnyPlayer(host, guest, "courage", 20000);

    // The "J'accepte !" button is only rendered on the chosen player's
    // page. Wait on whichever page shows it first (Promise.any); that's
    // the picked one.
    const acceptBtn = (p: typeof host) =>
      p.getByRole("button", { name: "J'accepte !" });
    const chosen = await Promise.any([
      acceptBtn(host)
        .waitFor({ state: "visible", timeout: 10000 })
        .then(() => host),
      acceptBtn(guest)
        .waitFor({ state: "visible", timeout: 10000 })
        .then(() => guest),
    ]);
    const other = chosen === host ? guest : host;

    await acceptBtn(chosen).click();

    // Chosen player types a wrong answer deliberately.
    const input = chosen.getByPlaceholder("Ta réponse...");
    await input.waitFor({ state: "visible", timeout: 10000 });
    const WRONG = "__reponse-deliberement-fausse__";
    await input.fill(WRONG);
    // Two "Valider" buttons exist transiently during the result phase
    // (input disables but stays, new button enables). Scope to the courage
    // card via its heading.
    await chosen.getByRole("button", { name: "Valider" }).first().click();

    // Both pages must see the rich DrinkAlert: the fullscreen overlay
    // itself carries the wrong answer AND the correct one. Scope all
    // assertions inside the DrinkAlert DOM subtree so we prove the info
    // is on top (not behind it).
    for (const p of [chosen, other]) {
      const drinkAlert = p.locator("button.fixed.inset-0");
      await drinkAlert.waitFor({ state: "visible", timeout: 10000 });
      await expect(
        drinkAlert.getByText(/cul-sec.*mauvaise réponse/i),
      ).toBeVisible({
        timeout: 5000,
      });
      await expect(drinkAlert.getByText(WRONG)).toBeVisible({ timeout: 5000 });
      await expect(drinkAlert.getByText(/Bonne réponse\s*:/)).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
