import {
  playTurnsMulti,
  startMultiAlcoholGame,
} from "../../helpers/alcohol-fixtures";
import { expect, test } from "../../helpers/multi-fixtures";

test("Multi-device alcohol: special round triggers after configured turns", async ({
  multi,
}) => {
  const { host, guest } = multi;

  await startMultiAlcoholGame(host, guest, {
    frequency: 3,
    enabledRounds: ["petit_buveur", "distributeur", "courage"],
    culSecEndGame: true,
  });

  await expect(host.locator("p.text-xl")).toBeVisible({ timeout: 10000 });

  // Play 3 turns to trigger a special round
  await playTurnsMulti(host, guest, 3);

  // After 3 turns, a special round overlay or drink alert should appear on
  // at least one screen.
  const specialRoundPattern =
    /Petit buveur|Distributeur|Question de courage|boit une gorgée|gorgée|CUL SEC|moitié du verre/;
  const hostHit = host.getByText(specialRoundPattern).first();
  const guestHit = guest.getByText(specialRoundPattern).first();

  const seen = await Promise.any([
    hostHit.waitFor({ state: "visible", timeout: 15000 }).then(() => true),
    guestHit.waitFor({ state: "visible", timeout: 15000 }).then(() => true),
  ]).catch(() => false);

  expect(seen).toBe(true);
});
