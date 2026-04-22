import {
  playTurnsMulti,
  startMultiAlcoholGame,
  waitForRoundOverlayAnyPlayer,
} from "../../helpers/alcohol-fixtures";
import { test } from "../../helpers/multi-fixtures";

const STRAIGHTFORWARD_ROUNDS = [
  "conseil",
  "love_or_drink",
  "cupidon",
  "show_us",
] as const;

test.describe("Phase B multi-device alcohol rounds", () => {
  for (const round of STRAIGHTFORWARD_ROUNDS) {
    test(`${round} triggers`, async ({ multi }) => {
      const { host, guest } = multi;
      await startMultiAlcoholGame(host, guest, {
        frequency: 3,
        enabledRounds: [round],
      });
      await playTurnsMulti(host, guest, 3);
      await waitForRoundOverlayAnyPlayer(host, guest, round, 15000);
    });
  }

  test("smatch_or_pass triggers with opposite genders", async ({ multi }) => {
    const { host, guest } = multi;
    // Force opposite genders via startMultiAlcoholGame overrides so the server
    // can pair decideur/receveur. Default would be homme/homme (round skipped).
    await startMultiAlcoholGame(host, guest, {
      frequency: 3,
      enabledRounds: ["smatch_or_pass"],
      hostGender: "homme",
      guestGender: "femme",
    });
    await playTurnsMulti(host, guest, 3);

    // Strict assertion: overlay MUST appear on at least one device.
    await waitForRoundOverlayAnyPlayer(host, guest, "smatch_or_pass", 15000);
  });
});
