// Regression: DrinkAlert renders "C'est pour toi !" on the loser's page and
// "C'est pour {name} !" on the observer's page.
//
// Uses a 2-player Conseil setup. Both players can only vote for the other,
// which always produces a 1-1 tie → tiebreaker wheel fires server-side and
// picks a single loser. The final drink_alert payload always carries exactly
// ONE targetClerkId (the server-picked loser), so personalization logic is
// exercised identically regardless of whether the tiebreaker path was taken.
//
// This test therefore doubles as an incidental integration test for the
// tiebreaker's final-alert integration.

import { expect } from "@playwright/test";
import {
  playTurnsMulti,
  startMultiAlcoholGame,
} from "../../helpers/alcohol-fixtures";
import { test } from "../../helpers/multi-fixtures";

test.describe("Drink alert — personalization", () => {
  test("loser sees 'C'est pour toi !', observer sees 'C'est pour {name} !'", async ({
    multi,
  }) => {
    test.slow();
    const { host, guest } = multi;

    await startMultiAlcoholGame(host, guest, {
      frequency: 3,
      enabledRounds: ["conseil"],
    });

    await playTurnsMulti(host, guest, 3);

    // Conseil vote overlay appears on both clients
    await expect(host.getByText("Conseil du village")).toBeVisible({
      timeout: 15000,
    });
    await expect(guest.getByText("Conseil du village")).toBeVisible({
      timeout: 15000,
    });

    // Both players vote. With 2 players each can only vote for the other,
    // producing a 1-1 tie. Server resolves via tiebreaker wheel and broadcasts
    // a drink_alert with a single targetClerkId.
    const hostVote = host.getByRole("button", { name: /^🗳️/ }).first();
    const guestVote = guest.getByRole("button", { name: /^🗳️/ }).first();
    await hostVote.click({ force: true });
    await guestVote.click({ force: true });

    // Wait for the DrinkAlert fullscreen overlay on both clients.
    // After tiebreaker: reveal (1.5s) + spin (4s) + settle (0.8s) ≈ 7s.
    const alert = (p: typeof host) => p.locator("button.fixed.inset-0");
    await alert(host).waitFor({ state: "visible", timeout: 15000 });
    await alert(guest).waitFor({ state: "visible", timeout: 15000 });

    // Collect which verdict each page shows concurrently (the alert auto-closes
    // after 4s, so we must not check them sequentially).
    const verdicts = await Promise.all(
      [host, guest].map(async (p) => ({
        page: p,
        hasSelfVerdict: await p
          .getByText("C'est pour toi !")
          .isVisible()
          .catch(() => false),
      })),
    );

    // Exactly ONE page (the loser) sees the self-verdict
    const selfVerdicts = verdicts.filter((v) => v.hasSelfVerdict);
    expect(selfVerdicts).toHaveLength(1);

    // The other page (observer) sees "C'est pour {name} !" (name ≠ "toi !")
    const observer = verdicts.find((v) => !v.hasSelfVerdict);
    expect(observer).toBeDefined();
    if (observer) {
      await expect(
        observer.page.getByText(/^C'est pour (?!toi !$).+ !$/),
      ).toBeVisible();
    }

    // Both pages show the capitalized action line ("Boire une gorgée")
    await expect(host.getByText(/Boire une gorgée/)).toBeVisible();
    await expect(guest.getByText(/Boire une gorgée/)).toBeVisible();
  });
});
